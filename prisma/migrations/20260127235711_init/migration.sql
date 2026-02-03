-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SETTLED');

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "modifiedTime" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT,
    "processedAt" TIMESTAMP(3),
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "externalId" TEXT,
    "category" TEXT,
    "counterparty" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "plannedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "plannedAmount" DECIMAL(12,2) NOT NULL,
    "actualAmount" DECIMAL(12,2),
    "feesInterest" DECIMAL(12,2),
    "feesFine" DECIMAL(12,2),
    "discount" DECIMAL(12,2),
    "grossAmount" DECIMAL(12,2),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_driveFileId_key" ON "SourceFile"("driveFileId");

-- CreateIndex
CREATE INDEX "Transaction_externalId_idx" ON "Transaction"("externalId");

-- CreateIndex
CREATE INDEX "Transaction_type_dueDate_idx" ON "Transaction"("type", "dueDate");

-- CreateIndex
CREATE INDEX "Transaction_type_actualDate_idx" ON "Transaction"("type", "actualDate");

-- CreateIndex
CREATE INDEX "Transaction_sourceFileId_idx" ON "Transaction"("sourceFileId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
