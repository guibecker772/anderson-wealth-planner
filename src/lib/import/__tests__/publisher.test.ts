/** @jest-environment node */

jest.mock('../../db', () => ({
  db: {
    $transaction: jest.fn(),
  },
}));

import { ImportPipelineStatus } from '@prisma/client';

import { db } from '../../db';
import { publishImportBatch } from '../publisher';

const dbMock = db as unknown as {
  $transaction: jest.Mock;
};

function createBaseTx(rows: unknown[], files: unknown[]) {
  return {
    importBatch: {
      findUnique: jest.fn().mockResolvedValue({ id: 'batch_1', pipelineStatus: ImportPipelineStatus.VALIDATED }),
      update: jest.fn().mockResolvedValue({ id: 'batch_1' }),
    },
    importRowNormalized: {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(rows.length),
    },
    importFile: {
      findMany: jest.fn().mockResolvedValue(files),
      update: jest.fn().mockResolvedValue({}),
    },
    sourceFile: {
      upsert: jest.fn().mockResolvedValue({ id: 'source_1' }),
    },
    investor: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'investor_1', normalizedName: 'victor' }]),
    },
    driver: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'driver_1', normalizedName: 'jose' }]),
    },
    vehicle: {
      upsert: jest.fn().mockResolvedValue({ id: 'vehicle_1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'vehicle_1', plate: 'ABC1D23' }]),
    },
    financialAccount: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'account_1', normalizedName: 'banrisul' }]),
    },
    operationalSnapshot: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ops_1' }),
      update: jest.fn(),
    },
    financialEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'fin_1' }),
      update: jest.fn(),
    },
    fineRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'fine_1' }),
      update: jest.fn(),
    },
    fineResponsibility: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'resp_1' }),
      update: jest.fn(),
    },
  };
}

describe('publishImportBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes validated staging rows into final domain tables with traceability', async () => {
    const rows = [
      {
        id: 'row_ops',
        importBatchId: 'batch_1',
        importFileId: 'file_1',
        recordType: 'OPERATIONAL_SNAPSHOT',
        sourceSheetName: 'planilha teste carros',
        sourceRowNumber: 2,
        normalizedLineKey: 'hash_ops',
        dedupeKey: 'dedupe_ops',
        businessKey: 'business_ops',
        normalizedPayload: {
          plate: 'ABC1D23',
          plateRaw: 'ABC-1D23',
          referenceDate: '2026-02-08T00:00:00.000Z',
          referenceYear: 2026,
          referenceMonth: 2,
          weekOfMonth: 2,
          contractActiveRaw: 'Sim',
          contractActive: true,
          vehicleStatusRaw: 'Ativo',
          vehicleStatusNormalized: 'Ativo',
          model: 'Onix',
          modelRaw: 'Onix',
          investorRaw: 'Victor',
          investorNormalized: 'Victor',
          driverRaw: 'Jose',
          driverNormalized: 'Jose',
          contractValue: 120,
          amountToCharge: 120,
          amountPaidWeek: 100,
          lateFeeAmount: 5,
          discountAmount: 0,
          maintenanceByDriverAmount: 10,
        },
        publishedRecordId: null,
        publishedAt: null,
        status: ImportPipelineStatus.VALIDATED,
      },
      {
        id: 'row_fin',
        importBatchId: 'batch_1',
        importFileId: 'file_1',
        recordType: 'FINANCIAL_ENTRY',
        sourceSheetName: 'Receita',
        sourceRowNumber: 3,
        normalizedLineKey: 'hash_fin',
        dedupeKey: 'dedupe_fin',
        businessKey: 'business_fin',
        normalizedPayload: {
          domain: 'REVENUE',
          direction: 'INFLOW',
          entryDate: '2026-02-05T00:00:00.000Z',
          referenceYear: 2026,
          referenceMonth: 2,
          groupRaw: 'Receita Carros',
          groupNormalized: 'Receita Carros',
          detailRaw: 'Recebimento',
          categoryRaw: 'Operacional',
          accountRaw: 'Banrisul',
          amount: 2500,
        },
        publishedRecordId: null,
        publishedAt: null,
        status: ImportPipelineStatus.VALIDATED,
      },
      {
        id: 'row_fine',
        importBatchId: 'batch_1',
        importFileId: 'file_1',
        recordType: 'FINE_RECORD',
        sourceSheetName: 'Multas',
        sourceRowNumber: 4,
        normalizedLineKey: 'hash_fine',
        dedupeKey: 'dedupe_fine',
        businessKey: 'business_fine',
        normalizedPayload: {
          plate: 'ABC1D23',
          plateRaw: 'ABC-1D23',
          infractionDate: '2026-02-08T00:00:00.000Z',
          referenceYear: 2026,
          referenceMonth: 2,
          issuingAuthorityRaw: 'DETRAN',
          driverRaw: 'Jose',
          driverNormalized: 'Jose',
          paymentStatusRaw: 'Nao',
          paymentState: 'UNPAID',
          amount: 195.23,
          aitRaw: 'AIT-900',
          ait: 'AIT-900',
          vehicleRaw: 'Onix',
        },
        publishedRecordId: null,
        publishedAt: null,
        status: ImportPipelineStatus.VALIDATED,
      },
      {
        id: 'row_resp',
        importBatchId: 'batch_1',
        importFileId: 'file_1',
        recordType: 'FINE_RESPONSIBILITY',
        sourceSheetName: 'Quem Pagou',
        sourceRowNumber: 5,
        normalizedLineKey: 'hash_resp',
        dedupeKey: 'dedupe_resp',
        businessKey: 'business_resp',
        normalizedPayload: {
          plate: 'ABC1D23',
          plateRaw: 'ABC-1D23',
          infractionDate: '2026-02-08T00:00:00.000Z',
          paymentDate: '2026-02-10T00:00:00.000Z',
          amount: 195.23,
          sectionLabelRaw: 'Responsabilidade Motorista',
          payerContextRaw: 'Responsabilidade Motorista',
          responsibilityType: 'DRIVER',
          payeeRaw: 'Motorista',
        },
        publishedRecordId: null,
        publishedAt: null,
        status: ImportPipelineStatus.VALIDATED,
      },
    ];

    const files = [
      {
        id: 'file_1',
        checksum: 'checksum_1',
        name: 'planilha.xlsm',
        kind: 'WORKBOOK',
        importMode: 'MANUAL_UPLOAD',
        source: 'LOCAL',
        originalPath: null,
        uploadedAt: new Date('2026-04-11T10:00:00.000Z'),
        parsedRows: 4,
        validatedRows: 4,
        rejectedRows: 0,
        warningCount: 0,
        errorCount: 0,
      },
    ];

    const tx = createBaseTx(rows, files);
    dbMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => await callback(tx));

    const result = await publishImportBatch('batch_1');

    expect(result.status).toBe('PUBLISHED');
    expect(result.publishedRows).toBe(4);
    expect(tx.operationalSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentState: 'PARTIAL',
          openAmount: '20.00',
          rowHash: 'hash_ops',
          operationalKey: 'business_ops',
          rawJson: expect.objectContaining({
            __importTrace: expect.objectContaining({
              importRowNormalizedId: 'row_ops',
              sourceRowNumber: 2,
            }),
          }),
        }),
      }),
    );
    expect(tx.financialEntry.create).toHaveBeenCalled();
    expect(tx.fineRecord.create).toHaveBeenCalled();
    expect(tx.fineResponsibility.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fineRecordId: 'fine_1',
          responsibilityKey: 'business_resp',
        }),
      }),
    );
    expect(tx.importRowNormalized.update).toHaveBeenCalledTimes(4);
    expect(tx.importFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'file_1' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedRows: 4,
        }),
      }),
    );
    expect(tx.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch_1' },
        data: expect.objectContaining({
          pipelineStatus: 'PUBLISHED',
          publishedRowCount: 4,
        }),
      }),
    );
  });

  it('reprocesses safely by business key without creating duplicates', async () => {
    const rows = [
      {
        id: 'row_fin',
        importBatchId: 'batch_1',
        importFileId: 'file_1',
        recordType: 'FINANCIAL_ENTRY',
        sourceSheetName: 'Receita',
        sourceRowNumber: 7,
        normalizedLineKey: 'hash_fin_v2',
        dedupeKey: 'dedupe_fin',
        businessKey: 'business_fin',
        normalizedPayload: {
          domain: 'REVENUE',
          direction: 'INFLOW',
          entryDate: '2026-02-05T00:00:00.000Z',
          referenceYear: 2026,
          referenceMonth: 2,
          groupRaw: 'Receita Carros',
          groupNormalized: 'Receita Carros',
          detailRaw: 'Recebimento atualizado',
          categoryRaw: 'Operacional',
          accountRaw: 'Banrisul',
          amount: 2600,
        },
        publishedRecordId: null,
        publishedAt: null,
        status: ImportPipelineStatus.VALIDATED,
      },
    ];

    const files = [
      {
        id: 'file_1',
        checksum: 'checksum_1',
        name: 'planilha.xlsm',
        kind: 'WORKBOOK',
        importMode: 'MANUAL_UPLOAD',
        source: 'LOCAL',
        originalPath: null,
        uploadedAt: new Date('2026-04-11T10:00:00.000Z'),
        parsedRows: 1,
        validatedRows: 1,
        rejectedRows: 0,
        warningCount: 0,
        errorCount: 0,
      },
    ];

    const tx = createBaseTx(rows, files);
    tx.financialEntry.findFirst.mockResolvedValue({ id: 'fin_existing' });
    tx.financialEntry.update.mockResolvedValue({ id: 'fin_existing' });

    dbMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => await callback(tx));

    const result = await publishImportBatch('batch_1');

    expect(result.publishedRows).toBe(1);
    expect(tx.financialEntry.create).not.toHaveBeenCalled();
    expect(tx.financialEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fin_existing' },
        data: expect.objectContaining({
          rowHash: 'hash_fin_v2',
          entryKey: 'business_fin',
          amount: '2600.00',
        }),
      }),
    );
    expect(tx.importRowNormalized.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row_fin' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedRecordId: 'fin_existing',
        }),
      }),
    );
  });
});
