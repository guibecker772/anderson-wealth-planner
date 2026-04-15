/** @jest-environment node */

import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  OFFICIAL_WORKBOOK_SHEETS,
  WORKBOOK_SAMPLE_FILE,
  WORKBOOK_SHEET_CONTRACTS,
} from '../workbookTemplateContract';

async function loadSampleWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(process.cwd(), WORKBOOK_SAMPLE_FILE));
  return workbook;
}

function normalizeCellValue(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      const text = value.text.trim();
      return text.length > 0 ? text : null;
    }

    if ('result' in value && value.result !== undefined) {
      return normalizeCellValue(value.result as ExcelJS.CellValue);
    }

    if ('richText' in value && Array.isArray(value.richText)) {
      const text = value.richText.map((part) => part.text).join('').trim();
      return text.length > 0 ? text : null;
    }
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

describe('workbookTemplateContract', () => {
  it('defines one contract for each official workbook sheet', () => {
    expect(
      [...WORKBOOK_SHEET_CONTRACTS.map((contract) => contract.sheetName)].sort(),
    ).toEqual([...OFFICIAL_WORKBOOK_SHEETS].sort());

    for (const contract of WORKBOOK_SHEET_CONTRACTS) {
      expect(contract.columns).toHaveLength(contract.expectedColumns.length);
      expect(contract.keys.map((key) => key.kind)).toEqual(['RAW_LINE', 'DEDUPE', 'BUSINESS']);
      expect(contract.validationRules.length).toBeGreaterThan(0);
    }
  });

  it('matches the real sample workbook sheet names and headers', async () => {
    const workbook = await loadSampleWorkbook();

    expect([...workbook.worksheets.map((sheet) => sheet.name)].sort()).toEqual([...OFFICIAL_WORKBOOK_SHEETS].sort());

    for (const contract of WORKBOOK_SHEET_CONTRACTS) {
      const worksheet = workbook.getWorksheet(contract.sheetName);
      expect(worksheet).toBeDefined();

      const actualHeaders = contract.expectedColumns.map((_, index) =>
        normalizeCellValue(worksheet!.getRow(1).getCell(index + 1).value),
      );

      expect(actualHeaders).toEqual(contract.expectedColumns);
    }
  });

  it('keeps at least one non-empty detail row in every non-reconciliation sheet of the sample', async () => {
    const workbook = await loadSampleWorkbook();

    for (const contract of WORKBOOK_SHEET_CONTRACTS.filter((sheet) => sheet.role !== 'RECONCILIATION_ONLY')) {
      const worksheet = workbook.getWorksheet(contract.sheetName);
      expect(worksheet).toBeDefined();

      let detailRows = 0;
      for (let rowNumber = 2; rowNumber <= worksheet!.rowCount; rowNumber++) {
        const values = contract.expectedColumns.map((_, index) =>
          normalizeCellValue(worksheet!.getRow(rowNumber).getCell(index + 1).value),
        );

        if (values.some((value) => value != null)) detailRows += 1;
      }

      expect(detailRows).toBeGreaterThan(0);
    }
  });
});
