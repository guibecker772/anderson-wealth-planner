CREATE TYPE "ImportPipelineStatus" AS ENUM ('UPLOADED', 'PARSED', 'VALIDATED', 'REJECTED', 'PUBLISHED');
CREATE TYPE "ImportRecordType" AS ENUM ('OPERATIONAL_SNAPSHOT', 'FINANCIAL_ENTRY', 'FINE_RECORD', 'FINE_RESPONSIBILITY', 'RECONCILIATION', 'UNSUPPORTED');
CREATE TYPE "ImportRowKind" AS ENUM ('DETAIL', 'SECTION_LABEL', 'SUBTOTAL', 'RECONCILIATION', 'UNKNOWN');

ALTER TABLE "ImportBatch"
ADD COLUMN "pipelineStatus" "ImportPipelineStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN "parsedAt" TIMESTAMP(3),
ADD COLUMN "validatedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "uploadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fileCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "normalizedRowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "publishedRowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "templateVersion" TEXT,
ADD COLUMN "validationMessages" JSONB;

CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "status" "ImportPipelineStatus" NOT NULL DEFAULT 'UPLOADED',
    "name" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "fileExtension" TEXT,
    "kind" "SourceFileKind" NOT NULL DEFAULT 'UNKNOWN',
    "importMode" "ImportMode" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "source" "SourceType" NOT NULL DEFAULT 'LOCAL',
    "templateVersion" TEXT,
    "originalPath" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "parsedRows" INTEGER NOT NULL DEFAULT 0,
    "validatedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "publishedRows" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSheets" JSONB,
    "validationMessages" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRowRaw" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importFileId" TEXT NOT NULL,
    "status" "ImportPipelineStatus" NOT NULL DEFAULT 'PARSED',
    "recordType" "ImportRecordType" NOT NULL,
    "rowKind" "ImportRowKind" NOT NULL DEFAULT 'DETAIL',
    "sourceSheetName" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "headerFingerprint" TEXT,
    "rawLineKey" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "businessKey" TEXT,
    "rawPayload" JSONB NOT NULL,
    "validationMessages" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRowRaw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRowNormalized" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importFileId" TEXT NOT NULL,
    "importRowRawId" TEXT NOT NULL,
    "status" "ImportPipelineStatus" NOT NULL DEFAULT 'VALIDATED',
    "recordType" "ImportRecordType" NOT NULL,
    "rowKind" "ImportRowKind" NOT NULL DEFAULT 'DETAIL',
    "sourceSheetName" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "normalizedLineKey" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "businessKey" TEXT,
    "normalizationVersion" TEXT,
    "publishable" BOOLEAN NOT NULL DEFAULT false,
    "normalizedPayload" JSONB NOT NULL,
    "validationMessages" JSONB,
    "errorMessage" TEXT,
    "publishedRecordId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRowNormalized_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportFile_checksum_key" ON "ImportFile"("checksum");
CREATE INDEX "ImportFile_importBatchId_idx" ON "ImportFile"("importBatchId");
CREATE INDEX "ImportFile_status_idx" ON "ImportFile"("status");
CREATE INDEX "ImportFile_kind_idx" ON "ImportFile"("kind");
CREATE INDEX "ImportFile_uploadedAt_idx" ON "ImportFile"("uploadedAt");

CREATE UNIQUE INDEX "ImportRowRaw_rawLineKey_key" ON "ImportRowRaw"("rawLineKey");
CREATE UNIQUE INDEX "ImportRowRaw_importFileId_sourceSheetName_sourceRowNumber_key" ON "ImportRowRaw"("importFileId", "sourceSheetName", "sourceRowNumber");
CREATE INDEX "ImportRowRaw_importBatchId_idx" ON "ImportRowRaw"("importBatchId");
CREATE INDEX "ImportRowRaw_status_idx" ON "ImportRowRaw"("status");
CREATE INDEX "ImportRowRaw_recordType_idx" ON "ImportRowRaw"("recordType");
CREATE INDEX "ImportRowRaw_rowKind_idx" ON "ImportRowRaw"("rowKind");
CREATE INDEX "ImportRowRaw_dedupeKey_idx" ON "ImportRowRaw"("dedupeKey");
CREATE INDEX "ImportRowRaw_businessKey_idx" ON "ImportRowRaw"("businessKey");

CREATE UNIQUE INDEX "ImportRowNormalized_importRowRawId_key" ON "ImportRowNormalized"("importRowRawId");
CREATE UNIQUE INDEX "ImportRowNormalized_normalizedLineKey_key" ON "ImportRowNormalized"("normalizedLineKey");
CREATE INDEX "ImportRowNormalized_importBatchId_idx" ON "ImportRowNormalized"("importBatchId");
CREATE INDEX "ImportRowNormalized_status_idx" ON "ImportRowNormalized"("status");
CREATE INDEX "ImportRowNormalized_recordType_idx" ON "ImportRowNormalized"("recordType");
CREATE INDEX "ImportRowNormalized_rowKind_idx" ON "ImportRowNormalized"("rowKind");
CREATE INDEX "ImportRowNormalized_publishable_idx" ON "ImportRowNormalized"("publishable");
CREATE INDEX "ImportRowNormalized_dedupeKey_idx" ON "ImportRowNormalized"("dedupeKey");
CREATE INDEX "ImportRowNormalized_businessKey_idx" ON "ImportRowNormalized"("businessKey");

CREATE INDEX "ImportBatch_pipelineStatus_idx" ON "ImportBatch"("pipelineStatus");

ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRowRaw" ADD CONSTRAINT "ImportRowRaw_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRowRaw" ADD CONSTRAINT "ImportRowRaw_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRowNormalized" ADD CONSTRAINT "ImportRowNormalized_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRowNormalized" ADD CONSTRAINT "ImportRowNormalized_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRowNormalized" ADD CONSTRAINT "ImportRowNormalized_importRowRawId_fkey" FOREIGN KEY ("importRowRawId") REFERENCES "ImportRowRaw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
