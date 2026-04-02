-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INVESTOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INVESTOR',
    "investorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_investorId_idx" ON "User"("investorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FineResponsibility_sourceFileId_sourceSheetName_sourceRowNumber" RENAME TO "FineResponsibility_sourceFileId_sourceSheetName_sourceRowNu_key";

-- RenameIndex
ALTER INDEX "OperationalSnapshot_referenceYear_referenceMonth_weekOfMonth_id" RENAME TO "OperationalSnapshot_referenceYear_referenceMonth_weekOfMont_idx";
