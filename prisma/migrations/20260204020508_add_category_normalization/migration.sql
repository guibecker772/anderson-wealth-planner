-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('EXACT', 'CONTAINS', 'REGEX');

-- CreateEnum
CREATE TYPE "NormalizationScope" AS ENUM ('EXPENSE', 'INCOME', 'BOTH');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('RAW', 'NORMALIZED', 'MANUAL');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "categorySource" "CategorySource" NOT NULL DEFAULT 'RAW',
ADD COLUMN     "normalizedAt" TIMESTAMP(3),
ADD COLUMN     "normalizedByRuleId" TEXT,
ADD COLUMN     "rawLabel" TEXT;

-- CreateTable
CREATE TABLE "CategoryNormalizationRule" (
    "id" TEXT NOT NULL,
    "fromPattern" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL DEFAULT 'CONTAINS',
    "scope" "NormalizationScope" NOT NULL DEFAULT 'BOTH',
    "toCategory" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryNormalizationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryNormalizationRule_active_scope_idx" ON "CategoryNormalizationRule"("active", "scope");

-- CreateIndex
CREATE INDEX "CategoryNormalizationRule_priority_idx" ON "CategoryNormalizationRule"("priority");

-- CreateIndex
CREATE INDEX "Transaction_categorySource_idx" ON "Transaction"("categorySource");

-- CreateIndex
CREATE INDEX "Transaction_normalizedByRuleId_idx" ON "Transaction"("normalizedByRuleId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_normalizedByRuleId_fkey" FOREIGN KEY ("normalizedByRuleId") REFERENCES "CategoryNormalizationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
