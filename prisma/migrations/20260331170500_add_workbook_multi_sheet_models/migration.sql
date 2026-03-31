ALTER TYPE "SourceFileKind" ADD VALUE IF NOT EXISTS 'FINANCIAL';
ALTER TYPE "SourceFileKind" ADD VALUE IF NOT EXISTS 'WORKBOOK';

ALTER TYPE "ImportBatchKind" ADD VALUE IF NOT EXISTS 'FINANCIAL_LEDGER';
ALTER TYPE "ImportBatchKind" ADD VALUE IF NOT EXISTS 'FINE_LEDGER';
ALTER TYPE "ImportBatchKind" ADD VALUE IF NOT EXISTS 'WORKBOOK_MULTI_SHEET';

CREATE TYPE "FinancialEntryDomain" AS ENUM ('REVENUE', 'EXPENSE', 'INVESTMENT');
CREATE TYPE "FinancialEntryDirection" AS ENUM ('INFLOW', 'OUTFLOW');
CREATE TYPE "FinePaymentState" AS ENUM ('UNKNOWN', 'UNPAID', 'PARTIAL', 'PAID', 'CONTESTED', 'CANCELLED');
CREATE TYPE "ResponsibilityType" AS ENUM ('UNKNOWN', 'COMPANY', 'OWNER', 'DRIVER', 'LEGAL', 'THIRD_PARTY');

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawAliases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "financialAccountId" TEXT,
    "rowHash" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "sourceSheetName" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "domain" "FinancialEntryDomain" NOT NULL,
    "direction" "FinancialEntryDirection" NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "groupRaw" TEXT,
    "groupNormalized" TEXT,
    "detailRaw" TEXT,
    "categoryRaw" TEXT,
    "accountRaw" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FineRecord" (
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
    "paymentState" "FinePaymentState" NOT NULL DEFAULT 'UNKNOWN',
    "amount" DECIMAL(12,2),
    "plateRaw" TEXT,
    "plate" TEXT NOT NULL,
    "aitRaw" TEXT,
    "ait" TEXT,
    "vehicleRaw" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FineResponsibility" (
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
    "responsibilityType" "ResponsibilityType" NOT NULL DEFAULT 'UNKNOWN',
    "plateRaw" TEXT,
    "plate" TEXT,
    "infractionDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2),
    "payeeRaw" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineResponsibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAccount_normalizedName_key" ON "FinancialAccount"("normalizedName");
CREATE INDEX "FinancialAccount_displayName_idx" ON "FinancialAccount"("displayName");

CREATE UNIQUE INDEX "FinancialEntry_rowHash_key" ON "FinancialEntry"("rowHash");
CREATE UNIQUE INDEX "FinancialEntry_sourceFileId_sourceSheetName_sourceRowNumber_key" ON "FinancialEntry"("sourceFileId", "sourceSheetName", "sourceRowNumber");
CREATE INDEX "FinancialEntry_domain_entryDate_idx" ON "FinancialEntry"("domain", "entryDate");
CREATE INDEX "FinancialEntry_direction_entryDate_idx" ON "FinancialEntry"("direction", "entryDate");
CREATE INDEX "FinancialEntry_financialAccountId_entryDate_idx" ON "FinancialEntry"("financialAccountId", "entryDate");
CREATE INDEX "FinancialEntry_referenceYear_referenceMonth_idx" ON "FinancialEntry"("referenceYear", "referenceMonth");
CREATE INDEX "FinancialEntry_entryKey_idx" ON "FinancialEntry"("entryKey");

CREATE UNIQUE INDEX "FineRecord_rowHash_key" ON "FineRecord"("rowHash");
CREATE UNIQUE INDEX "FineRecord_sourceFileId_sourceSheetName_sourceRowNumber_key" ON "FineRecord"("sourceFileId", "sourceSheetName", "sourceRowNumber");
CREATE INDEX "FineRecord_plate_infractionDate_idx" ON "FineRecord"("plate", "infractionDate");
CREATE INDEX "FineRecord_vehicleId_infractionDate_idx" ON "FineRecord"("vehicleId", "infractionDate");
CREATE INDEX "FineRecord_driverId_infractionDate_idx" ON "FineRecord"("driverId", "infractionDate");
CREATE INDEX "FineRecord_ait_idx" ON "FineRecord"("ait");
CREATE INDEX "FineRecord_paymentState_idx" ON "FineRecord"("paymentState");
CREATE INDEX "FineRecord_fineKey_idx" ON "FineRecord"("fineKey");

CREATE UNIQUE INDEX "FineResponsibility_rowHash_key" ON "FineResponsibility"("rowHash");
CREATE UNIQUE INDEX "FineResponsibility_sourceFileId_sourceSheetName_sourceRowNumber_key" ON "FineResponsibility"("sourceFileId", "sourceSheetName", "sourceRowNumber");
CREATE INDEX "FineResponsibility_plate_paymentDate_idx" ON "FineResponsibility"("plate", "paymentDate");
CREATE INDEX "FineResponsibility_fineRecordId_idx" ON "FineResponsibility"("fineRecordId");
CREATE INDEX "FineResponsibility_responsibilityType_idx" ON "FineResponsibility"("responsibilityType");
CREATE INDEX "FineResponsibility_responsibilityKey_idx" ON "FineResponsibility"("responsibilityKey");

ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FineRecord" ADD CONSTRAINT "FineRecord_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FineRecord" ADD CONSTRAINT "FineRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FineRecord" ADD CONSTRAINT "FineRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FineRecord" ADD CONSTRAINT "FineRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FineResponsibility" ADD CONSTRAINT "FineResponsibility_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FineResponsibility" ADD CONSTRAINT "FineResponsibility_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FineResponsibility" ADD CONSTRAINT "FineResponsibility_fineRecordId_fkey" FOREIGN KEY ("fineRecordId") REFERENCES "FineRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FineResponsibility" ADD CONSTRAINT "FineResponsibility_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
