import { randomUUID } from 'crypto';

import {
  DriveSyncExecutionStatus,
  DriveSyncRunStatus,
  DriveSyncRunTrigger,
  ImportBatchKind,
  ImportMode,
  ImportPipelineStatus,
  Prisma,
  SourceType,
  type DriveImportFolder,
  type DriveSyncExecution,
} from '@prisma/client';

import { db } from '@/lib/db';

import { listDriveImportFolders } from './driveFolders';
import { downloadGoogleDriveFile, listGoogleDriveFolderFiles, type GoogleDriveFileDescriptor } from './googleDrive';
import { stageWorkbookImport } from './ingestion';

type JsonRecord = Record<string, unknown>;
type LogLevel = 'info' | 'warn' | 'error';

export interface DriveSyncFileResult {
  fileId: string;
  fileName: string;
  folderId: string;
  modifiedTime: string;
  checksumHint: string | null;
  status: 'IMPORTED' | 'SKIPPED' | 'ERROR' | 'DEFERRED' | 'LOCKED';
  message: string;
  batchId: string | null;
  fileRecordId: string | null;
  reusedExistingFile: boolean;
}

export interface DriveSyncSummary {
  ok: boolean;
  syncedFolders: number;
  importedFiles: number;
  skippedFiles: number;
  deferredFiles: number;
  lockedFolders: number;
  lockedFiles: number;
  retriedOperations: number;
  alertsRaised: number;
  errors: Array<{ folderId: string; message: string }>;
  files: DriveSyncFileResult[];
}

type RetryResult<T> = {
  value: T;
  retries: number;
};

type FileClaimResult =
  | { kind: 'CLAIMED'; execution: Pick<DriveSyncExecution, 'id' | 'attempts' | 'retryCount'> }
  | { kind: 'ALREADY_DONE'; executionId: string; importBatchId: string | null; importFileId: string | null }
  | { kind: 'LOCKED'; executionId: string };

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function buildDrivePath(folderId: string, fileId: string): string {
  return `gdrive://${folderId}/${fileId}`;
}

function mergeJson(base: unknown, patch: JsonRecord): Prisma.InputJsonValue {
  return {
    ...asRecord(base),
    ...patch,
  } as Prisma.InputJsonObject;
}

function withSafetyWindow(date: Date | null | undefined): Date | null {
  if (!date) return null;
  return new Date(date.getTime() - 60_000);
}

function leaseMs(): number {
  return envInt('DRIVE_SYNC_LEASE_SECONDS', 900) * 1000;
}

function stabilityMs(): number {
  return envInt('DRIVE_SYNC_STABILITY_SECONDS', 300) * 1000;
}

function maxAttempts(): number {
  return envInt('DRIVE_SYNC_MAX_ATTEMPTS', 3);
}

function baseRetryDelayMs(): number {
  return envInt('DRIVE_SYNC_RETRY_BASE_MS', 1500);
}

function alertThreshold(): number {
  return envInt('DRIVE_SYNC_ALERT_FAILURE_THRESHOLD', 3);
}

function alertCooldownMs(): number {
  return envInt('DRIVE_SYNC_ALERT_COOLDOWN_SECONDS', 21600) * 1000;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const code = String((error as Error & { code?: string }).code || '').toUpperCase();
  const status = Number((error as Error & { status?: number; code?: string | number }).status || (error as Error & { code?: string | number }).code);

  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNABORTED'].includes(code)) return true;
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;

  return ['timeout', 'timed out', 'rate limit', 'quota', 'temporar', 'network', 'socket hang up', '503', '502', '500']
    .some((token) => message.includes(token));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logDriveSync(level: LogLevel, event: string, context: JsonRecord) {
  const payload = {
    scope: 'drive-sync',
    event,
    at: new Date().toISOString(),
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

function computeStableAfter(modifiedTime: string): Date {
  return new Date(new Date(modifiedTime).getTime() + stabilityMs());
}

function isStableForProcessing(modifiedTime: string): boolean {
  return computeStableAfter(modifiedTime).getTime() <= Date.now();
}

async function findExistingDriveVersion(fileId: string, modifiedTime: Date) {
  return db.importFile.findFirst({
    where: {
      source: SourceType.DRIVE,
      externalFileId: fileId,
      externalModifiedTime: modifiedTime,
    },
    select: {
      id: true,
      importBatchId: true,
      checksum: true,
    },
  });
}

async function createDriveImportBatch(params: {
  folderId: string;
  folderLabel: string;
  driveImportFolderId: string;
  sharedDriveId?: string | null;
  runId: string;
}) {
  const startedAt = new Date();
  return db.importBatch.create({
    data: {
      batchKey: `drive:${params.folderId}:${startedAt.toISOString()}`,
      kind: ImportBatchKind.WORKBOOK_MULTI_SHEET,
      status: 'PENDING',
      pipelineStatus: ImportPipelineStatus.UPLOADED,
      startedAt,
      details: {
        provider: 'GOOGLE_DRIVE',
        driveImportFolderId: params.driveImportFolderId,
        folderId: params.folderId,
        folderLabel: params.folderLabel,
        sharedDriveId: params.sharedDriveId || null,
        driveSyncRunId: params.runId,
      },
    },
    select: { id: true },
  });
}

async function enrichDriveImportedFile(params: {
  fileRecordId: string;
  driveImportFolderId: string;
  batchId: string;
  runId: string;
  descriptor: GoogleDriveFileDescriptor;
}) {
  const existing = await db.importFile.findUnique({
    where: { id: params.fileRecordId },
    select: { details: true },
  });

  await db.importFile.update({
    where: { id: params.fileRecordId },
    data: {
      driveImportFolderId: params.driveImportFolderId,
      externalFileId: params.descriptor.id,
      externalModifiedTime: new Date(params.descriptor.modifiedTime),
      originalPath: buildDrivePath(params.descriptor.parents[0] || 'unknown', params.descriptor.id),
      details: mergeJson(existing?.details, {
        provider: 'GOOGLE_DRIVE',
        driveFileId: params.descriptor.id,
        driveModifiedTime: params.descriptor.modifiedTime,
        driveMd5Checksum: params.descriptor.md5Checksum,
        driveId: params.descriptor.driveId,
        parents: params.descriptor.parents,
        importBatchId: params.batchId,
        driveSyncRunId: params.runId,
      }),
    },
  });
}

async function withRetries<T>(params: {
  label: string;
  folderId: string;
  fileId?: string;
  maxAttempts: number;
  execute: (attempt: number) => Promise<T>;
}): Promise<RetryResult<T>> {
  let retries = 0;

  for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
    try {
      const value = await params.execute(attempt);
      return { value, retries };
    } catch (error: unknown) {
      const retryable = attempt < params.maxAttempts && isRetryableError(error);
      if (!retryable) throw error;

      retries += 1;
      const delay = baseRetryDelayMs() * 2 ** (attempt - 1);
      logDriveSync('warn', 'retry_scheduled', {
        label: params.label,
        folderId: params.folderId,
        fileId: params.fileId || null,
        attempt,
        nextDelayMs: delay,
        message: error instanceof Error ? error.message : 'retryable error',
      });
      await sleep(delay);
    }
  }

  throw new Error('Retry loop ended unexpectedly');
}

async function acquireFolderLease(folderId: string, leaseToken: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs());
  const result = await db.driveImportFolder.updateMany({
    where: {
      id: folderId,
      enabled: true,
      OR: [
        { syncLeaseExpiresAt: null },
        { syncLeaseExpiresAt: { lt: now } },
        { syncLeaseToken: leaseToken },
      ],
    },
    data: {
      syncLeaseToken: leaseToken,
      syncLeaseExpiresAt: expiresAt,
    },
  });

  return result.count > 0;
}

async function renewFolderLease(folderId: string, leaseToken: string) {
  await db.driveImportFolder.updateMany({
    where: { id: folderId, syncLeaseToken: leaseToken },
    data: {
      syncLeaseExpiresAt: new Date(Date.now() + leaseMs()),
    },
  });
}

async function releaseFolderLease(folderId: string, leaseToken: string) {
  await db.driveImportFolder.updateMany({
    where: { id: folderId, syncLeaseToken: leaseToken },
    data: {
      syncLeaseToken: null,
      syncLeaseExpiresAt: null,
    },
  });
}

async function createDriveSyncRun(params: {
  driveImportFolderId: string;
  leaseToken: string;
  trigger: DriveSyncRunTrigger;
}) {
  return db.driveSyncRun.create({
    data: {
      driveImportFolderId: params.driveImportFolderId,
      leaseToken: params.leaseToken,
      trigger: params.trigger,
      status: DriveSyncRunStatus.RUNNING,
    },
    select: { id: true },
  });
}

async function finalizeDriveSyncRun(params: {
  runId: string;
  status: DriveSyncRunStatus;
  filesDiscovered: number;
  filesImported: number;
  filesSkipped: number;
  filesErrored: number;
  filesDeferred: number;
  retryCount: number;
  alertCount: number;
  errorMessage?: string | null;
  details?: JsonRecord;
}) {
  await db.driveSyncRun.update({
    where: { id: params.runId },
    data: {
      status: params.status,
      completedAt: new Date(),
      filesDiscovered: params.filesDiscovered,
      filesImported: params.filesImported,
      filesSkipped: params.filesSkipped,
      filesErrored: params.filesErrored,
      filesDeferred: params.filesDeferred,
      retryCount: params.retryCount,
      alertCount: params.alertCount,
      errorMessage: params.errorMessage || null,
      details: params.details ? (params.details as Prisma.InputJsonObject) : undefined,
    },
  });
}

async function claimFileExecution(params: {
  folder: DriveImportFolder;
  runId: string;
  leaseToken: string;
  descriptor: GoogleDriveFileDescriptor;
}): Promise<FileClaimResult> {
  const modifiedAt = new Date(params.descriptor.modifiedTime);
  const now = new Date();
  const existing = await db.driveSyncExecution.findUnique({
    where: {
      externalFileId_externalModifiedTime: {
        externalFileId: params.descriptor.id,
        externalModifiedTime: modifiedAt,
      },
    },
    select: {
      id: true,
      status: true,
      leaseToken: true,
      leaseExpiresAt: true,
      attempts: true,
      retryCount: true,
      importBatchId: true,
      importFileId: true,
    },
  });

  if (!existing) {
    try {
      const created = await db.driveSyncExecution.create({
        data: {
          driveImportFolderId: params.folder.id,
          driveSyncRunId: params.runId,
          externalFileId: params.descriptor.id,
          externalModifiedTime: modifiedAt,
          fileName: params.descriptor.name,
          checksumHint: params.descriptor.md5Checksum,
          status: DriveSyncExecutionStatus.RUNNING,
          leaseToken: params.leaseToken,
          leaseExpiresAt: new Date(now.getTime() + leaseMs()),
          details: {
            driveId: params.descriptor.driveId,
            parents: params.descriptor.parents,
          },
        },
        select: {
          id: true,
          attempts: true,
          retryCount: true,
        },
      });

      return { kind: 'CLAIMED', execution: created };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return claimFileExecution(params);
      }
      throw error;
    }
  }

  if (
    existing.status === DriveSyncExecutionStatus.SUCCEEDED ||
    existing.status === DriveSyncExecutionStatus.SKIPPED_ALREADY_PROCESSED
  ) {
    return {
      kind: 'ALREADY_DONE',
      executionId: existing.id,
      importBatchId: existing.importBatchId,
      importFileId: existing.importFileId,
    };
  }

  if (
    existing.status === DriveSyncExecutionStatus.RUNNING &&
    existing.leaseExpiresAt &&
    existing.leaseExpiresAt > now &&
    existing.leaseToken !== params.leaseToken
  ) {
    return { kind: 'LOCKED', executionId: existing.id };
  }

  const claimed = await db.driveSyncExecution.updateMany({
    where: {
      id: existing.id,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
        { leaseToken: params.leaseToken },
      ],
    },
    data: {
      driveImportFolderId: params.folder.id,
      driveSyncRunId: params.runId,
      fileName: params.descriptor.name,
      checksumHint: params.descriptor.md5Checksum,
      status: DriveSyncExecutionStatus.RUNNING,
      leaseToken: params.leaseToken,
      leaseExpiresAt: new Date(now.getTime() + leaseMs()),
      stableAfter: null,
      completedAt: null,
      errorMessage: null,
      importBatchId: null,
      importFileId: null,
    },
  });

  if (claimed.count === 0) {
    return { kind: 'LOCKED', executionId: existing.id };
  }

  return {
    kind: 'CLAIMED',
    execution: {
      id: existing.id,
      attempts: existing.attempts,
      retryCount: existing.retryCount,
    },
  };
}

async function markExecutionDeferred(params: {
  folderId: string;
  runId: string;
  descriptor: GoogleDriveFileDescriptor;
  stableAfter: Date;
  message: string;
}) {
  const modifiedAt = new Date(params.descriptor.modifiedTime);
  await db.driveSyncExecution.upsert({
    where: {
      externalFileId_externalModifiedTime: {
        externalFileId: params.descriptor.id,
        externalModifiedTime: modifiedAt,
      },
    },
    update: {
      driveImportFolderId: params.folderId,
      driveSyncRunId: params.runId,
      fileName: params.descriptor.name,
      checksumHint: params.descriptor.md5Checksum,
      status: DriveSyncExecutionStatus.DEFERRED_STABILITY,
      stableAfter: params.stableAfter,
      completedAt: null,
      errorMessage: params.message,
      details: {
        driveId: params.descriptor.driveId,
        parents: params.descriptor.parents,
      },
    },
    create: {
      driveImportFolderId: params.folderId,
      driveSyncRunId: params.runId,
      externalFileId: params.descriptor.id,
      externalModifiedTime: modifiedAt,
      fileName: params.descriptor.name,
      checksumHint: params.descriptor.md5Checksum,
      status: DriveSyncExecutionStatus.DEFERRED_STABILITY,
      stableAfter: params.stableAfter,
      errorMessage: params.message,
      details: {
        driveId: params.descriptor.driveId,
        parents: params.descriptor.parents,
      },
    },
  });
}

async function markExecutionAttempt(executionId: string, leaseToken: string) {
  await db.driveSyncExecution.update({
    where: { id: executionId },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      leaseToken,
      leaseExpiresAt: new Date(Date.now() + leaseMs()),
    },
  });
}

async function incrementExecutionRetry(executionId: string) {
  await db.driveSyncExecution.update({
    where: { id: executionId },
    data: {
      retryCount: { increment: 1 },
    },
  });
}

async function markExecutionSuccess(params: {
  executionId: string;
  importBatchId: string | null;
  importFileId: string | null;
  status: DriveSyncExecutionStatus;
  details?: JsonRecord;
}) {
  await db.driveSyncExecution.update({
    where: { id: params.executionId },
    data: {
      status: params.status,
      importBatchId: params.importBatchId,
      importFileId: params.importFileId,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage: null,
      details: params.details ? (params.details as Prisma.InputJsonObject) : undefined,
    },
  });
}

async function markExecutionFailure(params: {
  executionId: string;
  message: string;
  details?: JsonRecord;
}) {
  await db.driveSyncExecution.update({
    where: { id: params.executionId },
    data: {
      status: DriveSyncExecutionStatus.FAILED,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage: params.message,
      details: params.details ? (params.details as Prisma.InputJsonObject) : undefined,
    },
  });
}

async function maybeRaiseFolderAlert(params: {
  folder: DriveImportFolder;
  failureMessage: string;
  runId: string;
}) {
  const now = new Date();
  const nextFailureCount = (params.folder.consecutiveFailures || 0) + 1;
  const shouldAlert =
    nextFailureCount >= alertThreshold() &&
    (!params.folder.lastAlertedAt || now.getTime() - params.folder.lastAlertedAt.getTime() >= alertCooldownMs());

  await db.driveImportFolder.update({
    where: { id: params.folder.id },
    data: {
      consecutiveFailures: nextFailureCount,
      errorMessage: params.failureMessage,
      lastRunStatus: DriveSyncRunStatus.FAILED,
      lastRunFinishedAt: now,
      lastAlertedAt: shouldAlert ? now : undefined,
    },
  });

  if (shouldAlert) {
    logDriveSync('error', 'folder_alert', {
      folderId: params.folder.folderId,
      driveImportFolderId: params.folder.id,
      runId: params.runId,
      consecutiveFailures: nextFailureCount,
      message: params.failureMessage,
    });
  }

  return shouldAlert;
}

async function markFolderSuccess(params: {
  folder: DriveImportFolder;
  status: DriveSyncRunStatus;
  latestSeen: GoogleDriveFileDescriptor | null;
}) {
  await db.driveImportFolder.update({
    where: { id: params.folder.id },
    data: {
      lastScannedAt: new Date(),
      lastSuccessfulSyncAt: params.status === DriveSyncRunStatus.FAILED ? params.folder.lastSuccessfulSyncAt : new Date(),
      lastSeenModifiedTime: params.latestSeen ? new Date(params.latestSeen.modifiedTime) : params.folder.lastSeenModifiedTime,
      lastSeenFileId: params.latestSeen?.id || params.folder.lastSeenFileId,
      consecutiveFailures: 0,
      errorMessage: null,
      lastRunStatus: params.status,
      lastRunFinishedAt: new Date(),
    },
  });
}

async function syncDriveFile(params: {
  folder: DriveImportFolder;
  runId: string;
  folderLeaseToken: string;
  descriptor: GoogleDriveFileDescriptor;
  ensureBatch: () => Promise<string>;
}): Promise<{ result: DriveSyncFileResult; retries: number }> {
  const modifiedTime = new Date(params.descriptor.modifiedTime);
  const stableAfter = computeStableAfter(params.descriptor.modifiedTime);

  if (!isStableForProcessing(params.descriptor.modifiedTime)) {
    const message = `Arquivo ainda em janela de estabilidade ate ${stableAfter.toISOString()}`;
    await markExecutionDeferred({
      folderId: params.folder.id,
      runId: params.runId,
      descriptor: params.descriptor,
      stableAfter,
      message,
    });
    logDriveSync('info', 'file_deferred', {
      folderId: params.folder.folderId,
      fileId: params.descriptor.id,
      modifiedTime: params.descriptor.modifiedTime,
      stableAfter: stableAfter.toISOString(),
    });
    return {
      retries: 0,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: 'DEFERRED',
        message,
        batchId: null,
        fileRecordId: null,
        reusedExistingFile: false,
      },
    };
  }

  const claim = await claimFileExecution({
    folder: params.folder,
    runId: params.runId,
    leaseToken: params.folderLeaseToken,
    descriptor: params.descriptor,
  });

  if (claim.kind === 'ALREADY_DONE') {
    return {
      retries: 0,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: 'SKIPPED',
        message: 'Arquivo do Drive ja concluido anteriormente',
        batchId: claim.importBatchId,
        fileRecordId: claim.importFileId,
        reusedExistingFile: true,
      },
    };
  }

  if (claim.kind === 'LOCKED') {
    logDriveSync('warn', 'file_locked', {
      folderId: params.folder.folderId,
      fileId: params.descriptor.id,
      executionId: claim.executionId,
    });
    return {
      retries: 0,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: 'LOCKED',
        message: 'Arquivo em processamento por outra execucao',
        batchId: null,
        fileRecordId: null,
        reusedExistingFile: false,
      },
    };
  }

  const existingVersion = await findExistingDriveVersion(params.descriptor.id, modifiedTime);
  if (existingVersion) {
    await markExecutionSuccess({
      executionId: claim.execution.id,
      importBatchId: existingVersion.importBatchId,
      importFileId: existingVersion.id,
      status: DriveSyncExecutionStatus.SKIPPED_ALREADY_PROCESSED,
      details: {
        checksum: existingVersion.checksum,
      },
    });

    return {
      retries: 0,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: 'SKIPPED',
        message: 'Arquivo do Drive ja processado nesta versao',
        batchId: existingVersion.importBatchId,
        fileRecordId: existingVersion.id,
        reusedExistingFile: true,
      },
    };
  }

  try {
    const retried = await withRetries({
      label: 'download_and_stage_drive_file',
      folderId: params.folder.folderId,
      fileId: params.descriptor.id,
      maxAttempts: maxAttempts(),
      execute: async (attempt) => {
        await renewFolderLease(params.folder.id, params.folderLeaseToken);
        await markExecutionAttempt(claim.execution.id, params.folderLeaseToken);
        if (attempt > 1) {
          await incrementExecutionRetry(claim.execution.id);
        }

        const buffer = await downloadGoogleDriveFile(params.descriptor.id);
        const batchId = await params.ensureBatch();
        const staged = await stageWorkbookImport({
          fileName: params.descriptor.name,
          buffer,
          importMode: ImportMode.AUTO_FOLDER,
          source: SourceType.DRIVE,
          originalPath: buildDrivePath(params.folder.folderId, params.descriptor.id),
          importBatchId: batchId,
        });

        await enrichDriveImportedFile({
          fileRecordId: staged.fileId,
          driveImportFolderId: params.folder.id,
          batchId,
          runId: params.runId,
          descriptor: params.descriptor,
        });

        return {
          batchId,
          staged,
        };
      },
    });

    await markExecutionSuccess({
      executionId: claim.execution.id,
      importBatchId: retried.value.staged.batchId,
      importFileId: retried.value.staged.fileId,
      status: retried.value.staged.reusedExistingFile
        ? DriveSyncExecutionStatus.SKIPPED_ALREADY_PROCESSED
        : DriveSyncExecutionStatus.SUCCEEDED,
      details: {
        validatedRows: retried.value.staged.validatedRows,
        rejectedRows: retried.value.staged.rejectedRows,
        warningCount: retried.value.staged.warningCount,
        errorCount: retried.value.staged.errorCount,
      },
    });

    return {
      retries: retried.retries,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: retried.value.staged.reusedExistingFile ? 'SKIPPED' : 'IMPORTED',
        message: retried.value.staged.reusedExistingFile
          ? 'Conteudo ja existente no staging'
          : `${retried.value.staged.validatedRows} linha(s) validada(s) em staging`,
        batchId: retried.value.staged.batchId,
        fileRecordId: retried.value.staged.fileId,
        reusedExistingFile: retried.value.staged.reusedExistingFile,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao importar arquivo do Drive';
    await markExecutionFailure({
      executionId: claim.execution.id,
      message,
      details: {
        driveId: params.descriptor.driveId,
        parents: params.descriptor.parents,
      },
    });

    return {
      retries: 0,
      result: {
        fileId: params.descriptor.id,
        fileName: params.descriptor.name,
        folderId: params.folder.folderId,
        modifiedTime: params.descriptor.modifiedTime,
        checksumHint: params.descriptor.md5Checksum,
        status: 'ERROR',
        message,
        batchId: null,
        fileRecordId: null,
        reusedExistingFile: false,
      },
    };
  }
}

export async function syncGoogleDriveImports(options?: {
  driveImportFolderId?: string | null;
  trigger?: DriveSyncRunTrigger;
}): Promise<DriveSyncSummary> {
  const folders = (await listDriveImportFolders()).filter((folder) => folder.enabled);
  const targetFolders = options?.driveImportFolderId
    ? folders.filter((folder) => folder.id === options.driveImportFolderId)
    : folders;

  const trigger = options?.trigger || DriveSyncRunTrigger.SCHEDULED;
  const summary: DriveSyncSummary = {
    ok: true,
    syncedFolders: 0,
    importedFiles: 0,
    skippedFiles: 0,
    deferredFiles: 0,
    lockedFolders: 0,
    lockedFiles: 0,
    retriedOperations: 0,
    alertsRaised: 0,
    errors: [],
    files: [],
  };

  for (const folder of targetFolders) {
    const folderLeaseToken = randomUUID();
    const locked = await acquireFolderLease(folder.id, folderLeaseToken);

    if (!locked) {
      summary.lockedFolders += 1;
      logDriveSync('warn', 'folder_locked', {
        folderId: folder.folderId,
        driveImportFolderId: folder.id,
      });
      continue;
    }

    const run = await createDriveSyncRun({
      driveImportFolderId: folder.id,
      leaseToken: folderLeaseToken,
      trigger,
    });

    let latestSeen: GoogleDriveFileDescriptor | null = null;
    let folderImported = 0;
    let folderSkipped = 0;
    let folderErrors = 0;
    let folderDeferred = 0;
    let folderRetries = 0;
    let folderAlertCount = 0;
    let discovered = 0;

    try {
      logDriveSync('info', 'folder_sync_started', {
        folderId: folder.folderId,
        driveImportFolderId: folder.id,
        runId: run.id,
        trigger,
      });

      const filesResult = await withRetries({
        label: 'list_drive_folder_files',
        folderId: folder.folderId,
        maxAttempts: maxAttempts(),
        execute: async () => {
          await renewFolderLease(folder.id, folderLeaseToken);
          return listGoogleDriveFolderFiles({
            folderId: folder.folderId,
            sharedDriveId: folder.sharedDriveId,
            modifiedAfter: withSafetyWindow(folder.lastSeenModifiedTime),
          });
        },
      });
      const files = filesResult.value;
      summary.retriedOperations += filesResult.retries;
      folderRetries += filesResult.retries;
      discovered = files.length;

      let batchId: string | null = null;
      const ensureBatch = async () => {
        if (batchId) return batchId;
        const batch = await createDriveImportBatch({
          folderId: folder.folderId,
          folderLabel: folder.label,
          driveImportFolderId: folder.id,
          sharedDriveId: folder.sharedDriveId,
          runId: run.id,
        });
        batchId = batch.id;
        return batchId;
      };

      for (const file of files) {
        await renewFolderLease(folder.id, folderLeaseToken);
        if (!latestSeen || new Date(file.modifiedTime) > new Date(latestSeen.modifiedTime)) {
          latestSeen = file;
        }

        const synced = await syncDriveFile({
          folder,
          runId: run.id,
          folderLeaseToken,
          descriptor: file,
          ensureBatch,
        });
        summary.retriedOperations += synced.retries;
        folderRetries += synced.retries;
        summary.files.push(synced.result);

        if (synced.result.status === 'ERROR') {
          folderErrors += 1;
          summary.ok = false;
          summary.errors.push({ folderId: folder.folderId, message: synced.result.message });
          logDriveSync('error', 'file_sync_failed', {
            folderId: folder.folderId,
            runId: run.id,
            fileId: synced.result.fileId,
            message: synced.result.message,
          });
        } else if (synced.result.status === 'LOCKED') {
          summary.lockedFiles += 1;
          folderSkipped += 1;
        } else if (synced.result.status === 'DEFERRED') {
          summary.deferredFiles += 1;
          folderDeferred += 1;
        } else if (synced.result.status === 'SKIPPED') {
          summary.skippedFiles += 1;
          folderSkipped += 1;
        } else {
          summary.importedFiles += 1;
          folderImported += 1;
          logDriveSync('info', 'file_sync_succeeded', {
            folderId: folder.folderId,
            runId: run.id,
            fileId: synced.result.fileId,
            batchId: synced.result.batchId,
            fileRecordId: synced.result.fileRecordId,
          });
        }
      }

      const runStatus =
        folderErrors > 0 ? DriveSyncRunStatus.PARTIAL : DriveSyncRunStatus.SUCCEEDED;

      await finalizeDriveSyncRun({
        runId: run.id,
        status: runStatus,
        filesDiscovered: discovered,
        filesImported: folderImported,
        filesSkipped: folderSkipped,
        filesErrored: folderErrors,
        filesDeferred: folderDeferred,
        retryCount: folderRetries,
        alertCount: folderAlertCount,
        details: {
          folderId: folder.folderId,
          sharedDriveId: folder.sharedDriveId,
          batchId,
        },
      });

      await markFolderSuccess({
        folder,
        status: runStatus,
        latestSeen,
      });

      summary.syncedFolders += 1;
      logDriveSync('info', 'folder_sync_finished', {
        folderId: folder.folderId,
        runId: run.id,
        status: runStatus,
        discovered,
        imported: folderImported,
        skipped: folderSkipped,
        deferred: folderDeferred,
        errors: folderErrors,
        retries: folderRetries,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar pasta do Drive';
      const alertRaised = await maybeRaiseFolderAlert({
        folder,
        failureMessage: message,
        runId: run.id,
      });
      folderAlertCount += alertRaised ? 1 : 0;
      summary.alertsRaised += alertRaised ? 1 : 0;
      summary.ok = false;
      summary.errors.push({ folderId: folder.folderId, message });

      await finalizeDriveSyncRun({
        runId: run.id,
        status: DriveSyncRunStatus.FAILED,
        filesDiscovered: discovered,
        filesImported: folderImported,
        filesSkipped: folderSkipped,
        filesErrored: folderErrors + 1,
        filesDeferred: folderDeferred,
        retryCount: folderRetries,
        alertCount: folderAlertCount,
        errorMessage: message,
        details: {
          folderId: folder.folderId,
          sharedDriveId: folder.sharedDriveId,
        },
      });
    } finally {
      await releaseFolderLease(folder.id, folderLeaseToken);
    }
  }

  return summary;
}
