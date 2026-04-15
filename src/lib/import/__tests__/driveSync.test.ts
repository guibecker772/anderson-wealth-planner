/** @jest-environment node */

jest.mock('../../db', () => ({
  db: {
    driveImportFolder: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    driveSyncRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    driveSyncExecution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    importBatch: {
      create: jest.fn(),
    },
    importFile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../googleDrive', () => ({
  listGoogleDriveFolderFiles: jest.fn(),
  downloadGoogleDriveFile: jest.fn(),
}));

jest.mock('../ingestion', () => ({
  stageWorkbookImport: jest.fn(),
}));

import { db } from '../../db';
import { downloadGoogleDriveFile, listGoogleDriveFolderFiles } from '../googleDrive';
import { stageWorkbookImport } from '../ingestion';
import { syncGoogleDriveImports } from '../driveSync';

const dbMock = db as unknown as {
  driveImportFolder: { findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  driveSyncRun: { create: jest.Mock; update: jest.Mock };
  driveSyncExecution: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    upsert: jest.Mock;
  };
  importBatch: { create: jest.Mock };
  importFile: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

const listFilesMock = listGoogleDriveFolderFiles as jest.Mock;
const downloadMock = downloadGoogleDriveFile as jest.Mock;
const stageMock = stageWorkbookImport as jest.Mock;

const baseFolder = {
  id: 'folder_cfg_1',
  label: 'Financeiro',
  folderId: 'folder-1',
  sharedDriveId: 'drive-1',
  enabled: true,
  templateVersion: 'v1',
  syncLeaseToken: null,
  syncLeaseExpiresAt: null,
  lastScannedAt: null,
  lastSuccessfulSyncAt: null,
  lastSeenModifiedTime: null,
  lastSeenFileId: null,
  consecutiveFailures: 0,
  lastAlertedAt: null,
  lastRunStatus: null,
  lastRunFinishedAt: null,
  errorMessage: null,
  details: null,
  createdAt: new Date('2026-04-11T00:00:00.000Z'),
  updatedAt: new Date('2026-04-11T00:00:00.000Z'),
};

describe('driveSync service', () => {
  const envBackup = { ...process.env };
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.DRIVE_SYNC_RETRY_BASE_MS = '1';
    process.env.DRIVE_SYNC_MAX_ATTEMPTS = '3';
    process.env.DRIVE_SYNC_STABILITY_SECONDS = '300';
    process.env.DRIVE_SYNC_LEASE_SECONDS = '900';
    dbMock.driveImportFolder.updateMany.mockResolvedValue({ count: 1 });
    dbMock.driveSyncRun.create.mockResolvedValue({ id: 'run_1' });
    dbMock.driveSyncRun.update.mockResolvedValue({ id: 'run_1' });
    dbMock.driveSyncExecution.update.mockResolvedValue({});
    dbMock.driveSyncExecution.updateMany.mockResolvedValue({ count: 1 });
    dbMock.driveImportFolder.update.mockResolvedValue({});
  });

  afterAll(() => {
    process.env = envBackup;
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('imports new drive files into the existing staging pipeline', async () => {
    dbMock.driveImportFolder.findMany.mockResolvedValue([baseFolder]);
    listFilesMock.mockResolvedValue([
      {
        id: 'file-1',
        name: 'planilha.xlsm',
        mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        modifiedTime: '2026-04-11T10:00:00.000Z',
        md5Checksum: 'md5-1',
        size: '1024',
        parents: ['folder-1'],
        driveId: 'drive-1',
      },
    ]);
    dbMock.driveSyncExecution.findUnique.mockResolvedValue(null);
    dbMock.driveSyncExecution.create.mockResolvedValue({
      id: 'exec_1',
      attempts: 0,
      retryCount: 0,
    });
    dbMock.importBatch.create.mockResolvedValue({ id: 'batch_drive_1' });
    dbMock.importFile.findFirst.mockResolvedValue(null);
    downloadMock.mockResolvedValue(Buffer.from('excel-binary'));
    stageMock.mockResolvedValue({
      batchId: 'batch_drive_1',
      fileId: 'import_file_1',
      checksum: 'sha256-1',
      status: 'VALIDATED',
      reusedExistingFile: false,
      totalRows: 10,
      parsedRows: 10,
      validatedRows: 8,
      rejectedRows: 2,
      publishedRows: 0,
      warningCount: 1,
      errorCount: 2,
    });
    dbMock.importFile.findUnique.mockResolvedValue({
      details: {
        templateVersion: 'v1',
      },
    });

    const summary = await syncGoogleDriveImports();

    expect(listFilesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: 'folder-1',
        sharedDriveId: 'drive-1',
      }),
    );
    expect(downloadMock).toHaveBeenCalledWith('file-1');
    expect(stageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'planilha.xlsm',
        source: 'DRIVE',
        importMode: 'AUTO_FOLDER',
        importBatchId: 'batch_drive_1',
        originalPath: 'gdrive://folder-1/file-1',
      }),
    );
    expect(dbMock.importFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'import_file_1' },
        data: expect.objectContaining({
          driveImportFolderId: 'folder_cfg_1',
          externalFileId: 'file-1',
        }),
      }),
    );
    expect(summary.importedFiles).toBe(1);
    expect(summary.skippedFiles).toBe(0);
    expect(summary.lockedFolders).toBe(0);
    expect(summary.deferredFiles).toBe(0);
  });

  it('skips a folder when another execution still holds the lease', async () => {
    dbMock.driveImportFolder.findMany.mockResolvedValue([baseFolder]);
    dbMock.driveImportFolder.updateMany.mockResolvedValueOnce({ count: 0 });

    const summary = await syncGoogleDriveImports();

    expect(listFilesMock).not.toHaveBeenCalled();
    expect(dbMock.driveSyncRun.create).not.toHaveBeenCalled();
    expect(summary.lockedFolders).toBe(1);
    expect(summary.syncedFolders).toBe(0);
  });

  it('defers recently modified files until they become stable', async () => {
    dbMock.driveImportFolder.findMany.mockResolvedValue([baseFolder]);
    listFilesMock.mockResolvedValue([
      {
        id: 'file-unstable',
        name: 'planilha.xlsm',
        mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        modifiedTime: new Date().toISOString(),
        md5Checksum: 'md5-unstable',
        size: '1024',
        parents: ['folder-1'],
        driveId: 'drive-1',
      },
    ]);

    const summary = await syncGoogleDriveImports();

    expect(downloadMock).not.toHaveBeenCalled();
    expect(stageMock).not.toHaveBeenCalled();
    expect(dbMock.driveSyncExecution.upsert).toHaveBeenCalled();
    expect(summary.deferredFiles).toBe(1);
    expect(summary.files[0]).toEqual(
      expect.objectContaining({
        status: 'DEFERRED',
      }),
    );
  });

  it('retries transient download failures before succeeding', async () => {
    dbMock.driveImportFolder.findMany.mockResolvedValue([baseFolder]);
    listFilesMock.mockResolvedValue([
      {
        id: 'file-retry',
        name: 'planilha.xlsm',
        mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        modifiedTime: '2026-04-11T10:00:00.000Z',
        md5Checksum: 'md5-1',
        size: '1024',
        parents: ['folder-1'],
        driveId: 'drive-1',
      },
    ]);
    dbMock.driveSyncExecution.findUnique.mockResolvedValue(null);
    dbMock.driveSyncExecution.create.mockResolvedValue({
      id: 'exec_retry',
      attempts: 0,
      retryCount: 0,
    });
    dbMock.importBatch.create.mockResolvedValue({ id: 'batch_drive_1' });
    dbMock.importFile.findFirst.mockResolvedValue(null);
    downloadMock
      .mockRejectedValueOnce(Object.assign(new Error('timeout while downloading'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce(Buffer.from('excel-binary'));
    stageMock.mockResolvedValue({
      batchId: 'batch_drive_1',
      fileId: 'import_file_1',
      checksum: 'sha256-1',
      status: 'VALIDATED',
      reusedExistingFile: false,
      totalRows: 10,
      parsedRows: 10,
      validatedRows: 8,
      rejectedRows: 2,
      publishedRows: 0,
      warningCount: 1,
      errorCount: 2,
    });
    dbMock.importFile.findUnique.mockResolvedValue({ details: null });

    const summary = await syncGoogleDriveImports();

    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(dbMock.driveSyncExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec_retry' },
        data: expect.objectContaining({
          retryCount: { increment: 1 },
        }),
      }),
    );
    expect(summary.importedFiles).toBe(1);
    expect(summary.retriedOperations).toBe(1);
  });
});
