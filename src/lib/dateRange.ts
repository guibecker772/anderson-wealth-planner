/**
 * Date Range Utilities for Anderson Wealth Planner
 * 
 * Handles date range parsing, presets, and timezone-consistent operations.
 * All dates are treated as "date-only" (YYYY-MM-DD) with Brazil timezone.
 */

import { startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear, format, parse, isValid } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

// Brazil timezone
export const BRAZIL_TZ = 'America/Sao_Paulo';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangeStrings {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export type DatePreset = 
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje',
  last7days: 'Últimos 7 dias',
  last30days: 'Últimos 30 dias',
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  thisYear: 'Este ano',
  custom: 'Personalizado',
};

/**
 * Get current date in Brazil timezone
 */
export function getBrazilNow(): Date {
  return utcToZonedTime(new Date(), BRAZIL_TZ);
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date for display in pt-BR format (dd/MM/yyyy)
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Parse YYYY-MM-DD string to Date (at noon to avoid timezone issues)
 */
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
}

/**
 * Get date range from preset
 */
export function getPresetRange(preset: DatePreset): DateRangeStrings {
  const now = getBrazilNow();
  
  switch (preset) {
    case 'today':
      return {
        from: formatDateString(now),
        to: formatDateString(now),
      };
    
    case 'last7days':
      return {
        from: formatDateString(subDays(now, 6)),
        to: formatDateString(now),
      };
    
    case 'last30days':
      return {
        from: formatDateString(subDays(now, 29)),
        to: formatDateString(now),
      };
    
    case 'thisMonth':
      return {
        from: formatDateString(startOfMonth(now)),
        to: formatDateString(endOfMonth(now)),
      };
    
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      return {
        from: formatDateString(startOfMonth(lastMonth)),
        to: formatDateString(endOfMonth(lastMonth)),
      };
    }
    
    case 'thisYear':
      return {
        from: formatDateString(startOfYear(now)),
        to: formatDateString(endOfYear(now)),
      };
    
    case 'custom':
    default:
      // Default to this month
      return {
        from: formatDateString(startOfMonth(now)),
        to: formatDateString(endOfMonth(now)),
      };
  }
}

/**
 * Get the default date range (this month)
 */
export function getDefaultDateRange(): DateRangeStrings {
  return getPresetRange('thisMonth');
}

/**
 * Parse date range from URL search params
 * Returns default (this month) if no valid range is found
 */
export function parseDateRangeFromParams(searchParams: URLSearchParams | Record<string, string | undefined>): DateRangeStrings {
  const from = typeof searchParams.get === 'function' 
    ? searchParams.get('from') 
    : (searchParams as Record<string, string | undefined>).from;
  const to = typeof searchParams.get === 'function'
    ? searchParams.get('to')
    : (searchParams as Record<string, string | undefined>).to;
  
  // Validate dates
  const fromDate = from ? parseDateString(from) : null;
  const toDate = to ? parseDateString(to) : null;
  
  // If both valid, use them
  if (fromDate && toDate) {
    return { from: from!, to: to! };
  }
  
  // Otherwise return default
  return getDefaultDateRange();
}

/**
 * Helper to parse from plain object (for Server Components)
 */
export function parseDateRangeFromSearchParams(params: { from?: string; to?: string }): DateRangeStrings {
  const fromDate = params.from ? parseDateString(params.from) : null;
  const toDate = params.to ? parseDateString(params.to) : null;
  
  if (fromDate && toDate) {
    return { from: params.from!, to: params.to! };
  }
  
  return getDefaultDateRange();
}

/**
 * Convert date range to database query conditions
 * The "to" date is inclusive (end of day)
 */
export function dateRangeToDbFilter(range: DateRangeStrings): { gte: Date; lte: Date } {
  // Parse dates at start of day for 'from' and end of day for 'to'
  const fromDate = new Date(range.from + 'T00:00:00.000Z');
  const toDate = new Date(range.to + 'T23:59:59.999Z');
  
  return {
    gte: fromDate,
    lte: toDate,
  };
}

/**
 * Get short display label for a date range
 */
export function getDateRangeLabel(range: DateRangeStrings): string {
  const defaultRange = getDefaultDateRange();
  
  // Check if it matches a preset
  if (range.from === defaultRange.from && range.to === defaultRange.to) {
    return 'Este mês';
  }
  
  // Check other presets
  const presets: DatePreset[] = ['today', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'thisYear'];
  for (const preset of presets) {
    const presetRange = getPresetRange(preset);
    if (range.from === presetRange.from && range.to === presetRange.to) {
      return DATE_PRESET_LABELS[preset];
    }
  }
  
  // Custom range - show dates
  return `${formatDateDisplay(range.from)} → ${formatDateDisplay(range.to)}`;
}

/**
 * Build URL search params string preserving date range
 */
export function buildSearchParamsWithDateRange(
  baseParams: Record<string, string | number | undefined>,
  dateRange: DateRangeStrings
): string {
  const params = new URLSearchParams();
  
  // Add date range
  params.set('from', dateRange.from);
  params.set('to', dateRange.to);
  
  // Add other params
  for (const [key, value] of Object.entries(baseParams)) {
    if (value !== undefined && value !== '' && key !== 'from' && key !== 'to') {
      params.set(key, String(value));
    }
  }
  
  return params.toString();
}
