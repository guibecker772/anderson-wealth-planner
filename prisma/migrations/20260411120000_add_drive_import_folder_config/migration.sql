-- CreateTable
CREATE TABLE "DriveImportFolder" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "sharedDriveId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "templateVersion" TEXT,
    "lastScannedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSeenModifiedTime" TIMESTAMP(3),
    "lastSeenFileId" TEXT,
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveImportFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ImportFile"
ADD COLUMN "driveImportFolderId" TEXT,
ADD COLUMN "externalFileId" TEXT,
ADD COLUMN "externalModifiedTime" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "DriveImportFolder_folderId_sharedDriveId_key" ON "DriveImportFolder"("folderId", "sharedDriveId");
CREATE INDEX "DriveImportFolder_enabled_updatedAt_idx" ON "DriveImportFolder"("enabled", "updatedAt");
CREATE INDEX "ImportFile_driveImportFolderId_idx" ON "ImportFile"("driveImportFolderId");
CREATE INDEX "ImportFile_externalFileId_idx" ON "ImportFile"("externalFileId");

-- AddForeignKey
ALTER TABLE "ImportFile"
ADD CONSTRAINT "ImportFile_driveImportFolderId_fkey"
FOREIGN KEY ("driveImportFolderId") REFERENCES "DriveImportFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
