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
          [
            'Janeiro',
            4,
            'Sim',
            'Locado',
            'XYZ1A23',
            'Argo',
            'Victor',
            null,
            500,
            null,
            500,
            0,
            null,
            null,
          ],
          [
            'Janeiro',
            4,
            'Sim',
            'Locado',
            'XYZ1A23',
            'Argo',
            'Victor',
            null,
            500,
            null,
            500,
            0,
            null,
            null,
          ],
          [
            'Marco',
            1,
            'Sim',
            'Locado',
            'JKL9M87',
            'Kwid',
            'Victor',
            null,
            746.99,
            null,
            'F',
            '#VALUE!',
            null,
            746,
          ],
        ],
      },
      {
        name: 'Receita',
        rows: [
          ['Data', 'Categoria', 'Fornecedor', 'Valor'],
          ['01/02/2026', 'Receita auxiliar', 'Ignorar', 999],
        ],
      },
    ]);

    const parsed = await parseWorkbookBufferForTest(buffer, 'operacional-2026.xlsm');

    expect(parsed.kind).toBe('OPERATIONAL');
    expect(parsed.sheetNames).toEqual(['planilha teste carros']);
    expect(parsed.rows).toHaveLength(4);

    const firstRow = parsed.rows[0];
    const secondRow = parsed.rows[1];
    const zeroChargeRow = parsed.rows[2];
    const invalidValueRow = parsed.rows[3];

    expect(firstRow.type).toBe('RECEIVABLE');
    expect(firstRow.status).toBe('SETTLED');
    expect(firstRow.unit).toBe('ABC1D23');
    expect(firstRow.actualAmount).toBe(980);
    expect(firstRow.plannedAmount).toBe(1100);
    expect(firstRow.feesFine).toBe(30);
    expect(firstRow.discount).toBe(10);
    expect(firstRow.dueDate?.toISOString().slice(0, 10)).toBe('2026-02-08');
    expect((firstRow.rawJson.__import as Record<string, unknown>).ownerNormalized).toBe('Victor');
    expect((firstRow.rawJson.__import as Record<string, unknown>).paymentStatus).toBeNull();
    expect(((firstRow.rawJson.__import as Record<string, unknown>).dateInference as Record<string, unknown>).strategy).toBe(
      'month-text-plus-week'
    );
    expect(firstRow.operationalSnapshot?.paymentStatusRaw).toBeNull();
    expect(firstRow.operationalSnapshot?.paymentState).toBe('PARTIAL');
    expect(firstRow.operationalSnapshot?.openAmount).toBe(120);
    expect((firstRow.operationalSnapshot?.rawJson.__quality as Record<string, unknown>).status).toBe('OK');

    expect(secondRow.status).toBe('PENDING');
    expect(secondRow.actualAmount).toBeNull();
    expect(secondRow.plannedAmount).toBe(900);
    expect(secondRow.dueDate?.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(((secondRow.rawJson.__import as Record<string, unknown>).dateInference as Record<string, unknown>).strategy).toBe(
      'month-text-fallback-first-day'
    );

    expect(zeroChargeRow.operationalSnapshot?.amountToCharge).toBe(0);
    expect(zeroChargeRow.operationalSnapshot?.paymentState).toBe('UNKNOWN');
    expect(zeroChargeRow.operationalSnapshot?.openAmount).toBe(0);
    expect((zeroChargeRow.operationalSnapshot?.rawJson.__quality as Record<string, unknown>).status).toBe('OK');

    expect(invalidValueRow.operationalSnapshot?.amountToCharge).toBeNull();
    expect(invalidValueRow.operationalSnapshot?.paymentState).toBe('PARTIAL');
    expect(invalidValueRow.operationalSnapshot?.openAmount).toBe(0.99);
    expect((invalidValueRow.operationalSnapshot?.rawJson.__quality as Record<string, unknown>).status).toBe(
      'REVIEW_REQUIRED'
    );
    expect(parsed.warnings).toContain('Aba planilha teste carros, linha 5: duplicata exata da origem ignorada');
    expect(parsed.warnings).toContain('Aba planilha teste carros, linha 6: Valor à Cobrar inválido (#VALUE!)');
    expect(parsed.warnings).toContain('Aba planilha teste carros, linha 6: Desconto inválido (F)');
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

  it('parses the complete workbook and splits operational, financial and fines domains', async () => {
    const buffer = await createWorkbookBuffer([
      {
        name: 'planilha teste carros',
        rows: [
          [
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
          ],
          ['01/02/2026', 1, 'Sim', 'Locado', 'ABC1D23', 'Onix', 'CLIKCAR/VICTOR', 'Jose', 1000, 50, 0, 1050, 10, 1000],
        ],
      },
      {
        name: 'Receita',
        rows: [
          ['Origem', 'Valor R$', 'Destino', 'Data', 'Mês', 'Ano'],
          ['Receita Carros', 2500, 'Banrisul', '05/02/2026', 'Fevereiro', 2026],
        ],
      },
      {
        name: 'Despesa',
        rows: [
          ['Tipo de Gasto', 'Detalhamento', 'Categoria', 'Valor R$', 'Fonte', 'Data', 'Mês', 'Ano'],
          ['Pagamento de Multas', 'Auto 1', 'Despesa Variável', 300, 'Banrisul', '06/02/2026', 'Fevereiro', 2026],
        ],
      },
      {
        name: 'Investimentos',
        rows: [
          ['Investimento', 'Valor R$', 'Fonte', 'Data', 'Mês', 'Ano'],
          ['Consórcio', 900, 'Banrisul', '07/02/2026', 'Fevereiro', 2026],
        ],
      },
      {
        name: 'Multas',
        rows: [
          ['Órgão autuador', 'Condutor', 'Paga', 'Valor', 'Placa', 'Auto de infração', 'Veículo', 'Data da infração'],
          ['DETRAN', 'Jose', 'NÃO', 195.23, 'ABC-1D23', 'AIT-900', 'Onix', '08/02/2026'],
        ],
      },
      {
        name: 'Quem Pagou',
        rows: [['PLACA', 'data Infração', 'data do pagamento', 'VALOR', 'Pago para'], ['ABC1D23', '08/02/2026', '10/02/2026', 195.23, 'CLIK']],
      },
      {
        name: 'Lucro',
        rows: [['Total Despesa', 'Total Receita', 'Lucro', 'Porcentagem', 'Data'], [300, 2500, 2200, 0.88, 'Fevereiro']],
      },
    ]);

    const parsed = await parseWorkbookBufferForTest(buffer, 'workbook-completo-2026.xlsm');

    expect(parsed.kind).toBe('WORKBOOK');
    expect(parsed.operationalRows).toHaveLength(1);
    expect(parsed.financialRows).toHaveLength(3);
    expect(parsed.fineRows).toHaveLength(1);
    expect(parsed.sheetNames).toEqual(
      expect.arrayContaining(['planilha teste carros', 'Receita', 'Despesa', 'Investimentos', 'Multas'])
    );
    expect(parsed.deferredSheets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheetName: 'Quem Pagou' }),
        expect.objectContaining({ sheetName: 'Lucro' }),
      ])
    );
    expect(parsed.financialRows.map((row) => row.domain)).toEqual(expect.arrayContaining(['REVENUE', 'EXPENSE', 'INVESTMENT']));
    expect(parsed.fineRows[0].ait).toBe('AIT-900');
    expect(parsed.fineRows[0].paymentState).toBe('UNPAID');
  });
});
