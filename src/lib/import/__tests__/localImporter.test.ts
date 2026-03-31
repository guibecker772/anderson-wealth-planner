/** @jest-environment node */

import ExcelJS from 'exceljs';
import {
  detectFileKindFromName,
  normalizeOwnerName,
  parseWorkbookBufferForTest,
} from '../localImporter';

async function createWorkbookBuffer(
  sheets: Array<{
    name: string;
    rows: unknown[][];
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

describe('localImporter helpers', () => {
  it('normalizes owner names and collapses company aliases', () => {
    expect(normalizeOwnerName('CLIKCAR/VICTOR')).toBe('Victor');
    expect(normalizeOwnerName('victor')).toBe('Victor');
    expect(normalizeOwnerName('')).toBeNull();
  });

  it('detects fines and operational files from file names', () => {
    expect(detectFileKindFromName('multas-marco.xlsm')).toBe('FINES');
    expect(detectFileKindFromName('planilha teste carros 2026.xlsm')).toBe('OPERATIONAL');
    expect(detectFileKindFromName('arquivo-generico.xlsx')).toBe('UNKNOWN');
  });

  it('parses the real vehicle operational layout and ignores dashboard support sheets', async () => {
    const buffer = await createWorkbookBuffer([
      {
        name: 'Dashboard',
        rows: [['Resumo', 'Nao usar']],
      },
      {
        name: 'Planilha4',
        rows: [['Apoio', 'Nao usar']],
      },
      {
        name: 'planilha teste carros',
        rows: [
          [
            'Situacao de pagamento',
            'Data',
            'Semana',
            'Contrato ativo',
            'Situacao de veiculo',
            'Placa',
            'Modelo',
            'Proprietario',
            'Motorista',
            'Valor contrato',
            'Multa/atraso',
            'Desconto',
            'Valor a Cobrar',
            'Manutencao por motorista',
            'Valor Pago (Semana)',
            'Multa',
          ],
          [
            'Pago',
            'Fevereiro',
            2,
            'Sim',
            'Ativo',
            'ABC1D23',
            'Onix',
            'CLIKCAR/VICTOR',
            'Jose',
            1200,
            25,
            10,
            1100,
            35,
            980,
            5,
          ],
          [
            'Pendente',
            'Janeiro',
            null,
            'Sim',
            'Ativo',
            'DEF4G56',
            'HB20',
            'Victor',
            'Maria',
            900,
            null,
            null,
            null,
            20,
            null,
            null,
          ],
        ],
      },
    ]);

    const parsed = await parseWorkbookBufferForTest(buffer, 'operacional-2026.xlsm');

    expect(parsed.kind).toBe('OPERATIONAL');
    expect(parsed.sheetNames).toEqual(['planilha teste carros']);
    expect(parsed.rows).toHaveLength(2);

    const firstRow = parsed.rows[0];
    const secondRow = parsed.rows[1];

    expect(firstRow.type).toBe('RECEIVABLE');
    expect(firstRow.status).toBe('SETTLED');
    expect(firstRow.unit).toBe('ABC1D23');
    expect(firstRow.actualAmount).toBe(980);
    expect(firstRow.plannedAmount).toBe(1100);
    expect(firstRow.feesFine).toBe(30);
    expect(firstRow.discount).toBe(10);
    expect(firstRow.dueDate?.toISOString().slice(0, 10)).toBe('2026-02-08');
    expect((firstRow.rawJson.__import as Record<string, unknown>).ownerNormalized).toBe('Victor');
    expect(((firstRow.rawJson.__import as Record<string, unknown>).dateInference as Record<string, unknown>).strategy).toBe(
      'month-text-plus-week'
    );

    expect(secondRow.status).toBe('PENDING');
    expect(secondRow.actualAmount).toBeNull();
    expect(secondRow.plannedAmount).toBe(900);
    expect(secondRow.dueDate?.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(((secondRow.rawJson.__import as Record<string, unknown>).dateInference as Record<string, unknown>).strategy).toBe(
      'month-text-fallback-first-day'
    );
  });

  it('parses the fines report layout and preserves payer metadata', async () => {
    const buffer = await createWorkbookBuffer([
      {
        name: 'Pagina1',
        rows: [
          ['Condutor', 'Placa', 'Renavam', 'Auto de infracao', 'Valor', 'Pago para?', 'Data'],
          ['Carlos', 'XYZ9K88', '123456789', 'AIT-001', 145.35, 'Motorista', '15/03/2025'],
        ],
      },
    ]);

    const parsed = await parseWorkbookBufferForTest(buffer, 'relatorio-infracoes-2025.xlsx');

    expect(parsed.kind).toBe('FINES');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].type).toBe('PAYABLE');
    expect(parsed.rows[0].externalId).toBe('AIT-001');
    expect(parsed.rows[0].plannedAmount).toBe(145.35);
    expect(parsed.rows[0].unit).toBe('XYZ9K88');
    expect((parsed.rows[0].rawJson.__import as Record<string, unknown>).renavam).toBe('123456789');
    expect((parsed.rows[0].rawJson.__import as Record<string, unknown>).paidByOriginal).toBe('Motorista');
    expect((parsed.rows[0].rawJson.__import as Record<string, unknown>).paidByNormalized).toBe('DRIVER');
  });
});
