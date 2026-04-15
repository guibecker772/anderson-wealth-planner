import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImportBatchDetailView } from '../ImportBatchDetailView';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('../ImportBatchActions', () => ({
  ImportBatchActions: ({ batchId }: { batchId: string }) => <div>actions-{batchId}</div>,
}));

describe('ImportBatchDetailView', () => {
  it('renders batch audit details, files and row errors', () => {
    const html = renderToStaticMarkup(
      <ImportBatchDetailView
        detail={{
          batch: {
            id: 'batch_1234567890',
            batchKey: 'staging:manual:1',
            kind: 'WORKBOOK_MULTI_SHEET',
            status: 'PROCESSED',
            pipelineStatus: 'VALIDATED',
            startedAt: new Date('2026-04-11T10:00:00.000Z'),
            parsedAt: null,
            validatedAt: null,
            rejectedAt: null,
            publishedAt: null,
            completedAt: null,
            fileCount: 1,
            rowCount: 12,
            normalizedRowCount: 10,
            rejectedRowCount: 2,
            publishedRowCount: 0,
            templateVersion: 'v1',
            errorMessage: null,
            validationMessages: [],
          },
          files: [
            {
              id: 'file_1',
              name: 'planilha.xlsm',
              checksum: 'abcdef1234567890abcdef',
              status: 'VALIDATED',
              kind: 'WORKBOOK',
              importMode: 'MANUAL_UPLOAD',
              source: 'LOCAL',
              originalPath: 'samples/planilha.xlsm',
              uploadedAt: new Date('2026-04-11T10:00:00.000Z'),
              parsedAt: null,
              validatedAt: null,
              rejectedAt: null,
              publishedAt: null,
              totalRows: 12,
              parsedRows: 12,
              validatedRows: 10,
              rejectedRows: 2,
              publishedRows: 0,
              warningCount: 1,
              errorCount: 2,
              sourceSheets: [{ sheetName: 'Receita', rowCount: 4, headerMatchesContract: true }],
            },
          ],
          rows: [
            {
              id: 'row_1',
              status: 'REJECTED',
              recordType: 'FINANCIAL_ENTRY',
              rowKind: 'DETAIL',
              sourceSheetName: 'Receita',
              sourceRowNumber: 8,
              publishable: false,
              errorMessage: 'Data invalida',
              validationMessages: [{ code: 'invalid-date', severity: 'ERROR', message: 'Data invalida', columnHeader: 'Data' }],
              publishedRecordId: null,
              publishedAt: null,
            },
          ],
          summary: {
            byStatus: [{ status: 'REJECTED', count: 1 }],
            byRecordType: [{ recordType: 'FINANCIAL_ENTRY', count: 1 }],
            bySheet: [{ sheetName: 'Receita', count: 1 }],
            errors: 1,
            warnings: 0,
            publishableRows: 0,
            publishedRows: 0,
          },
          finalCounts: {
            operationalSnapshots: 0,
            financialEntries: 0,
            fineRecords: 0,
            fineResponsibilities: 0,
          },
          rowFilters: {
            status: 'ERROR_ONLY',
            recordType: 'ALL',
            sheet: '',
          },
        }}
      />,
    );

    expect(html).toContain('Resumo do lote');
    expect(html).toContain('planilha.xlsm');
    expect(html).toContain('Receita');
    expect(html).toContain('Data invalida');
    expect(html).toContain('actions-batch_1234567890');
    expect(html).toContain('Voltar para o centro de importacoes');
  });
});
