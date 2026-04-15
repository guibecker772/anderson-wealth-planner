/** @jest-environment node */

jest.mock('../../db', () => ({
  db: {
    importBatch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    importRowNormalized: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
    },
    importFile: {
      updateMany: jest.fn(),
    },
    operationalSnapshot: { count: jest.fn() },
    financialEntry: { count: jest.fn() },
    fineRecord: { count: jest.fn() },
    fineResponsibility: { count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../publisher', () => ({
  publishImportBatch: jest.fn(),
}));

import { ImportPipelineStatus } from '@prisma/client';

import { db } from '../../db';
import { publishImportBatch } from '../publisher';
import {
  getImportBatchDetail,
  listImportBatches,
  parseImportBatchRowFilters,
  parseImportMonitoringFilters,
  reprocessImportBatch,
} from '../monitoring';

const dbMock = db as unknown as {
  importBatch: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  importRowNormalized: { findMany: jest.Mock; groupBy: jest.Mock; updateMany: jest.Mock };
  importFile: { updateMany: jest.Mock };
  operationalSnapshot: { count: jest.Mock };
  financialEntry: { count: jest.Mock };
  fineRecord: { count: jest.Mock };
  fineResponsibility: { count: jest.Mock };
  $transaction: jest.Mock;
};

const publishMock = publishImportBatch as jest.Mock;

describe('import monitoring services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists import batches with aggregated counters and filters', async () => {
    dbMock.importBatch.findMany.mockResolvedValue([
      {
        id: 'batch_1',
        batchKey: 'staging:manual:1',
        kind: 'WORKBOOK_MULTI_SHEET',
        pipelineStatus: 'VALIDATED',
        status: 'PROCESSED',
        startedAt: new Date('2026-04-11T10:00:00.000Z'),
        validatedAt: new Date('2026-04-11T10:02:00.000Z'),
        rejectedAt: null,
        publishedAt: null,
        fileCount: 1,
        rowCount: 100,
        normalizedRowCount: 95,
        rejectedRowCount: 5,
        publishedRowCount: 0,
        importFiles: [
          {
            id: 'file_1',
            name: 'planilha.xlsm',
            source: 'LOCAL',
            importMode: 'MANUAL_UPLOAD',
            validatedRows: 90,
            rejectedRows: 5,
            publishedRows: 0,
            warningCount: 2,
            errorCount: 3,
          },
        ],
      },
    ]);

    const filters = parseImportMonitoringFilters({
      from: '2026-04-01',
      to: '2026-04-30',
      status: 'VALIDATED',
      kind: 'WORKBOOK_MULTI_SHEET',
      q: 'planilha',
    });
    const result = await listImportBatches(filters);

    expect(dbMock.importBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pipelineStatus: 'VALIDATED',
          kind: 'WORKBOOK_MULTI_SHEET',
        }),
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'batch_1',
        validatedRows: 90,
        rejectedRowCount: 5,
        warningCount: 2,
        errorCount: 3,
        primaryFileName: 'planilha.xlsm',
      }),
    );
    expect(result.totals.validatedRows).toBe(90);
  });

  it('returns import batch detail with files, grouped summaries and row validation', async () => {
    dbMock.importBatch.findUnique.mockResolvedValue({
      id: 'batch_1',
      batchKey: 'staging:manual:1',
      kind: 'WORKBOOK_MULTI_SHEET',
      status: 'PROCESSED',
      pipelineStatus: 'PUBLISHED',
      startedAt: new Date('2026-04-11T10:00:00.000Z'),
      parsedAt: new Date('2026-04-11T10:01:00.000Z'),
      validatedAt: new Date('2026-04-11T10:02:00.000Z'),
      rejectedAt: null,
      publishedAt: new Date('2026-04-11T10:03:00.000Z'),
      completedAt: new Date('2026-04-11T10:04:00.000Z'),
      fileCount: 1,
      rowCount: 10,
      normalizedRowCount: 9,
      rejectedRowCount: 1,
      publishedRowCount: 8,
      templateVersion: 'v1',
      errorMessage: null,
      validationMessages: [{ code: 'warn', severity: 'WARNING', message: 'Cabecalho diferente' }],
      importFiles: [
        {
          id: 'file_1',
          name: 'planilha.xlsm',
          checksum: 'checksum',
          status: 'PUBLISHED',
          kind: 'WORKBOOK',
          importMode: 'MANUAL_UPLOAD',
          source: 'LOCAL',
          originalPath: 'samples/planilha.xlsm',
          uploadedAt: new Date('2026-04-11T10:00:00.000Z'),
          parsedAt: new Date('2026-04-11T10:01:00.000Z'),
          validatedAt: new Date('2026-04-11T10:02:00.000Z'),
          rejectedAt: null,
          publishedAt: new Date('2026-04-11T10:03:00.000Z'),
          totalRows: 10,
          parsedRows: 10,
          validatedRows: 9,
          rejectedRows: 1,
          publishedRows: 8,
          warningCount: 1,
          errorCount: 1,
          sourceSheets: [{ sheetName: 'Receita', rowCount: 4, headerMatchesContract: true }],
        },
      ],
    });
    dbMock.importRowNormalized.findMany.mockResolvedValue([
      {
        id: 'row_1',
        status: 'REJECTED',
        recordType: 'FINANCIAL_ENTRY',
        rowKind: 'DETAIL',
        sourceSheetName: 'Receita',
        sourceRowNumber: 7,
        publishable: false,
        errorMessage: 'Data invalida',
        validationMessages: [{ code: 'invalid-date', severity: 'ERROR', message: 'Data invalida' }],
        publishedRecordId: null,
        publishedAt: null,
      },
    ]);
    dbMock.importRowNormalized.groupBy
      .mockResolvedValueOnce([{ status: 'REJECTED', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ recordType: 'FINANCIAL_ENTRY', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ sourceSheetName: 'Receita', _count: { _all: 1 } }]);
    dbMock.operationalSnapshot.count.mockResolvedValue(2);
    dbMock.financialEntry.count.mockResolvedValue(3);
    dbMock.fineRecord.count.mockResolvedValue(1);
    dbMock.fineResponsibility.count.mockResolvedValue(1);

    const detail = await getImportBatchDetail('batch_1', parseImportBatchRowFilters({ rowStatus: 'ERROR_ONLY' }));

    expect(detail.batch.pipelineStatus).toBe('PUBLISHED');
    expect(detail.files).toHaveLength(1);
    expect(detail.rows[0]).toEqual(
      expect.objectContaining({
        sourceSheetName: 'Receita',
        sourceRowNumber: 7,
        errorMessage: 'Data invalida',
      }),
    );
    expect(detail.summary.byStatus[0]).toEqual({ status: 'REJECTED', count: 1 });
    expect(detail.finalCounts.financialEntries).toBe(3);
  });

  it('reprocesses a publishable batch by resetting status and rerunning publication', async () => {
    dbMock.importBatch.findUnique.mockResolvedValue({
      id: 'batch_1',
      pipelineStatus: ImportPipelineStatus.PUBLISHED,
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        importRowNormalized: { updateMany: dbMock.importRowNormalized.updateMany },
        importFile: { updateMany: dbMock.importFile.updateMany },
        importBatch: { update: dbMock.importBatch.update },
      }),
    );
    publishMock.mockResolvedValue({
      batchId: 'batch_1',
      publishedRows: 3,
      reusedRows: 2,
      skippedRows: 0,
      sourceFiles: 1,
      operationalSnapshots: 1,
      financialEntries: 1,
      fineRecords: 1,
      fineResponsibilities: 0,
      status: 'PUBLISHED',
    });

    const result = await reprocessImportBatch('batch_1');

    expect(dbMock.importRowNormalized.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ importBatchId: 'batch_1', publishable: true }),
        data: expect.objectContaining({
          status: 'VALIDATED',
          publishedRecordId: null,
        }),
      }),
    );
    expect(dbMock.importFile.updateMany).toHaveBeenCalled();
    expect(dbMock.importBatch.update).toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledWith('batch_1');
    expect(result.publishedRows).toBe(3);
  });
});
