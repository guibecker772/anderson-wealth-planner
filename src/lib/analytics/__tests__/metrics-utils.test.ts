/**
 * Unit tests for metrics-utils.ts
 * 
 * Tests centralized rules for:
 * - Canonical date resolution
 * - Amount resolution
 * - Bucketing
 * - Previous period calculation
 * - Plate/AIT extraction
 * - Payer derivation
 */

import {
  resolveCanonicalDate,
  resolveAmount,
  chooseBucketGranularity,
  getBucketKey,
  calculatePreviousPeriod,
  calculateDelta,
  extractPlate,
  extractAIT,
  derivePaidBy,
  matchesPaidByFilter,
  normalizeClassKey,
  formatClassLabel,
  isMaintenanceCategory,
  isFinesCategory,
} from '../metrics-utils';

// ============================================================================
// CANONICAL DATE RESOLUTION
// ============================================================================

describe('resolveCanonicalDate', () => {
  it('should return dueDate when available', () => {
    const row = {
      dueDate: new Date('2026-01-15'),
      plannedDate: new Date('2026-01-10'),
      actualDate: new Date('2026-01-20'),
    };
    expect(resolveCanonicalDate(row)).toEqual(new Date('2026-01-15'));
  });

  it('should fallback to plannedDate when dueDate is null', () => {
    const row = {
      dueDate: null,
      plannedDate: new Date('2026-01-10'),
      actualDate: new Date('2026-01-20'),
    };
    expect(resolveCanonicalDate(row)).toEqual(new Date('2026-01-10'));
  });

  it('should fallback to actualDate when status is SETTLED and other dates are null', () => {
    const row = {
      dueDate: null,
      plannedDate: null,
      actualDate: new Date('2026-01-20'),
      status: 'SETTLED',
    };
    expect(resolveCanonicalDate(row)).toEqual(new Date('2026-01-20'));
  });

  it('should return null when all dates are null and not settled', () => {
    const row = {
      dueDate: null,
      plannedDate: null,
      actualDate: null,
      status: 'PENDING',
    };
    expect(resolveCanonicalDate(row)).toBeNull();
  });

  it('should handle invalid date objects', () => {
    const row = {
      dueDate: new Date('invalid'),
      plannedDate: new Date('2026-01-10'),
    };
    expect(resolveCanonicalDate(row)).toEqual(new Date('2026-01-10'));
  });
});

// ============================================================================
// AMOUNT RESOLUTION
// ============================================================================

describe('resolveAmount', () => {
  it('should return actualAmount for SETTLED transactions', () => {
    const row = {
      status: 'SETTLED',
      actualAmount: 150.50,
      plannedAmount: 100.00,
    };
    expect(resolveAmount(row)).toBe(150.50);
  });

  it('should return plannedAmount for PENDING transactions', () => {
    const row = {
      status: 'PENDING',
      actualAmount: null,
      plannedAmount: 100.00,
    };
    expect(resolveAmount(row)).toBe(100.00);
  });

  it('should return plannedAmount when actualAmount is 0 or null for SETTLED', () => {
    const row = {
      status: 'SETTLED',
      actualAmount: 0,
      plannedAmount: 100.00,
    };
    expect(resolveAmount(row)).toBe(100.00);
  });

  it('should fallback to grossAmount when other amounts are null', () => {
    const row = {
      status: 'PENDING',
      actualAmount: null,
      plannedAmount: null,
      grossAmount: 200.00,
    };
    expect(resolveAmount(row)).toBe(200.00);
  });

  it('should return 0 when all amounts are null', () => {
    const row = {
      status: 'PENDING',
      actualAmount: null,
      plannedAmount: null,
      grossAmount: null,
    };
    expect(resolveAmount(row)).toBe(0);
  });
});

// ============================================================================
// BUCKETING
// ============================================================================

describe('chooseBucketGranularity', () => {
  it('should return day for ranges up to 31 days', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    expect(chooseBucketGranularity(from, to)).toBe('day');
  });

  it('should return week for ranges 32-180 days', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-03-15');
    expect(chooseBucketGranularity(from, to)).toBe('week');
  });

  it('should return month for ranges over 180 days', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-12-31');
    expect(chooseBucketGranularity(from, to)).toBe('month');
  });
});

describe('getBucketKey', () => {
  it('should return YYYY-MM-DD for day granularity', () => {
    // Use explicit time to avoid timezone issues
    const date = new Date('2026-01-15T12:00:00');
    expect(getBucketKey(date, 'day')).toBe('2026-01-15');
  });

  it('should return week start date for week granularity', () => {
    // 2026-01-15 is a Thursday, week starts on Monday 2026-01-12
    const date = new Date('2026-01-15T12:00:00');
    expect(getBucketKey(date, 'week')).toBe('2026-01-12');
  });

  it('should return YYYY-MM for month granularity', () => {
    const date = new Date('2026-01-15T12:00:00');
    expect(getBucketKey(date, 'month')).toBe('2026-01');
  });
});

// ============================================================================
// PREVIOUS PERIOD CALCULATION
// ============================================================================

describe('calculatePreviousPeriod', () => {
  it('should calculate previous period correctly for 7 days', () => {
    const result = calculatePreviousPeriod('2026-01-08', '2026-01-14');
    expect(result.days).toBe(7);
    expect(result.previous.from).toBe('2026-01-01');
    expect(result.previous.to).toBe('2026-01-07');
  });

  it('should calculate previous period correctly for 30 days', () => {
    const result = calculatePreviousPeriod('2026-02-01', '2026-03-02');
    expect(result.days).toBe(30);
    expect(result.previous.from).toBe('2026-01-02');
    expect(result.previous.to).toBe('2026-01-31');
  });

  it('should handle single day period', () => {
    const result = calculatePreviousPeriod('2026-01-15', '2026-01-15');
    expect(result.days).toBe(1);
    expect(result.previous.from).toBe('2026-01-14');
    expect(result.previous.to).toBe('2026-01-14');
  });
});

describe('calculateDelta', () => {
  it('should calculate positive delta correctly', () => {
    const result = calculateDelta(150, 100);
    expect(result.value).toBe(50);
    expect(result.pct).toBe(50);
  });

  it('should calculate negative delta correctly', () => {
    const result = calculateDelta(80, 100);
    expect(result.value).toBe(-20);
    expect(result.pct).toBe(-20);
  });

  it('should handle zero previous value', () => {
    const result = calculateDelta(100, 0);
    expect(result.value).toBe(100);
    expect(result.pct).toBe(100); // 100% when going from 0 to positive
  });

  it('should return null pct when both are zero', () => {
    const result = calculateDelta(0, 0);
    expect(result.value).toBe(0);
    expect(result.pct).toBeNull();
  });
});

// ============================================================================
// PLATE EXTRACTION
// ============================================================================

describe('extractPlate', () => {
  it('should extract old format plate (AAA0000)', () => {
    expect(extractPlate('Multa veículo ABC1234 em 01/01/2026')).toBe('ABC1234');
  });

  it('should extract old format plate with hyphen (AAA-0000)', () => {
    expect(extractPlate('Multa veículo ABC-1234')).toBe('ABC1234');
  });

  it('should extract Mercosul format plate (AAA0A00)', () => {
    expect(extractPlate('Infração RUX0A78')).toBe('RUX0A78');
  });

  it('should extract Mercosul format with hyphen', () => {
    expect(extractPlate('Multa IXY-5F85')).toBe('IXY5F85');
  });

  it('should extract plate after PLACA: prefix', () => {
    expect(extractPlate('AIT 123456 PLACA: RVV8E70')).toBe('RVV8E70');
  });

  it('should not extract false positives like LOC-3422', () => {
    expect(extractPlate('LOC-3422 referência locação')).toBeNull();
  });

  it('should return null for text without plate', () => {
    expect(extractPlate('Pagamento de conta de luz')).toBeNull();
  });

  it('should handle null/undefined input', () => {
    expect(extractPlate(null)).toBeNull();
    expect(extractPlate(undefined)).toBeNull();
  });

  it('should normalize plate to uppercase without hyphen', () => {
    expect(extractPlate('placa abc-1234')).toBe('ABC1234');
  });
});

// ============================================================================
// AIT EXTRACTION
// ============================================================================

describe('extractAIT', () => {
  it('should extract AIT number after AIT: prefix', () => {
    expect(extractAIT('AIT: 123456789 multa de trânsito')).toBe('123456789');
  });

  it('should extract AIT number after AIT prefix without colon', () => {
    expect(extractAIT('AIT 987654321 infração')).toBe('987654321');
  });

  it('should extract auto number after AUTO: prefix', () => {
    expect(extractAIT('AUTO: 111222333')).toBe('111222333');
  });

  it('should return null for text without AIT', () => {
    expect(extractAIT('Multa de trânsito RUX0A78')).toBeNull();
  });

  it('should handle null/undefined input', () => {
    expect(extractAIT(null)).toBeNull();
    expect(extractAIT(undefined)).toBeNull();
  });
});

// ============================================================================
// PAYER DERIVATION
// ============================================================================

describe('derivePaidBy', () => {
  it('should return LESSOR for descriptions with locador keywords', () => {
    expect(derivePaidBy('Multa - REEMBOLSO LOCADOR')).toBe('LESSOR');
    expect(derivePaidBy('Desconto locador - infração')).toBe('LESSOR');
    expect(derivePaidBy('Cobrar locador AIT 123')).toBe('LESSOR');
  });

  it('should return COMPANY for descriptions with empresa keywords', () => {
    expect(derivePaidBy('Multa - RESPONSABILIDADE EMPRESA')).toBe('COMPANY');
    expect(derivePaidBy('CLIKCAR - infração')).toBe('COMPANY');
  });

  it('should return UNKNOWN for descriptions without keywords', () => {
    expect(derivePaidBy('Multa de trânsito ABC1234')).toBe('UNKNOWN');
  });

  it('should return UNKNOWN for null/undefined input', () => {
    expect(derivePaidBy(null)).toBe('UNKNOWN');
    expect(derivePaidBy(undefined)).toBe('UNKNOWN');
  });
});

describe('matchesPaidByFilter', () => {
  it('should match ALL filter with any paidBy', () => {
    expect(matchesPaidByFilter('COMPANY', 'ALL')).toBe(true);
    expect(matchesPaidByFilter('LESSOR', 'ALL')).toBe(true);
    expect(matchesPaidByFilter('UNKNOWN', 'ALL')).toBe(true);
  });

  it('should match COMPANY filter with COMPANY or UNKNOWN', () => {
    expect(matchesPaidByFilter('COMPANY', 'COMPANY')).toBe(true);
    expect(matchesPaidByFilter('UNKNOWN', 'COMPANY')).toBe(true);
    expect(matchesPaidByFilter('LESSOR', 'COMPANY')).toBe(false);
  });

  it('should match LESSOR filter only with LESSOR', () => {
    expect(matchesPaidByFilter('LESSOR', 'LESSOR')).toBe(true);
    expect(matchesPaidByFilter('COMPANY', 'LESSOR')).toBe(false);
    expect(matchesPaidByFilter('UNKNOWN', 'LESSOR')).toBe(false);
  });
});

// ============================================================================
// CATEGORY/CLASS NORMALIZATION
// ============================================================================

describe('normalizeClassKey', () => {
  it('should normalize to lowercase with hyphens', () => {
    expect(normalizeClassKey('Mecânica-Elétrica-Chaveiro')).toBe('mecanica-eletrica-chaveiro');
  });

  it('should handle spaces and special characters', () => {
    expect(normalizeClassKey('Peças & Acessórios')).toBe('pecas-acessorios');
  });

  it('should return sem-categoria for null/undefined', () => {
    expect(normalizeClassKey(null)).toBe('sem-categoria');
    expect(normalizeClassKey(undefined)).toBe('sem-categoria');
  });
});

describe('formatClassLabel', () => {
  it('should format to title case', () => {
    expect(formatClassLabel('mecanica-eletrica-chaveiro')).toBe('Mecanica Eletrica Chaveiro');
  });

  it('should handle underscores and hyphens', () => {
    expect(formatClassLabel('pecas_acessorios')).toBe('Pecas Acessorios');
  });

  it('should return Sem Categoria for null/undefined', () => {
    expect(formatClassLabel(null)).toBe('Sem Categoria');
    expect(formatClassLabel(undefined)).toBe('Sem Categoria');
  });
});

// ============================================================================
// CATEGORY CLASSIFICATION
// ============================================================================

describe('isMaintenanceCategory', () => {
  it('should return true for maintenance categories', () => {
    expect(isMaintenanceCategory('Mecânica-Elétrica-Chaveiro')).toBe(true);
    expect(isMaintenanceCategory('Peças-Acessórios')).toBe(true);
    expect(isMaintenanceCategory('Lavagem')).toBe(true);
    expect(isMaintenanceCategory('Funilaria-Pintura')).toBe(true);
  });

  it('should return false for non-maintenance categories', () => {
    expect(isMaintenanceCategory('Multas-Correios-Detran')).toBe(false);
    expect(isMaintenanceCategory('Aluguel')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isMaintenanceCategory(null)).toBe(false);
    expect(isMaintenanceCategory(undefined)).toBe(false);
  });
});

describe('isFinesCategory', () => {
  it('should return true for fines categories', () => {
    expect(isFinesCategory('Multas-Correios-Detran')).toBe(true);
    expect(isFinesCategory('Multas')).toBe(true);
    expect(isFinesCategory('Detran')).toBe(true);
  });

  it('should return false for non-fines categories', () => {
    expect(isFinesCategory('Mecânica-Elétrica-Chaveiro')).toBe(false);
    expect(isFinesCategory('Aluguel')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isFinesCategory(null)).toBe(false);
    expect(isFinesCategory(undefined)).toBe(false);
  });
});
