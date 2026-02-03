import ExcelJS from 'exceljs';
import { mapRowToTransaction, ParsedTransaction } from './common';

export async function parseReceivables(buffer: Buffer): Promise<ParsedTransaction[]> {
  const workbook = new ExcelJS.Workbook();
  // Use Uint8Array for compatibility with Node.js 22+ Buffer types
  await workbook.xlsx.load(new Uint8Array(buffer) as unknown as ExcelJS.Buffer);
  const transactions: ParsedTransaction[] = [];

  for (const worksheet of workbook.worksheets) {
    // Encontrar linha do header
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (headerRowIndex !== -1) return;
      const values = row.values as any[];
      for (let i = 1; i < values.length; i++) {
        const cell = String(values[i] || '');
        if (cell.includes('Número do Lançamento') || cell.includes('Lançamento')) {
          headerRowIndex = rowNumber;
          headers = values.slice(1).map(v => String(v || '').trim());
          break;
        }
      }
    });

    if (headerRowIndex === -1) continue;

    // Processar linhas de dados
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;
      
      const values = row.values as any[];
      const rowObj: Record<string, any> = {};
      
      headers.forEach((header, idx) => {
        const cellValue = values[idx + 1];
        rowObj[header] = cellValue instanceof Date ? cellValue : 
                         (typeof cellValue === 'object' && cellValue?.result !== undefined) ? cellValue.result : cellValue;
      });

      const headerMap: Record<string, string> = {};
      Object.keys(rowObj).forEach(key => {
        const k = key.trim();
        if (k.includes('Lançamento')) headerMap['Número do Lançamento'] = key;
        if (k.includes('Categoria')) headerMap['Categoria'] = key;
        if (k.includes('Cliente')) headerMap['Cliente'] = key;
        if (k.includes('Histórico')) headerMap['Histórico'] = key;
        if (k.includes('Unidade')) headerMap['Unidade'] = key;
        if (k.includes('Vencimento')) headerMap['Data Prevista'] = key;
        if (k.includes('Recebimento')) headerMap['Data Realizada'] = key;
        if (k.includes('Valor do Título') || k === 'Valor') headerMap['Valor Previsto'] = key;
        if (k.includes('Valor Recebido')) headerMap['Valor Realizado'] = key;
        if (k.includes('Recebido')) headerMap['Recebido'] = key;
        if (k.includes('Juros')) headerMap['Juros'] = key;
        if (k.includes('Multa')) headerMap['Multa'] = key;
        if (k.includes('Desconto')) headerMap['Desconto'] = key;
      });

      const tx = mapRowToTransaction(rowObj, headerMap, 'RECEIVABLE', 'Receitas');
      if (tx) transactions.push(tx);
    });
  }

  return transactions;
}