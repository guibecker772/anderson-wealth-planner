-- CreateEnum
CREATE TYPE "DriveSyncRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DriveSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED_LOCKED');

-- CreateEnum
CREATE TYPE "DriveSyncExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'SKIPPED_ALREADY_PROCESSED', 'SKIPPED_LOCKED', 'DEFERRED_STABILITY', 'FAILED');

-- AlterTable
ALTER TABLE "DriveImportFolder"
ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAlertedAt" TIMESTAMP(3),
ADD COLUMN "lastRunFinishedAt" TIMESTAMP(3),
ADD COLUMN "lastRunStatus" "DriveSyncRunStatus",
ADD COLUMN "syncLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "syncLeaseToken" TEXT;

-- CreateTable
CREATE TABLE "DriveSyncRun" (
    "id" TEXT NOT NULL,
    "driveImportFolderId" TEXT NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "trigger" "DriveSyncRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "status" "DriveSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "filesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "filesImported" INTEGER NOT NULL DEFAULT 0,
    "filesSkipped" INTEGER NOT NULL DEFAULT 0,
    "filesErrored" INTEGER NOT NULL DEFAULT 0,
    "filesDeferred" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveSyncExecution" (
    "id" TEXT NOT NULL,
    "driveImportFolderId" TEXT NOT NULL,
    "driveSyncRunId" TEXT,
    "externalFileId" TEXT NOT NULL,
    "externalModifiedTime" TIMESTAMP(3) NOT NULL,
    "fileName" TEXT NOT NULL,
    "checksumHint" TEXT,
    "status" "DriveSyncExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "stableAfter" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "importBatchId" TEXT,
    "importFileId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveSyncExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveImportFolder_syncLeaseExpiresAt_idx" ON "DriveImportFolder"("syncLeaseExpiresAt");

-- CreateIndex
CREATE INDEX "DriveSyncRun_driveImportFolderId_startedAt_idx" ON "DriveSyncRun"("driveImportFolderId", "startedAt");

-- CreateIndex
CREATE INDEX "DriveSyncRun_status_startedAt_idx" ON "DriveSyncRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriveSyncExecution_externalFileId_externalModifiedTime_key" ON "DriveSyncExecution"("externalFileId", "externalModifiedTime");

-- CreateIndex
CREATE INDEX "DriveSyncExecution_driveImportFolderId_status_idx" ON "DriveSyncExecution"("driveImportFolderId", "status");

-- CreateIndex
CREATE INDEX "DriveSyncExecution_driveSyncRunId_idx" ON "DriveSyncExecution"("driveSyncRunId");

-- CreateIndex
CREATE INDEX "DriveSyncExecution_leaseExpiresAt_idx" ON "DriveSyncExecution"("leaseExpiresAt");

-- AddForeignKey
ALTER TABLE "DriveSyncRun" ADD CONSTRAINT "DriveSyncRun_driveImportFolderId_fkey" FOREIGN KEY ("driveImportFolderId") REFERENCES "DriveImportFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSyncExecution" ADD CONSTRAINT "DriveSyncExecution_driveImportFolderId_fkey" FOREIGN KEY ("driveImportFolderId") REFERENCES "DriveImportFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSyncExecution" ADD CONSTRAINT "DriveSyncExecution_driveSyncRunId_fkey" FOREIGN KEY ("driveSyncRunId") REFERENCES "DriveSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
