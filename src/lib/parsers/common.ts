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
