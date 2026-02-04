/**
 * Metrics Summary - Centralized calculation service
 * 
 * Single source of truth for financial metrics across all pages.
 * Implements consistent rules for:
 * - Cash view (realized): by actualDate (payment/receipt date)
 * - Obligation view (pending): by dueDate
 * - Overdue: pending items with dueDate < today
 */

import { differenceInDays, subDays, parseISO, format, startOfDay } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

// ============================================================================
// TYPES
// ============================================================================

export interface DateRangeStrings {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface IncomeMetrics {
  received: number;     // Valor recebido (status SETTLED, filtrado por actualDate no período)
  receivable: number;   // Valor a receber (status PENDING, filtrado por dueDate no período)
  overdue: number;      // Valor a receber vencido (pendente com dueDate < hoje)
  receivedCount: number;
  receivableCount: number;
  overdueCount: number;
}

export interface ExpenseMetrics {
  paid: number;         // Valor pago (status SETTLED, filtrado por actualDate no período)
  payable: number;      // Valor a pagar (status PENDING, filtrado por dueDate no período)
  overdue: number;      // Valor a pagar vencido (pendente com dueDate < hoje)
  paidCount: number;
  payableCount: number;
  overdueCount: number;
}

export interface MetricsSummary {
  income: IncomeMetrics;
  expense: ExpenseMetrics;
  netCash: number;      // received - paid (resultado do período em caixa)
  dateRange: DateRangeStrings;
}

export interface MetricsDelta {
  receivedDelta: number;
  receivedDeltaPct: number | null;
  paidDelta: number;
  paidDeltaPct: number | null;
  netCashDelta: number;
  netCashDeltaPct: number | null;
  receivableDelta: number;
  receivableDeltaPct: number | null;
  payableDelta: number;
  payableDeltaPct: number | null;
}

export interface MetricsSummaryWithComparison {
  current: MetricsSummary;
  previous: MetricsSummary;
  delta: MetricsDelta;
}

export const BRAZIL_TZ = 'America/Sao_Paulo';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get current date in Brazil timezone
 */
export function getBrazilNow(): Date {
  return utcToZonedTime(new Date(), BRAZIL_TZ);
}

/**
 * Get start of today in Brazil timezone (for overdue comparison)
 */
export function getBrazilTodayStart(): Date {
  const now = getBrazilNow();
  return startOfDay(now);
}

/**
 * Convert date string range to database filter dates
 * Returns UTC dates that represent start and end of day in Brazil timezone
 */
export function dateRangeToDbFilter(dateRange: DateRangeStrings): { gte: Date; lte: Date } {
  // Start of day in Brazil = midnight Brazil time → convert to UTC
  const startBrazil = new Date(`${dateRange.from}T00:00:00`);
  const endBrazil = new Date(`${dateRange.to}T23:59:59.999`);
  
  return {
    gte: zonedTimeToUtc(startBrazil, BRAZIL_TZ),
    lte: zonedTimeToUtc(endBrazil, BRAZIL_TZ),
  };
}

/**
 * Calculate previous period with same duration
 * Example: if current is [Jan 1, Jan 31] (31 days), previous is [Dec 1, Dec 31]
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
  if (previous === 0) {
    return null; // Return null instead of Infinity
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get metrics summary for a date range
 * 
 * This is the single source of truth for all financial metrics.
 * All pages (dashboard, receitas, despesas) should consume this.
 */
export async function getMetricsSummary(
  db: any,
  dateRange: DateRangeStrings
): Promise<MetricsSummary> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  const todayStart = getBrazilTodayStart();

  // Execute all queries in parallel for performance
  const [
    // INCOME - Received (SETTLED, by actualDate)
    incomeReceived,
    // INCOME - Receivable (PENDING, by dueDate)
    incomeReceivable,
    // INCOME - Overdue (PENDING, dueDate < today, within period)
    incomeOverdue,
    // EXPENSE - Paid (SETTLED, by actualDate)
    expensePaid,
    // EXPENSE - Payable (PENDING, by dueDate)
    expensePayable,
    // EXPENSE - Overdue (PENDING, dueDate < today, within period)
    expenseOverdue,
  ] = await Promise.all([
    // Income Received - by actualDate
    db.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'SETTLED',
        actualDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        },
      },
      _sum: { actualAmount: true, plannedAmount: true },
      _count: { id: true },
    }),
    
    // Income Receivable - by dueDate
    db.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        dueDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Income Overdue - PENDING + dueDate < today + dueDate in period
    db.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        dueDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
          lt: todayStart,
        },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Expense Paid - by actualDate
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        actualDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        },
      },
      _sum: { actualAmount: true, plannedAmount: true },
      _count: { id: true },
    }),
    
    // Expense Payable - by dueDate
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
    
    // Expense Overdue - PENDING + dueDate < today + dueDate in period
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
          lt: todayStart,
        },
      },
      _sum: { plannedAmount: true },
      _count: { id: true },
    }),
  ]);

  // Extract values (prefer actualAmount for settled, plannedAmount for pending)
  const received = Number(incomeReceived._sum.actualAmount || incomeReceived._sum.plannedAmount || 0);
  const receivable = Number(incomeReceivable._sum.plannedAmount || 0);
  const incomeOverdueAmount = Number(incomeOverdue._sum.plannedAmount || 0);
  
  const paid = Number(expensePaid._sum.actualAmount || expensePaid._sum.plannedAmount || 0);
  const payable = Number(expensePayable._sum.plannedAmount || 0);
  const expenseOverdueAmount = Number(expenseOverdue._sum.plannedAmount || 0);

  return {
    income: {
      received,
      receivable,
      overdue: incomeOverdueAmount,
      receivedCount: incomeReceived._count.id || 0,
      receivableCount: incomeReceivable._count.id || 0,
      overdueCount: incomeOverdue._count.id || 0,
    },
    expense: {
      paid,
      payable,
      overdue: expenseOverdueAmount,
      paidCount: expensePaid._count.id || 0,
      payableCount: expensePayable._count.id || 0,
      overdueCount: expenseOverdue._count.id || 0,
    },
    netCash: received - paid,
    dateRange,
  };
}

/**
 * Get metrics summary with comparison to previous period
 */
export async function getMetricsSummaryWithComparison(
  db: any,
  dateRange: DateRangeStrings
): Promise<MetricsSummaryWithComparison> {
  const previousRange = calculatePreviousPeriod(dateRange.from, dateRange.to);
  
  const [current, previous] = await Promise.all([
    getMetricsSummary(db, dateRange),
    getMetricsSummary(db, previousRange),
  ]);
  
  // Calculate deltas
  const delta: MetricsDelta = {
    receivedDelta: current.income.received - previous.income.received,
    receivedDeltaPct: calculateDeltaPct(current.income.received, previous.income.received),
    paidDelta: current.expense.paid - previous.expense.paid,
    paidDeltaPct: calculateDeltaPct(current.expense.paid, previous.expense.paid),
    netCashDelta: current.netCash - previous.netCash,
    netCashDeltaPct: calculateDeltaPct(current.netCash, previous.netCash),
    receivableDelta: current.income.receivable - previous.income.receivable,
    receivableDeltaPct: calculateDeltaPct(current.income.receivable, previous.income.receivable),
    payableDelta: current.expense.payable - previous.expense.payable,
    payableDeltaPct: calculateDeltaPct(current.expense.payable, previous.expense.payable),
  };
  
  return { current, previous, delta };
}
