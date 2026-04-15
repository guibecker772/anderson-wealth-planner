const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function tableExists(table) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${table}'
    ) AS "exists"`,
  );
  return rows[0]?.exists ?? false;
}

async function columnExists(table, column) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table}'
        AND column_name = '${column}'
    ) AS "exists"`,
  );
  return rows[0]?.exists ?? false;
}

async function typeExists(typeName) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = '${typeName}'
    ) AS "exists"`,
  );
  return rows[0]?.exists ?? false;
}

async function tableCount(table) {
  const rows = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS "count" FROM "public"."${table}"`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function exec(sql, label) {
  console.log(`- ${label}`);
  await db.$executeRawUnsafe(sql);
}

async function ensureEnum(typeName, values) {
  if (!(await typeExists(typeName))) {
    await exec(
      `CREATE TYPE "public"."${typeName}" AS ENUM (${values.map((value) => `'${value}'`).join(', ')})`,
      `create enum ${typeName}`,
    );
    return;
  }

  for (const value of values) {
    await exec(
      `ALTER TYPE "public"."${typeName}" ADD VALUE IF NOT EXISTS '${value}'`,
      `ensure enum value ${typeName}.${value}`,
    );
  }
}

async function main() {
  console.log('Repairing local legacy schema...');

  await ensureEnum('SourceFileKind', ['OPERATIONAL', 'FINES', 'UNKNOWN', 'FINANCIAL', 'WORKBOOK']);
  await ensureEnum('ImportBatchKind', [
    'LEGACY_TRANSACTION',
    'OPERATIONAL_SNAPSHOT',
    'FINANCIAL_LEDGER',
    'FINE_LEDGER',
    'WORKBOOK_MULTI_SHEET',
  ]);
  await ensureEnum('OperationalPaymentState', ['UNKNOWN', 'UNPAID', 'PARTIAL', 'PAID', 'OVERPAID']);
  await ensureEnum('UserRole', ['ADMIN', 'INVESTOR']);
  await ensureEnum('FinancialEntryDomain', ['REVENUE', 'EXPENSE', 'INVESTMENT']);
  await ensureEnum('FinancialEntryDirection', ['INFLOW', 'OUTFLOW']);
  await ensureEnum('FinePaymentState', ['UNKNOWN', 'UNPAID', 'PARTIAL', 'PAID', 'CONTESTED', 'CANCELLED']);
  await ensureEnum('ResponsibilityType', ['UNKNOWN', 'COMPANY', 'OWNER', 'DRIVER', 'LEGAL', 'THIRD_PARTY']);

  if (!(await columnExists('SourceFile', 'importBatchId'))) {
    await exec(
      'ALTER TABLE "public"."SourceFile" ADD COLUMN "importBatchId" TEXT',
      'add SourceFile.importBatchId',
    );
  }

  await exec(
    'CREATE INDEX IF NOT EXISTS "SourceFile_importBatchId_idx" ON "public"."SourceFile"("importBatchId")',
    'ensure SourceFile.importBatchId index',
  );

  if (!(await tableExists('ImportBatch'))) {
    await exec(
      `CREATE TABLE "public"."ImportBatch" (
        "id" TEXT NOT NULL,
        "batchKey" TEXT NOT NULL,
        "kind" "public"."ImportBatchKind" NOT NULL DEFAULT 'OPERATIONAL_SNAPSHOT',
        "status" "public"."ProcessingStatus" NOT NULL DEFAULT 'PENDING',
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        "errorMessage" TEXT,
        "details" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
      )`,
      'create ImportBatch table',
    );
  }

  await exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS "ImportBatch_batchKey_key" ON "public"."ImportBatch"("batchKey")',
    'ensure ImportBatch.batchKey unique index',
  );

  if (!(await tableExists('Investor'))) {
    await exec(
      `CREATE TABLE "public"."Investor" (
        "id" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "normalizedName" TEXT NOT NULL,
        "rawAliases" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
      )`,
      'create Investor table',
    );
  }

  if ((await tableCount('Investor')) === 0 && (await tableExists('Owner'))) {
    await exec(
      `INSERT INTO "public"."Investor" ("id", "displayName", "normalizedName", "rawAliases", "createdAt", "updatedAt")
       SELECT
         o."id",
         o."nameRaw",
         o."normalizedKey",
         NULL,
         o."createdAt",
         o."updatedAt"
       FROM "public"."Owner" o
       WHERE o."mergedIntoId" IS NULL`,
      'backfill Investor from Owner',
    );
  }

  await exec(
    'CREATE INDEX IF NOT EXISTS "Investor_displayName_idx" ON "public"."Investor"("displayName")',
    'ensure Investor.displayName index',
  );

  if (!(await columnExists('Driver', 'normalizedName'))) {
    await exec(
      'ALTER TABLE "public"."Driver" ADD COLUMN "normalizedName" TEXT',
      'add Driver.normalizedName',
    );
  }

  await exec(
    `UPDATE "public"."Driver"
     SET "normalizedName" = COALESCE(NULLIF("normalizedName", ''), NULLIF("normalizedKey", ''), 'driver-' || "id")
     WHERE "normalizedName" IS NULL OR "normalizedName" = ''`,
    'backfill Driver.normalizedName',
  );

  if (!(await columnExists('Vehicle', 'plateDisplay'))) {
    await exec(
      'ALTER TABLE "public"."Vehicle" ADD COLUMN "plateDisplay" TEXT',
      'add Vehicle.plateDisplay',
    );
  }

  if (!(await columnExists('Vehicle', 'modelLatest'))) {
    await exec(
      'ALTER TABLE "public"."Vehicle" ADD COLUMN "modelLatest" TEXT',
      'add Vehicle.modelLatest',
    );
  }

  await exec(
    `UPDATE "public"."Vehicle"
     SET "plateDisplay" = COALESCE(NULLIF("plateDisplay", ''), "plate"),
         "modelLatest" = COALESCE(NULLIF("modelLatest", ''), "modelRaw")
     WHERE "plateDisplay" IS NULL OR "modelLatest" IS NULL`,
    'backfill Vehicle columns',
  );

  if (!(await tableExists('OperationalSnapshot'))) {
    await exec(
      `CREATE TABLE "public"."OperationalSnapshot" (
        "id" TEXT NOT NULL,
        "sourceFileId" TEXT NOT NULL,
        "importBatchId" TEXT,
        "investorId" TEXT,
        "vehicleId" TEXT,
        "driverId" TEXT,
        "rowHash" TEXT NOT NULL,
        "operationalKey" TEXT NOT NULL,
        "sheetName" TEXT NOT NULL,
        "sourceRowNumber" INTEGER NOT NULL,
        "referenceDate" TIMESTAMP(3) NOT NULL,
        "referenceYear" INTEGER NOT NULL,
        "referenceMonth" INTEGER NOT NULL,
        "weekOfMonth" INTEGER,
        "contractActiveRaw" TEXT,
        "contractActive" BOOLEAN,
        "vehicleStatusRaw" TEXT,
        "vehicleStatusNormalized" TEXT,
        "paymentStatusRaw" TEXT,
        "paymentState" "public"."OperationalPaymentState" NOT NULL DEFAULT 'UNKNOWN',
        "plateRaw" TEXT,
        "plate" TEXT NOT NULL,
        "modelRaw" TEXT,
        "model" TEXT,
        "investorRaw" TEXT,
        "investorNormalized" TEXT,
        "driverRaw" TEXT,
        "driverNormalized" TEXT,
        "contractValue" DECIMAL(12, 2),
        "lateFeeAmount" DECIMAL(12, 2),
        "discountAmount" DECIMAL(12, 2),
        "amountToCharge" DECIMAL(12, 2),
        "maintenanceByDriverAmount" DECIMAL(12, 2),
        "amountPaidWeek" DECIMAL(12, 2),
        "openAmount" DECIMAL(12, 2),
        "rawJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "OperationalSnapshot_pkey" PRIMARY KEY ("id")
      )`,
      'create OperationalSnapshot table',
    );
  }

  if ((await tableCount('OperationalSnapshot')) === 0 && (await tableExists('VehicleWeekSnapshot'))) {
    await exec(
      `INSERT INTO "public"."OperationalSnapshot" (
        "id",
        "sourceFileId",
        "importBatchId",
        "investorId",
        "vehicleId",
        "driverId",
        "rowHash",
        "operationalKey",
        "sheetName",
        "sourceRowNumber",
        "referenceDate",
        "referenceYear",
        "referenceMonth",
        "weekOfMonth",
        "contractActiveRaw",
        "contractActive",
        "vehicleStatusRaw",
        "vehicleStatusNormalized",
        "paymentStatusRaw",
        "paymentState",
        "plateRaw",
        "plate",
        "modelRaw",
        "model",
        "investorRaw",
        "investorNormalized",
        "driverRaw",
        "driverNormalized",
        "contractValue",
        "lateFeeAmount",
        "discountAmount",
        "amountToCharge",
        "maintenanceByDriverAmount",
        "amountPaidWeek",
        "openAmount",
        "rawJson",
        "createdAt",
        "updatedAt"
      )
      SELECT
        vws."id",
        vws."sourceFileId",
        NULL,
        vws."ownerId",
        vws."vehicleId",
        vws."driverId",
        COALESCE(vws."rowHash", vws."id"),
        COALESCE(vws."periodMonthKey", 'legacy') || '-' || COALESCE(vws."periodWeek"::TEXT, '0') || '-' || COALESCE(veh."plate", 'unknown'),
        'LEGACY',
        ROW_NUMBER() OVER (PARTITION BY vws."sourceFileId" ORDER BY vws."createdAt", vws."id"),
        COALESCE(
          TO_DATE(vws."periodMonthKey" || '-01', 'YYYY-MM-DD') + ((GREATEST(COALESCE(vws."periodWeek", 1), 1) - 1) * INTERVAL '7 days'),
          vws."createdAt"
        ),
        COALESCE(vws."periodYear", EXTRACT(YEAR FROM vws."createdAt")::INT),
        COALESCE(NULLIF(SPLIT_PART(vws."periodMonthKey", '-', 2), '')::INT, EXTRACT(MONTH FROM vws."createdAt")::INT),
        vws."periodWeek",
        CASE WHEN vws."contractActive" IS NULL THEN NULL ELSE vws."contractActive"::TEXT END,
        vws."contractActive",
        vws."vehicleStatusRaw",
        COALESCE(vws."vehicleStatus"::TEXT, vws."vehicleStatusRaw"),
        vws."paymentStatusRaw",
        CASE
          WHEN vws."paymentStatus"::TEXT = 'SETTLED' THEN 'PAID'::"public"."OperationalPaymentState"
          WHEN vws."paymentStatus"::TEXT IN ('PENDING', 'OVERDUE', 'CANCELED') THEN 'UNPAID'::"public"."OperationalPaymentState"
          ELSE 'UNKNOWN'::"public"."OperationalPaymentState"
        END,
        veh."plate",
        COALESCE(veh."plate", 'UNKNOWN'),
        vws."modelRaw",
        COALESCE(vws."modelRaw", veh."modelRaw"),
        vws."ownerNameRaw",
        own."normalizedKey",
        vws."driverNameRaw",
        drv."normalizedName",
        vws."contractValue",
        vws."lateFee",
        vws."discount",
        vws."amountToCharge",
        vws."driverMaintenance",
        vws."amountPaidWeek",
        NULL,
        vws."rawJson",
        vws."createdAt",
        vws."updatedAt"
      FROM "public"."VehicleWeekSnapshot" vws
      LEFT JOIN "public"."Vehicle" veh ON veh."id" = vws."vehicleId"
      LEFT JOIN "public"."Owner" own ON own."id" = vws."ownerId"
      LEFT JOIN "public"."Driver" drv ON drv."id" = vws."driverId"`,
      'backfill OperationalSnapshot from VehicleWeekSnapshot',
    );
  }

  if (!(await tableExists('FinancialAccount'))) {
    await exec(
      `CREATE TABLE "public"."FinancialAccount" (
        "id" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "normalizedName" TEXT NOT NULL,
        "rawAliases" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
      )`,
      'create FinancialAccount table',
    );
  }

  if (!(await tableExists('FinancialEntry'))) {
    await exec(
      `CREATE TABLE "public"."FinancialEntry" (
        "id" TEXT NOT NULL,
        "sourceFileId" TEXT NOT NULL,
        "importBatchId" TEXT,
        "financialAccountId" TEXT,
        "rowHash" TEXT NOT NULL,
        "entryKey" TEXT NOT NULL,
        "sourceSheetName" TEXT NOT NULL,
        "sourceRowNumber" INTEGER NOT NULL,
        "domain" "public"."FinancialEntryDomain" NOT NULL,
        "direction" "public"."FinancialEntryDirection" NOT NULL,
        "entryDate" TIMESTAMP(3) NOT NULL,
        "referenceYear" INTEGER NOT NULL,
        "referenceMonth" INTEGER NOT NULL,
        "groupRaw" TEXT,
        "groupNormalized" TEXT,
        "detailRaw" TEXT,
        "categoryRaw" TEXT,
        "accountRaw" TEXT,
        "amount" DECIMAL(12, 2) NOT NULL,
        "rawJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
      )`,
      'create FinancialEntry table',
    );
  }

  if ((await tableCount('FinancialEntry')) === 0 && (await tableExists('Transaction'))) {
    await exec(
      `INSERT INTO "public"."FinancialEntry" (
        "id",
        "sourceFileId",
        "importBatchId",
        "financialAccountId",
        "rowHash",
        "entryKey",
        "sourceSheetName",
        "sourceRowNumber",
        "domain",
        "direction",
        "entryDate",
        "referenceYear",
        "referenceMonth",
        "groupRaw",
        "groupNormalized",
        "detailRaw",
        "categoryRaw",
        "accountRaw",
        "amount",
        "rawJson",
        "createdAt",
        "updatedAt"
      )
      SELECT
        tx."id",
        tx."sourceFileId",
        NULL,
        NULL,
        COALESCE(tx."rowHash", tx."id"),
        COALESCE(tx."externalId", tx."id"),
        'LEGACY',
        ROW_NUMBER() OVER (PARTITION BY tx."sourceFileId" ORDER BY tx."createdAt", tx."id"),
        CASE
          WHEN tx."type"::TEXT = 'RECEIVABLE' THEN 'REVENUE'::"public"."FinancialEntryDomain"
          ELSE 'EXPENSE'::"public"."FinancialEntryDomain"
        END,
        CASE
          WHEN tx."type"::TEXT = 'RECEIVABLE' THEN 'INFLOW'::"public"."FinancialEntryDirection"
          ELSE 'OUTFLOW'::"public"."FinancialEntryDirection"
        END,
        COALESCE(tx."actualDate", tx."dueDate", tx."plannedDate", tx."createdAt"),
        EXTRACT(YEAR FROM COALESCE(tx."actualDate", tx."dueDate", tx."plannedDate", tx."createdAt"))::INT,
        EXTRACT(MONTH FROM COALESCE(tx."actualDate", tx."dueDate", tx."plannedDate", tx."createdAt"))::INT,
        tx."category",
        tx."category",
        tx."description",
        tx."category",
        COALESCE(tx."counterparty", tx."unit"),
        COALESCE(tx."actualAmount", tx."plannedAmount"),
        tx."rawJson",
        tx."createdAt",
        tx."updatedAt"
      FROM "public"."Transaction" tx`,
      'backfill FinancialEntry from Transaction',
    );
  }

  if (!(await tableExists('FineRecord'))) {
    await exec(
      `CREATE TABLE "public"."FineRecord" (
        "id" TEXT NOT NULL,
        "sourceFileId" TEXT NOT NULL,
        "importBatchId" TEXT,
        "vehicleId" TEXT,
        "driverId" TEXT,
        "rowHash" TEXT NOT NULL,
        "fineKey" TEXT NOT NULL,
        "sourceSheetName" TEXT NOT NULL,
        "sourceRowNumber" INTEGER NOT NULL,
        "infractionDate" TIMESTAMP(3) NOT NULL,
        "referenceYear" INTEGER NOT NULL,
        "referenceMonth" INTEGER NOT NULL,
        "issuingAuthorityRaw" TEXT,
        "driverRaw" TEXT,
        "driverNormalized" TEXT,
        "paymentStatusRaw" TEXT,
        "paymentState" "public"."FinePaymentState" NOT NULL DEFAULT 'UNKNOWN',
        "amount" DECIMAL(12, 2),
        "plateRaw" TEXT,
        "plate" TEXT NOT NULL,
        "aitRaw" TEXT,
        "ait" TEXT,
        "vehicleRaw" TEXT,
        "rawJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FineRecord_pkey" PRIMARY KEY ("id")
      )`,
      'create FineRecord table',
    );
  }

  if ((await tableCount('FineRecord')) === 0 && (await tableExists('Infraction'))) {
    await exec(
      `INSERT INTO "public"."FineRecord" (
        "id",
        "sourceFileId",
        "importBatchId",
        "vehicleId",
        "driverId",
        "rowHash",
        "fineKey",
        "sourceSheetName",
        "sourceRowNumber",
        "infractionDate",
        "referenceYear",
        "referenceMonth",
        "issuingAuthorityRaw",
        "driverRaw",
        "driverNormalized",
        "paymentStatusRaw",
        "paymentState",
        "amount",
        "plateRaw",
        "plate",
        "aitRaw",
        "ait",
        "vehicleRaw",
        "rawJson",
        "createdAt",
        "updatedAt"
      )
      SELECT
        inf."id",
        inf."sourceFileId",
        NULL,
        inf."vehicleId",
        NULL,
        COALESCE(inf."rowHash", inf."id"),
        COALESCE(inf."infractionCode", inf."id"),
        'LEGACY',
        ROW_NUMBER() OVER (PARTITION BY inf."sourceFileId" ORDER BY inf."createdAt", inf."id"),
        COALESCE(inf."infractionDate", inf."createdAt"),
        EXTRACT(YEAR FROM COALESCE(inf."infractionDate", inf."createdAt"))::INT,
        EXTRACT(MONTH FROM COALESCE(inf."infractionDate", inf."createdAt"))::INT,
        NULL,
        inf."driverNameRaw",
        NULL,
        CASE WHEN inf."isPaid" THEN 'PAID' ELSE 'UNPAID' END,
        CASE
          WHEN inf."isPaid" THEN 'PAID'::"public"."FinePaymentState"
          ELSE 'UNPAID'::"public"."FinePaymentState"
        END,
        inf."value",
        inf."plateRaw",
        inf."plate",
        inf."infractionCode",
        inf."infractionCode",
        NULL,
        inf."rawJson",
        inf."createdAt",
        inf."updatedAt"
      FROM "public"."Infraction" inf`,
      'backfill FineRecord from Infraction',
    );
  }

  if (!(await tableExists('FineResponsibility'))) {
    await exec(
      `CREATE TABLE "public"."FineResponsibility" (
        "id" TEXT NOT NULL,
        "sourceFileId" TEXT NOT NULL,
        "importBatchId" TEXT,
        "fineRecordId" TEXT,
        "vehicleId" TEXT,
        "rowHash" TEXT NOT NULL,
        "responsibilityKey" TEXT NOT NULL,
        "sourceSheetName" TEXT NOT NULL,
        "sourceRowNumber" INTEGER NOT NULL,
        "sectionLabelRaw" TEXT,
        "payerContextRaw" TEXT,
        "responsibilityType" "public"."ResponsibilityType" NOT NULL DEFAULT 'UNKNOWN',
        "plateRaw" TEXT,
        "plate" TEXT,
        "infractionDate" TIMESTAMP(3),
        "paymentDate" TIMESTAMP(3),
        "amount" DECIMAL(12, 2),
        "payeeRaw" TEXT,
        "rawJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FineResponsibility_pkey" PRIMARY KEY ("id")
      )`,
      'create FineResponsibility table',
    );
  }

  if ((await tableCount('FineResponsibility')) === 0 && (await tableExists('Infraction'))) {
    await exec(
      `INSERT INTO "public"."FineResponsibility" (
        "id",
        "sourceFileId",
        "importBatchId",
        "fineRecordId",
        "vehicleId",
        "rowHash",
        "responsibilityKey",
        "sourceSheetName",
        "sourceRowNumber",
        "sectionLabelRaw",
        "payerContextRaw",
        "responsibilityType",
        "plateRaw",
        "plate",
        "infractionDate",
        "paymentDate",
        "amount",
        "payeeRaw",
        "rawJson",
        "createdAt",
        "updatedAt"
      )
      SELECT
        'resp-' || inf."id",
        inf."sourceFileId",
        NULL,
        inf."id",
        inf."vehicleId",
        'resp-' || COALESCE(inf."rowHash", inf."id"),
        COALESCE(inf."infractionCode", inf."id"),
        'LEGACY',
        ROW_NUMBER() OVER (PARTITION BY inf."sourceFileId" ORDER BY inf."createdAt", inf."id"),
        NULL,
        inf."paidToRaw",
        CASE
          WHEN LOWER(COALESCE(inf."paidToRaw", '')) LIKE '%motorista%' THEN 'DRIVER'::"public"."ResponsibilityType"
          WHEN LOWER(COALESCE(inf."paidToRaw", '')) LIKE '%propriet%' OR LOWER(COALESCE(inf."paidToRaw", '')) LIKE '%invest%' THEN 'OWNER'::"public"."ResponsibilityType"
          ELSE 'UNKNOWN'::"public"."ResponsibilityType"
        END,
        inf."plateRaw",
        inf."plate",
        inf."infractionDate",
        NULL,
        inf."value",
        inf."paidToRaw",
        inf."rawJson",
        inf."createdAt",
        inf."updatedAt"
      FROM "public"."Infraction" inf`,
      'backfill FineResponsibility from Infraction',
    );
  }

  if (!(await tableExists('User'))) {
    await exec(
      `CREATE TABLE "public"."User" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" "public"."UserRole" NOT NULL DEFAULT 'INVESTOR',
        "investorId" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "firstLogin" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      )`,
      'create User table',
    );
  }

  await exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email")',
    'ensure User.email unique index',
  );

  if (!(await tableExists('AuditLog'))) {
    await exec(
      `CREATE TABLE "public"."AuditLog" (
        "id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "actorUserId" TEXT,
        "actorRole" TEXT,
        "targetUserId" TEXT,
        "targetInvestorId" TEXT,
        "metadata" JSONB,
        "ip" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
      )`,
      'create AuditLog table',
    );
  }

  console.log('Legacy schema repair finished.');
}

main()
  .catch((error) => {
    console.error('Legacy schema repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
