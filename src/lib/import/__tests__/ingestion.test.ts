/** @jest-environment node */

import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';

jest.mock('../../db', () => ({
  db: {
    $transaction: jest.fn(),
  },
}));

import { ImportMode, SourceType } from '@prisma/client';
import { db } from '../../db';
import { prepareWorkbookImport, stageWorkbookImport } from '../ingestion';
import { WORKBOOK_SHEET_CONTRACTS } from '../workbookTemplateContract';

const dbMock = db as unknown as {
  $transaction: jest.Mock;
};

function getHeaders(sheetName: string): string[] {
  const contract = WORKBOOK_SHEET_CONTRACTS.find((entry) => entry.sheetName === sheetName);
  if (!contract) {
    throw new Error(`Sheet contract not found for ${sheetName}`);
  }
  return contract.expectedColumns;
}

async function createWorkbookBuffer(
  sheets: Array<{
    name: string;
    rows: unknown[][];
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow(getHeaders(sheet.name));
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

function buildPreparedWorkbookSheets() {
  return [
    {
      name: 'Receita',
      rows: [['Receita Carros', 2500, 'Banrisul', '05/02/2026', 'Fevereiro', 2026]],
    },
    {
      name: 'Quem Pagou',
      rows: [
        ['Responsabilidade Motorista', null, null, null, null],
        ['ABC1D23', '08/02/2026', '10/02/2026', 195.23, 'Motorista'],
      ],
    },
    {
      name: 'Lucro',
      rows: [[300, 2500, 2200, 0.88, 'Fevereiro']],
    },
  ];
}

describe('ingestion pipeline preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prepares raw and normalized staging rows from the workbook contract', async () => {
    const buffer = await createWorkbookBuffer(buildPreparedWorkbookSheets());

    const prepared = await prepareWorkbookImport({
      fileName: 'workbook-base.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
      now: new Date('2026-04-11T10:00:00.000Z'),
    });

    expect(prepared.file.kind).toBe('WORKBOOK');
    expect(prepared.file.status).toBe('VALIDATED');
    expect(prepared.file.validatedRows).toBe(2);
    expect(prepared.rawRows).toHaveLength(4);
    expect(prepared.normalizedRows).toHaveLength(4);
    expect(prepared.normalizedRows.filter((row) => row.publishable)).toHaveLength(2);
    expect(prepared.normalizedRows.map((row) => row.rowKind)).toEqual(
      expect.arrayContaining(['DETAIL', 'SECTION_LABEL', 'RECONCILIATION'])
    );
    expect(prepared.normalizedRows.find((row) => row.recordType === 'FINANCIAL_ENTRY')?.dedupeKey).toBeTruthy();
    expect(prepared.normalizedRows.find((row) => row.recordType === 'FINE_RESPONSIBILITY')?.businessKey).toBeTruthy();
  });

  it('flags duplicated publishable rows by dedupeKey without rejecting the file', async () => {
    const buffer = await createWorkbookBuffer([
      {
        name: 'Receita',
        rows: [
          ['Receita Carros', 2500, 'Banrisul', '05/02/2026', 'Fevereiro', 2026],
          ['Receita Carros', 2500, 'Banrisul', '05/02/2026', 'Fevereiro', 2026],
        ],
      },
    ]);

    const prepared = await prepareWorkbookImport({
      fileName: 'receita-duplicada.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
      now: new Date('2026-04-11T10:00:00.000Z'),
    });

    expect(prepared.file.status).toBe('VALIDATED');
    expect(prepared.file.warningCount).toBeGreaterThanOrEqual(2);
    expect(
      prepared.normalizedRows.every((row) =>
        row.validationMessages.some((message) => message.code === 'duplicate-dedupe-key')
      )
    ).toBe(true);
  });

  it('parses the real workbook sample and separates valid and invalid staging rows', async () => {
    const buffer = await fs.readFile(path.resolve(process.cwd(), 'samples', 'planilha teste carros.xlsm'));

    const prepared = await prepareWorkbookImport({
      fileName: 'planilha teste carros.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
    });

    expect(prepared.file.kind).toBe('WORKBOOK');
    expect(prepared.file.totalRows).toBeGreaterThan(1000);
    expect(prepared.file.validatedRows).toBeGreaterThan(0);
    expect(prepared.file.rejectedRows).toBeGreaterThan(0);
    expect(prepared.normalizedRows.some((row) => row.recordType === 'FINE_RESPONSIBILITY')).toBe(true);
  });
});

describe('ingestion staging persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists batch, file, raw rows and normalized rows in a single transaction', async () => {
    const buffer = await createWorkbookBuffer(buildPreparedWorkbookSheets());
    const prepared = await prepareWorkbookImport({
      fileName: 'workbook-base.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
      now: new Date('2026-04-11T10:00:00.000Z'),
    });

    const tx = {
      importFile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'file_1' }),
        findMany: jest.fn().mockResolvedValue([{ status: 'VALIDATED', totalRows: prepared.file.totalRows }]),
      },
      importBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch_1' }),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'batch_1' }),
      },
      importRowRaw: {
        createMany: jest.fn().mockResolvedValue({ count: prepared.rawRows.length }),
        findMany: jest.fn().mockResolvedValue(
          prepared.rawRows.map((row, index) => ({
            id: `raw_${index + 1}`,
            rawLineKey: row.rawLineKey,
          }))
        ),
      },
      importRowNormalized: {
        createMany: jest.fn().mockResolvedValue({ count: prepared.normalizedRows.length }),
        groupBy: jest.fn().mockResolvedValue([
          {
            status: 'VALIDATED',
            publishable: true,
            _count: { _all: prepared.normalizedRows.filter((row) => row.publishable).length },
          },
          {
            status: 'PARSED',
            publishable: false,
            _count: { _all: prepared.normalizedRows.filter((row) => !row.publishable).length },
          },
        ]),
      },
    };

    dbMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => await callback(tx));

    const result = await stageWorkbookImport({
      fileName: 'workbook-base.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
    });

    expect(tx.importBatch.create).toHaveBeenCalled();
    expect(tx.importFile.create).toHaveBeenCalled();
    expect(tx.importRowRaw.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            importBatchId: 'batch_1',
            importFileId: 'file_1',
          }),
        ]),
      })
    );
    expect(tx.importRowNormalized.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            importBatchId: 'batch_1',
            importFileId: 'file_1',
          }),
        ]),
      })
    );
    expect(tx.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch_1' },
        data: expect.objectContaining({
          pipelineStatus: 'VALIDATED',
          normalizedRowCount: prepared.normalizedRows.length,
        }),
      })
    );
    expect(result.reusedExistingFile).toBe(false);
    expect(result.validatedRows).toBe(prepared.file.validatedRows);
  });

  it('returns idempotent reuse when the file checksum already exists', async () => {
    const buffer = await createWorkbookBuffer(buildPreparedWorkbookSheets());

    const tx = {
      importFile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'file_existing',
          importBatchId: 'batch_existing',
          checksum: 'hash_existing',
          status: 'VALIDATED',
          totalRows: 4,
          parsedRows: 4,
          validatedRows: 2,
          rejectedRows: 0,
          publishedRows: 0,
          warningCount: 1,
          errorCount: 0,
        }),
      },
    };

    dbMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => await callback(tx));

    const result = await stageWorkbookImport({
      fileName: 'workbook-base.xlsm',
      buffer,
      importMode: ImportMode.MANUAL_UPLOAD,
      source: SourceType.LOCAL,
    });

    expect(result.reusedExistingFile).toBe(true);
    expect(result.fileId).toBe('file_existing');
    expect(result.batchId).toBe('batch_existing');
  });
});
