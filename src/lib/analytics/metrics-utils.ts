/**
 * Metrics Utilities - Centralized rules for data normalization
 * 
 * This module provides single source of truth for:
 * - Canonical date resolution (competence → fallback)
 * - Amount resolution (paid/received vs planned)
 * - Bucketing (day/week/month based on date range)
 * - Previous period calculation
 * - Plate/AIT extraction from descriptions
 * - Payer derivation for fines
 */

import { format, differenceInDays, startOfWeek, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// TYPES
// ============================================================================

export type BucketGranularity = 'day' | 'week' | 'month';

export type PaidBy = 'COMPANY' | 'LESSOR' | 'UNKNOWN';

export type TransactionScope = 'income' | 'expense' | 'fines';

export interface DateRangeStrings {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface PeriodComparison {
  current: DateRangeStrings;
  previous: DateRangeStrings;
  days: number;
}

export interface MetricsSummary {
  total: number;
  count: number;
  prevTotal: number;
  prevCount: number;
  deltaValue: number;
  deltaPct: number | null; // null when previous is 0
}

export interface TimeSeriesPoint {
  date: string;    // bucket key (YYYY-MM-DD or YYYY-Www or YYYY-MM)
  total: number;
  count: number;
}

export interface RankingItem {
  key: string;      // classKey or plate
  label: string;    // display label
  total: number;
  count: number;
}

// ============================================================================
// CANONICAL DATE RESOLUTION
// ============================================================================

/**
 * Resolve canonical date from a transaction row
 * Priority: competenceDate (dueDate) → plannedDate → actualDate (if paid)
 * 
 * @param row - Transaction record with date fields
 * @returns Date object or null if no valid date found
 */
export function resolveCanonicalDate(row: {
  dueDate?: Date | null;
  plannedDate?: Date | null;
  actualDate?: Date | null;
  status?: string;
}): Date | null {
  // 1. Try dueDate (competence/vencimento)
  if (row.dueDate && row.dueDate instanceof Date && !isNaN(row.dueDate.getTime())) {
    return row.dueDate;
  }
  
  // 2. Fallback to plannedDate
  if (row.plannedDate && row.plannedDate instanceof Date && !isNaN(row.plannedDate.getTime())) {
    return row.plannedDate;
  }
  
  // 3. If settled, use actualDate as last resort
  if (row.status === 'SETTLED' && row.actualDate && row.actualDate instanceof Date && !isNaN(row.actualDate.getTime())) {
    return row.actualDate;
  }
  
  return null;
}

// ============================================================================
// AMOUNT RESOLUTION
// ============================================================================

/**
 * Resolve the correct amount for aggregation
 * Rule: If SETTLED → actualAmount (if exists) else plannedAmount
 *       If PENDING → plannedAmount
 * 
 * @param row - Transaction record with amount fields
 * @returns Resolved amount as number
 */
export function resolveAmount(row: {
  status?: string;
  actualAmount?: number | null;
  plannedAmount?: number | null;
  grossAmount?: number | null;
}): number {
  const isSettled = row.status === 'SETTLED';
  
  if (isSettled && row.actualAmount != null && row.actualAmount > 0) {
    return Number(row.actualAmount);
  }
  
  if (row.plannedAmount != null) {
    return Number(row.plannedAmount);
  }
  
  // Fallback to grossAmount if nothing else available
  if (row.grossAmount != null) {
    return Number(row.grossAmount);
  }
  
  return 0;
}

// ============================================================================
// BUCKETING
// ============================================================================

/**
 * Choose appropriate bucket granularity based on date range
 * Rules:
 * - Up to 31 days: daily
 * - 32–180 days: weekly
 * - >180 days: monthly
 */
export function chooseBucketGranularity(from: Date, to: Date): BucketGranularity {
  const days = differenceInDays(to, from) + 1;
  
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/**
 * Get bucket key for a date based on granularity
 */
export function getBucketKey(date: Date, granularity: BucketGranularity): string {
  switch (granularity) {
    case 'day':
      return format(date, 'yyyy-MM-dd');
    case 'week':
      // ISO week (Monday start)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return format(weekStart, 'yyyy-MM-dd');
    case 'month':
      return format(date, 'yyyy-MM');
  }
}

/**
 * Format bucket key for display
 */
export function formatBucketLabel(key: string, granularity: BucketGranularity): string {
  try {
    switch (granularity) {
      case 'day':
        return format(parseISO(key), 'dd/MM', { locale: ptBR });
      case 'week':
        return `Sem ${format(parseISO(key), 'dd/MM', { locale: ptBR })}`;
      case 'month':
        return format(parseISO(key + '-01'), 'MMM/yy', { locale: ptBR });
    }
  } catch {
    return key;
  }
}

// ============================================================================
// PREVIOUS PERIOD CALCULATION
// ============================================================================

/**
 * Calculate the previous period for comparison
 * If current range is [from, to], previous is shifted back by the same duration
 */
export function calculatePreviousPeriod(from: string, to: string): PeriodComparison {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const days = differenceInDays(toDate, fromDate) + 1;
  
  const prevTo = subDays(fromDate, 1);
  const prevFrom = subDays(fromDate, days);
  
  return {
    current: { from, to },
    previous: {
      from: format(prevFrom, 'yyyy-MM-dd'),
      to: format(prevTo, 'yyyy-MM-dd'),
    },
    days,
  };
}

/**
 * Calculate delta (variation) between two values
 */
export function calculateDelta(current: number, previous: number): { value: number; pct: number | null } {
  const deltaValue = current - previous;
  
  // Avoid division by zero
  const deltaPct = previous !== 0 
    ? ((current - previous) / previous) * 100 
    : (current > 0 ? 100 : null);
  
  return {
    value: deltaValue,
    pct: deltaPct,
  };
}

// ============================================================================
// PLATE EXTRACTION (for fines and vehicles)
// ============================================================================

/**
 * Brazilian license plate patterns:
 * - Old format: AAA-0000 or AAA0000 (3 letters + 4 digits)
 * - Mercosul: AAA0A00 (3 letters + 1 digit + 1 letter + 2 digits)
 */
const PLATE_PATTERNS = {
  // Old format with optional hyphen
  old: /\b([A-Z]{3})-?(\d{4})\b/gi,
  // Mercosul format with optional hyphen
  mercosul: /\b([A-Z]{3})-?(\d)([A-Z])(\d{2})\b/gi,
};

// Patterns to exclude (false positives) - checked against normalized plates (no hyphen)
const EXCLUDE_PATTERNS = [
  /^LOC\d+$/i,      // LOC3422 (locação reference)
  /^NF\d+$/i,       // NF1234 (nota fiscal)
  /^REF\d+$/i,      // REF123
  /^ID\d+$/i,       // ID123
];

/**
 * Extract license plate from text description
 * Normalizes to uppercase without hyphen
 */
export function extractPlate(text: string | null | undefined): string | null {
  if (!text) return null;
  
  const upperText = text.toUpperCase();
  
  // Try to find plate after common prefixes
  const prefixPatterns = [
    /PLACA[:\s]+([A-Z]{3})-?(\d[A-Z0-9]\d{2}|\d{4})/i,
    /AIT[:\s]+\d+[^\d]*([A-Z]{3})-?(\d[A-Z0-9]\d{2}|\d{4})/i,
    /VEÍCULO[:\s]+([A-Z]{3})-?(\d[A-Z0-9]\d{2}|\d{4})/i,
    /VEICULO[:\s]+([A-Z]{3})-?(\d[A-Z0-9]\d{2}|\d{4})/i,
  ];
  
  for (const pattern of prefixPatterns) {
    const match = upperText.match(pattern);
    if (match) {
      const plate = (match[1] + match[2]).replace(/-/g, '');
      if (!isExcludedPattern(plate)) {
        return plate;
      }
    }
  }
  
  // Try Mercosul pattern first (more specific)
  const mercosulMatches = [...upperText.matchAll(PLATE_PATTERNS.mercosul)];
  for (const match of mercosulMatches) {
    const plate = (match[1] + match[2] + match[3] + match[4]).replace(/-/g, '');
    if (!isExcludedPattern(plate)) {
      return plate;
    }
  }
  
  // Try old format
  const oldMatches = [...upperText.matchAll(PLATE_PATTERNS.old)];
  for (const match of oldMatches) {
    const plate = (match[1] + match[2]).replace(/-/g, '');
    if (!isExcludedPattern(plate)) {
      return plate;
    }
  }
  
  return null;
}

function isExcludedPattern(text: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(text));
}

// ============================================================================
// AIT EXTRACTION (Auto Infraction Notice number)
// ============================================================================

/**
 * Extract AIT (Auto de Infração de Trânsito) number from text
 * Common formats: AIT: 123456, AIT 123456, etc.
 */
export function extractAIT(text: string | null | undefined): string | null {
  if (!text) return null;
  
  const patterns = [
    /AIT[:\s]*(\d{6,15})/i,
    /AUTO[:\s]*(\d{6,15})/i,
    /N[º°]?\s*(\d{6,15})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// ============================================================================
// PAYER DERIVATION (for fines)
// ============================================================================

/**
 * Derive who pays for a fine based on description/observations
 * Uses heuristics when no explicit field exists
 * 
 * Keywords for LESSOR:
 * - LOCADOR, LOCATÁRIO, REEMBOLSO, REPASSE, DESCONTO LOCADOR
 * 
 * Keywords for COMPANY (explicit):
 * - EMPRESA, CLIKCAR
 * 
 * Default: UNKNOWN (treated as COMPANY for aggregation purposes)
 */
export function derivePaidBy(text: string | null | undefined): PaidBy {
  if (!text) return 'UNKNOWN';
  
  const upperText = text.toUpperCase();
  
  // Check for LESSOR indicators
  const lessorKeywords = [
    'LOCADOR', 'LOCATÁRIO', 'LOCATARIO',
    'REEMBOLSO', 'REPASSE', 'DESCONTO LOCADOR',
    'COBRAR LOCADOR', 'RESPONSABILIDADE LOCADOR',
    'CONTA LOCADOR',
  ];
  
  for (const keyword of lessorKeywords) {
    if (upperText.includes(keyword)) {
      return 'LESSOR';
    }
  }
  
  // Check for COMPANY explicit indicators
  const companyKeywords = [
    'EMPRESA', 'CLIKCAR', 'CLIK CAR',
    'RESPONSABILIDADE EMPRESA', 'CONTA EMPRESA',
  ];
  
  for (const keyword of companyKeywords) {
    if (upperText.includes(keyword)) {
      return 'COMPANY';
    }
  }
  
  // Default to UNKNOWN (will be treated as COMPANY for aggregation)
  return 'UNKNOWN';
}

/**
 * Filter transactions by paidBy filter value
 * 'ALL' → include all
 * 'COMPANY' → include COMPANY + UNKNOWN (per business rule)
 * 'LESSOR' → only LESSOR
 */
export function matchesPaidByFilter(paidBy: PaidBy, filter: 'ALL' | 'COMPANY' | 'LESSOR'): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'COMPANY':
      // UNKNOWN counts as COMPANY per business rule
      return paidBy === 'COMPANY' || paidBy === 'UNKNOWN';
    case 'LESSOR':
      return paidBy === 'LESSOR';
  }
}

// ============================================================================
// CATEGORY/CLASS NORMALIZATION
// ============================================================================

/**
 * Normalize category/class key for internal use
 * Converts to lowercase, removes accents, replaces spaces with hyphens
 */
export function normalizeClassKey(name: string | null | undefined): string {
  if (!name) return 'sem-categoria';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '');        // Trim leading/trailing hyphens
}

/**
 * Format category label for display
 * Title case with proper capitalization
 */
export function formatClassLabel(name: string | null | undefined): string {
  if (!name) return 'Sem Categoria';
  
  // Simple title case
  return name
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// MAINTENANCE CLASSES CONFIGURATION
// ============================================================================

/**
 * Classes/categories that count as maintenance/repairs for investor reports
 * This is configurable and can be adjusted based on business needs
 */
export const MAINTENANCE_CLASSES = [
  'mecanica-eletrica-chaveiro',
  'pecas-acessorios',
  'peças-acessórios',
  'saidas-para-mecanicar',
  'saídas-para-mecanica',
  'lavagem',
  'funilaria-pintura',
  'funilaria',
  'pneus',
  'revisao',
  'revisão',
  'manutencao',
  'manutenção',
  'oficina',
  'reparos',
];

/**
 * Check if a category is a maintenance category
 */
export function isMaintenanceCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const key = normalizeClassKey(category);
  return MAINTENANCE_CLASSES.some(m => key.includes(m) || m.includes(key));
}

/**
 * Classes/categories that are fines
 */
export const FINES_CLASSES = [
  'multas-correios-detran',
  'multas',
  'infrações',
  'infracoes',
  'detran',
  'correios',
];

/**
 * Check if a category is a fines category
 */
export function isFinesCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const key = normalizeClassKey(category);
  return FINES_CLASSES.some(f => key.includes(f) || f.includes(key));
}

// ============================================================================
// LOGGING & OBSERVABILITY
// ============================================================================

interface IngestionStats {
  totalRows: number;
  validRows: number;
  missingDate: number;
  missingAmount: number;
  missingPlate: number;
  unknownPayer: number;
}

/**
 * Create an ingestion stats tracker for observability
 */
export function createIngestionStats(): IngestionStats {
  return {
    totalRows: 0,
    validRows: 0,
    missingDate: 0,
    missingAmount: 0,
    missingPlate: 0,
    unknownPayer: 0,
  };
}

/**
 * Log ingestion stats summary
 */
export function logIngestionStats(stats: IngestionStats, context: string): void {
  const pctMissingDate = stats.totalRows > 0 
    ? ((stats.missingDate / stats.totalRows) * 100).toFixed(1) 
    : '0';
  const pctMissingAmount = stats.totalRows > 0 
    ? ((stats.missingAmount / stats.totalRows) * 100).toFixed(1) 
    : '0';
  const pctMissingPlate = stats.totalRows > 0 
    ? ((stats.missingPlate / stats.totalRows) * 100).toFixed(1) 
    : '0';
  const pctUnknownPayer = stats.totalRows > 0 
    ? ((stats.unknownPayer / stats.totalRows) * 100).toFixed(1) 
    : '0';
  
  console.log(`[${context}] Ingestion Stats:`, {
    total: stats.totalRows,
    valid: stats.validRows,
    missingDate: `${stats.missingDate} (${pctMissingDate}%)`,
    missingAmount: `${stats.missingAmount} (${pctMissingAmount}%)`,
    missingPlate: `${stats.missingPlate} (${pctMissingPlate}%)`,
    unknownPayer: `${stats.unknownPayer} (${pctUnknownPayer}%)`,
  });
}
