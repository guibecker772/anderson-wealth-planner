import { TransactionType, TransactionStatus } from '@prisma/client';

export interface ParsedTransaction {
  externalId: string | null;
  category: string | null;
  counterparty: string | null;
  description: string | null;
  unit: string | null;
  plannedDate: Date | null;
  dueDate: Date | null;
  actualDate: Date | null;
  plannedAmount: number;
  actualAmount: number | null;
  feesInterest: number | null;
  feesFine: number | null;
  discount: number | null;
  grossAmount: number | null;
  status: TransactionStatus;
  type: TransactionType;
  rawJson: any;
}

export function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  
  if (value instanceof Date) return value;
  
  // Serial date from Excel
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  
  // String Parsing (pt-BR dd/mm/yyyy)
  if (typeof value === 'string') {
    const [day, month, year] = value.split('/');
    if (day && month && year) {
      return new Date(`${year}-${month}-${day}`);
    }
  }
  
  return null;
}

export function parseCurrency(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  if (typeof value === 'string') {
    // Remove "R$", trim, replace dots (thousands) with empty, replace comma with dot
    const clean = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toUpperCase().trim();
    return v === 'SIM' || v === 'S' || v === 'YES' || v === 'TRUE';
  }
  return false;
}

export function mapRowToTransaction(
  row: any, 
  headerMap: Record<string, string>, 
  type: TransactionType,
  categoryFallback: string
): ParsedTransaction | null {
  // Helpers to safely get cell data
  const get = (key: string) => row[headerMap[key]];

  const externalId = get('Número do Lançamento');
  if (!externalId) return null; // Linha inválida sem ID

  const plannedDate = parseExcelDate(get('Data Prevista') || get('Data Vencimento'));
  const actualDate = parseExcelDate(get('Data Realizada') || get('Data Pagamento') || get('Data Recebimento'));
  
  const plannedAmount = parseCurrency(get('Valor Previsto') || get('Valor') || get('Valor do Título'));
  const actualAmountRaw = get('Valor Realizado') || get('Valor Pago') || get('Valor Recebido');
  
  // Lógica de Status
  const isPaid = parseBoolean(get('Pago')) || parseBoolean(get('Recebido')) || (actualDate !== null && actualAmountRaw !== undefined);
  
  const actualAmount = isPaid ? parseCurrency(actualAmountRaw) : null;
  
  return {
    externalId: String(externalId),
    category: get('Categoria') || categoryFallback,
    counterparty: get('Fornecedor') || get('Cliente') || get('Nome'),
    description: get('Descrição') || get('Histórico'),
    unit: get('Unidade') || null,
    plannedDate,
    dueDate: plannedDate, // Assumindo dueDate igual plannedDate
    actualDate,
    plannedAmount,
    actualAmount,
    feesInterest: parseCurrency(get('Juros')),
    feesFine: parseCurrency(get('Multa')),
    discount: parseCurrency(get('Desconto')),
    grossAmount: parseCurrency(get('Valor Bruto')),
    status: isPaid ? 'SETTLED' : 'PENDING',
    type,
    rawJson: row
  };
}