CREATE TYPE "ImportMode" AS ENUM ('AUTO_FOLDER', 'MANUAL_UPLOAD');

CREATE TYPE "SourceFileKind" AS ENUM ('OPERATIONAL', 'FINES', 'UNKNOWN');

ALTER TABLE "SourceFile"
ADD COLUMN "importMode" "ImportMode" NOT NULL DEFAULT 'AUTO_FOLDER',
ADD COLUMN "kind" "SourceFileKind" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "originalPath" TEXT,
ADD COLUMN "totalRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "importedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "skippedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "details" JSONB;

CREATE INDEX "SourceFile_importMode_idx" ON "SourceFile"("importMode");
CREATE INDEX "SourceFile_kind_idx" ON "SourceFile"("kind");
CREATE INDEX "SourceFile_processedAt_idx" ON "SourceFile"("processedAt");
