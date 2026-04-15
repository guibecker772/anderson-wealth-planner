import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImportMonitoringTable } from '../ImportMonitoringTable';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ImportMonitoringTable', () => {
  it('renders imported batches and counters', () => {
    const html = renderToStaticMarkup(
      <ImportMonitoringTable
        data={{
          filters: {
            dateRange: { from: '2026-04-01', to: '2026-04-30' },
            status: 'ALL',
            kind: 'ALL',
            query: '',
          },
          items: [
            {
              id: 'batch_1',
              batchKey: 'staging:manual:1',
              kind: 'WORKBOOK_MULTI_SHEET',
              pipelineStatus: 'VALIDATED',
              processingStatus: 'PROCESSED',
              startedAt: new Date('2026-04-11T10:00:00.000Z'),
              validatedAt: null,
              rejectedAt: null,
              publishedAt: null,
              fileCount: 1,
              rowCount: 100,
              normalizedRowCount: 95,
              rejectedRowCount: 5,
              publishedRowCount: 0,
              validatedRows: 90,
              warningCount: 2,
              errorCount: 3,
              importedFiles: 1,
              primaryFileName: 'planilha.xlsm',
              primarySource: 'LOCAL',
              importModes: ['MANUAL_UPLOAD'],
              fileNames: ['planilha.xlsm'],
            },
          ],
          totals: {
            batches: 1,
            files: 1,
            rows: 100,
            validatedRows: 90,
            rejectedRows: 5,
            publishedRows: 0,
            warnings: 2,
            errors: 3,
          },
          availableStatuses: ['UPLOADED', 'PARSED', 'VALIDATED', 'REJECTED', 'PUBLISHED'],
        }}
      />,
    );

    expect(html).toContain('Lotes importados');
    expect(html).toContain('planilha.xlsm');
    expect(html).toContain('VALIDATED');
    expect(html).toContain('Validas: 90');
    expect(html).toContain('Ver detalhe');
  });
});
