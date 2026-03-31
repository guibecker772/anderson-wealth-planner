-- CreateEnum
CREATE TYPE "ImportBatchKind" AS ENUM ('LEGACY_TRANSACTION', 'OPERATIONAL_SNAPSHOT');

-- CreateEnum
CREATE TYPE "OperationalPaymentState" AS ENUM ('UNKNOWN', 'UNPAID', 'PARTIAL', 'PAID', 'OVERPAID');

-- AlterTable
ALTER TABLE "SourceFile" ADD COLUMN "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "kind" "ImportBatchKind" NOT NULL DEFAULT 'OPERATIONAL_SNAPSHOT',
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawAliases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "plateDisplay" TEXT,
    "modelLatest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalSnapshot" (
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
    "paymentState" "OperationalPaymentState" NOT NULL DEFAULT 'UNKNOWN',
    "plateRaw" TEXT,
    "plate" TEXT NOT NULL,
    "modelRaw" TEXT,
    "model" TEXT,
    "investorRaw" TEXT,
    "investorNormalized" TEXT,
    "driverRaw" TEXT,
    "driverNormalized" TEXT,
    "contractValue" DECIMAL(12,2),
    "lateFeeAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "amountToCharge" DECIMAL(12,2),
    "maintenanceByDriverAmount" DECIMAL(12,2),
    "amountPaidWeek" DECIMAL(12,2),
    "openAmount" DECIMAL(12,2),
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_batchKey_key" ON "ImportBatch"("batchKey");

-- CreateIndex
CREATE INDEX "ImportBatch_kind_status_idx" ON "ImportBatch"("kind", "status");

-- CreateIndex
CREATE INDEX "ImportBatch_startedAt_idx" ON "ImportBatch"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_normalizedName_key" ON "Investor"("normalizedName");

-- CreateIndex
CREATE INDEX "Investor_displayName_idx" ON "Investor"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_normalizedName_key" ON "Driver"("normalizedName");

-- CreateIndex
CREATE INDEX "Driver_displayName_idx" ON "Driver"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalSnapshot_rowHash_key" ON "OperationalSnapshot"("rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalSnapshot_sourceFileId_sheetName_sourceRowNumber_key" ON "OperationalSnapshot"("sourceFileId", "sheetName", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_sourceFileId_referenceDate_idx" ON "OperationalSnapshot"("sourceFileId", "referenceDate");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_importBatchId_idx" ON "OperationalSnapshot"("importBatchId");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_investorId_referenceDate_idx" ON "OperationalSnapshot"("investorId", "referenceDate");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_vehicleId_referenceDate_idx" ON "OperationalSnapshot"("vehicleId", "referenceDate");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_driverId_referenceDate_idx" ON "OperationalSnapshot"("driverId", "referenceDate");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_plate_referenceDate_idx" ON "OperationalSnapshot"("plate", "referenceDate");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_referenceYear_referenceMonth_weekOfMonth_idx" ON "OperationalSnapshot"("referenceYear", "referenceMonth", "weekOfMonth");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_paymentState_idx" ON "OperationalSnapshot"("paymentState");

-- CreateIndex
CREATE INDEX "OperationalSnapshot_operationalKey_idx" ON "OperationalSnapshot"("operationalKey");

-- CreateIndex
CREATE INDEX "SourceFile_importBatchId_idx" ON "SourceFile"("importBatchId");

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSnapshot" ADD CONSTRAINT "OperationalSnapshot_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSnapshot" ADD CONSTRAINT "OperationalSnapshot_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSnapshot" ADD CONSTRAINT "OperationalSnapshot_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSnapshot" ADD CONSTRAINT "OperationalSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSnapshot" ADD CONSTRAINT "OperationalSnapshot_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
