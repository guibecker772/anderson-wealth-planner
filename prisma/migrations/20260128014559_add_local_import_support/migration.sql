/*
  Warnings:

  - A unique constraint covering the columns `[rowHash]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('DRIVE', 'LOCAL');

-- AlterTable
ALTER TABLE "SourceFile" ADD COLUMN     "source" "SourceType" NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "rowHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_rowHash_key" ON "Transaction"("rowHash");
