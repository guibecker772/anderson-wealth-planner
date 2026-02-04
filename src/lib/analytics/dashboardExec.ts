/**
 * Executive Dashboard Analytics
 * 
 * Provides aggregated data for executive decision making:
 * - Summary: income received, expense paid, profit (cash), margin
 * - Comparison: vs previous period (same duration)
 * - Series: bucketed (day/week/month) time series for charts
 * - Drivers: top expense categories explaining changes
 * 
 * All metrics use CASH view:
 * - Income: actualDate (when received)
 * - Expense: actualDate (when paid)
 */

import { 
  differenceInDays, 
  subDays, 
  parseISO, 
  format, 
  startOfWeek, 
  startOfMonth,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  isAfter,
} from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

// ============================================================================
// TYPES
// ============================================================================

export type BucketGranularity = 'day' | 'week' | 'month';

export interface DateRangeStrings {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface ExecSummary {
  incomeReceived: number;
  expensePaid: number;
  profitCash: number;
  margin: number | null; // profitCash / incomeReceived (null if income=0)
  receivable: number;    // pending by dueDate
  payable: number;       // pending by dueDate
  receivableOverdue: number;
  payableOverdue: number;
}

export interface ExecComparison {
  incomeReceived: { prev: number; deltaValue: number; deltaPct: number | null };
  expensePaid: { prev: number; deltaValue: number; deltaPct: number | null };
  profitCash: { prev: number; deltaValue: number; deltaPct: number | null };
  margin: { prev: number | null; deltaPP: number | null }; // delta in percentage points
}

export interface ExecSeriesPoint {
  bucketStart: string;   // YYYY-MM-DD (start of bucket)
  bucketLabel: string;   // Formatted label for display
  incomeReceived: number;
  expensePaid: number;
  profitCash: number;
}

export interface CategoryDriver {
  categoryId: string | null;
  categoryName: string;
  totalPaid: number;
  prevTotalPaid: number | null;
  deltaValue: number | null;
  deltaPct: number | null;
}

export interface ExecDashboardResponse {
  summary: ExecSummary;
  comparison: ExecComparison;
  series: ExecSeriesPoint[];
  drivers: CategoryDriver[];
  dateRange: DateRangeStrings;
  previousRange: DateRangeStrings;
  bucket: BucketGranularity;
}

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

export const BRAZIL_TZ = 'America/Sao_Paulo';

export function getBrazilNow(): Date {
  return utcToZonedTime(new Date(), BRAZIL_TZ);
}

export function getBrazilTodayStart(): Date {
  return startOfDay(getBrazilNow());
}

/**
 * Convert date string range to database filter dates
 */
export function dateRangeToDbFilter(dateRange: DateRangeStrings): { gte: Date; lte: Date } {
  const startBrazil = new Date(`${dateRange.from}T00:00:00`);
  const endBrazil = new Date(`${dateRange.to}T23:59:59.999`);
  
  return {
    gte: zonedTimeToUtc(startBrazil, BRAZIL_TZ),
    lte: zonedTimeToUtc(endBrazil, BRAZIL_TZ),
  };
}

/**
 * Calculate previous period with same duration
 */
export function calculatePreviousPeriod(from: string, to: string): DateRangeStrings {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const days = differenceInDays(toDate, fromDate) + 1;
  
  const prevTo = subDays(fromDate, 1);
  const prevFrom = subDays(fromDate, days);
  
  return {
    from: format(prevFrom, 'yyyy-MM-dd'),
    to: format(prevTo, 'yyyy-MM-dd'),
  };
}

/**
 * Calculate percentage delta, handling division by zero
 */
export function calculateDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Calculate margin (profit / income)
 */
export function calculateMargin(profit: number, income: number): number | null {
  if (income === 0) return null;
  return (profit / income) * 100;
}

/**
 * Get bucket key (start date) for a given date and granularity
 */
export function getBucketKey(date: Date, granularity: BucketGranularity): string {
  switch (granularity) {
    case 'day':
      return format(date, 'yyyy-MM-dd');
    case 'week':
      // ISO week starts on Monday
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM-dd');
  }
}

/**
 * Get bucket label for display
 */
export function getBucketLabel(bucketStart: string, granularity: BucketGranularity): string {
  const date = parseISO(bucketStart);
  switch (granularity) {
    case 'day':
      return format(date, 'dd/MM');
    case 'week':
      return `Sem ${format(date, 'dd/MM')}`;
    case 'month':
      return format(date, 'MMM/yy');
  }
}

/**
 * Generate all bucket keys for a date range (including empty ones)
 */
export function generateBuckets(
  from: string, 
  to: string, 
  granularity: BucketGranularity
): string[] {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const buckets: string[] = [];
  
  let current: Date;
  
  switch (granularity) {
    case 'day':
      current = startOfDay(fromDate);
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
      }
      break;
    case 'week':
      current = startOfWeek(fromDate, { weekStartsOn: 1 });
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addWeeks(current, 1);
      }
      break;
    case 'month':
      current = startOfMonth(fromDate);
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addMonths(current, 1);
      }
      break;
  }
  
  return buckets;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get summary metrics for a period (CASH view - by actualDate)
 */
export async function getExecSummary(
  db: unknown,
  dateRange: DateRangeStrings
): Promise<ExecSummary> {
  const prisma = db as {
    transaction: {
      aggregate: (args: unknown) => Promise<{
        _sum: { actualAmount: unknown; plannedAmount: unknown };
        _count: { id: number };
      }>;
    };
  };
  
  const dateFilter = dateRangeToDbFilter(dateRange);
  const todayStart = getBrazilTodayStart();

  const [
    incomeReceivedResult,
    expensePaidResult,
    receivableResult,
    payableResult,
    receivableOverdueResult,
    payableOverdueResult,
  ] = await Promise.all([
    // Income Received - SETTLED, by actualDate
    prisma.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'SETTLED',
        actualDate: { gte: dateFilter.gte, lte: dateFilter.lte },
      },
      _sum: { actualAmount: true, plannedAmount: true },
      _count: { id: true },
    }),
    
    // Expense Paid - SETTLED, by actualDate
    prisma.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        actualDate: { gte: dateFilter.gte, lte: dateFilter.lte },
      },
      _sum: { actualAmount: true, plannedAmount: true },
      _count: { id: true },
    }),
    
    // Receivable - PENDING, by dueDate
    prisma.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        dueDate: { gte: dateFilter.gte, lte: dateFilter.lte },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Payable - PENDING, by dueDate
    prisma.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: { gte: dateFilter.gte, lte: dateFilter.lte },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Receivable Overdue
    prisma.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        dueDate: { gte: dateFilter.gte, lte: dateFilter.lte, lt: todayStart },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Payable Overdue
    prisma.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: { gte: dateFilter.gte, lte: dateFilter.lte, lt: todayStart },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
  ]);

  const incomeReceived = Number(incomeReceivedResult._sum.actualAmount || incomeReceivedResult._sum.plannedAmount || 0);
  const expensePaid = Number(expensePaidResult._sum.actualAmount || expensePaidResult._sum.plannedAmount || 0);
  const profitCash = incomeReceived - expensePaid;

  return {
    incomeReceived,
    expensePaid,
    profitCash,
    margin: calculateMargin(profitCash, incomeReceived),
    receivable: Number(receivableResult._sum.plannedAmount || 0),
    payable: Number(payableResult._sum.plannedAmount || 0),
    receivableOverdue: Number(receivableOverdueResult._sum.plannedAmount || 0),
    payableOverdue: Number(payableOverdueResult._sum.plannedAmount || 0),
  };
}

/**
 * Get time series data bucketed by granularity (CASH view)
 */
export async function getExecSeries(
  db: unknown,
  dateRange: DateRangeStrings,
  granularity: BucketGranularity
): Promise<ExecSeriesPoint[]> {
  const prisma = db as {
    $queryRawUnsafe: <T>(query: string, ...params: unknown[]) => Promise<T>;
  };
  
  const dateFilter = dateRangeToDbFilter(dateRange);
  
  // Map granularity to PostgreSQL date_trunc argument
  const truncFn = granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day';
  
  // Query raw data grouped by bucket and type
  const rawData = await prisma.$queryRawUnsafe<Array<{
    date_period: Date | string;
    type: string;
    total: number | string;
  }>>(`
    SELECT 
      date_trunc('${truncFn}', "actualDate") as date_period,
      type,
      SUM(COALESCE("actualAmount", "plannedAmount")) as total
    FROM "Transaction"
    WHERE 
      status = 'SETTLED'
      AND "actualDate" >= $1
      AND "actualDate" <= $2
    GROUP BY date_trunc('${truncFn}', "actualDate"), type
    ORDER BY date_period ASC
  `, dateFilter.gte, dateFilter.lte);

  // Create map of bucket -> amounts
  const bucketMap = new Map<string, { income: number; expense: number }>();
  
  for (const row of rawData) {
    const dateStr = row.date_period instanceof Date 
      ? row.date_period.toISOString().split('T')[0]
      : String(row.date_period).split('T')[0];
    
    // Normalize to bucket key
    const bucketKey = getBucketKey(parseISO(dateStr), granularity);
    
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { income: 0, expense: 0 });
    }
    
    const entry = bucketMap.get(bucketKey)!;
    const amount = Number(row.total || 0);
    
    if (row.type === 'RECEIVABLE') {
      entry.income += amount;
    } else {
      entry.expense += amount;
    }
  }

  // Generate all buckets (including empty ones)
  const allBuckets = generateBuckets(dateRange.from, dateRange.to, granularity);
  
  // Build result with all buckets
  return allBuckets.map(bucketStart => {
    const data = bucketMap.get(bucketStart) || { income: 0, expense: 0 };
    return {
      bucketStart,
      bucketLabel: getBucketLabel(bucketStart, granularity),
      incomeReceived: data.income,
      expensePaid: data.expense,
      profitCash: data.income - data.expense,
    };
  });
}

/**
 * Get top expense categories (drivers) with comparison
 */
export async function getExecDrivers(
  db: unknown,
  dateRange: DateRangeStrings,
  previousRange: DateRangeStrings,
  limit: number = 5
): Promise<CategoryDriver[]> {
  const prisma = db as {
    transaction: {
      groupBy: (args: unknown) => Promise<Array<{
        category: string | null;
        _sum: { actualAmount: unknown; plannedAmount: unknown };
        _count: { id: number };
      }>>;
    };
  };
  
  const currentFilter = dateRangeToDbFilter(dateRange);
  const prevFilter = dateRangeToDbFilter(previousRange);

  // Query current period top categories
  const currentCategories = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      type: 'PAYABLE',
      status: 'SETTLED',
      actualDate: { gte: currentFilter.gte, lte: currentFilter.lte },
    },
    _sum: { actualAmount: true, plannedAmount: true },
    _count: { id: true },
    orderBy: { _sum: { actualAmount: 'desc' } },
    take: limit,
  });

  // Get category names from current top list
  const topCategoryNames = currentCategories.map(c => c.category);

  // Query previous period for same categories
  const prevCategories = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      type: 'PAYABLE',
      status: 'SETTLED',
      actualDate: { gte: prevFilter.gte, lte: prevFilter.lte },
      category: { in: topCategoryNames.filter(c => c !== null) as string[] },
    },
    _sum: { actualAmount: true, plannedAmount: true },
    _count: { id: true },
  });

  // Create map of prev totals
  const prevMap = new Map<string | null, number>();
  for (const cat of prevCategories) {
    const total = Number(cat._sum.actualAmount || cat._sum.plannedAmount || 0);
    prevMap.set(cat.category, total);
  }

  // Build result with deltas
  return currentCategories.map(cat => {
    const current = Number(cat._sum.actualAmount || cat._sum.plannedAmount || 0);
    const prev = prevMap.get(cat.category) ?? null;
    
    const deltaValue = prev !== null ? current - prev : null;
    const deltaPct = prev !== null ? calculateDeltaPct(current, prev) : null;

    return {
      categoryId: cat.category,
      categoryName: cat.category || 'Sem Categoria',
      totalPaid: current,
      prevTotalPaid: prev,
      deltaValue,
      deltaPct,
    };
  });
}

/**
 * Get complete executive dashboard data
 */
export async function getExecDashboardData(
  db: unknown,
  dateRange: DateRangeStrings,
  bucket: BucketGranularity = 'day'
): Promise<ExecDashboardResponse> {
  const previousRange = calculatePreviousPeriod(dateRange.from, dateRange.to);

  // Fetch all data in parallel
  const [currentSummary, prevSummary, series, drivers] = await Promise.all([
    getExecSummary(db, dateRange),
    getExecSummary(db, previousRange),
    getExecSeries(db, dateRange, bucket),
    getExecDrivers(db, dateRange, previousRange),
  ]);

  // Calculate comparison deltas
  const comparison: ExecComparison = {
    incomeReceived: {
      prev: prevSummary.incomeReceived,
      deltaValue: currentSummary.incomeReceived - prevSummary.incomeReceived,
      deltaPct: calculateDeltaPct(currentSummary.incomeReceived, prevSummary.incomeReceived),
    },
    expensePaid: {
      prev: prevSummary.expensePaid,
      deltaValue: currentSummary.expensePaid - prevSummary.expensePaid,
      deltaPct: calculateDeltaPct(currentSummary.expensePaid, prevSummary.expensePaid),
    },
    profitCash: {
      prev: prevSummary.profitCash,
      deltaValue: currentSummary.profitCash - prevSummary.profitCash,
      deltaPct: calculateDeltaPct(currentSummary.profitCash, prevSummary.profitCash),
    },
    margin: {
      prev: prevSummary.margin,
      deltaPP: currentSummary.margin !== null && prevSummary.margin !== null
        ? currentSummary.margin - prevSummary.margin
        : null,
    },
  };

  return {
    summary: currentSummary,
    comparison,
    series,
    drivers,
    dateRange,
    previousRange,
    bucket,
  };
}
