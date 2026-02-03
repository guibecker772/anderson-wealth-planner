/**
 * Dashboard Analytics Functions
 * 
 * Provides data aggregation for the dashboard view including:
 * - Summary cards (revenue, expenses, profit, pending)
 * - Cash flow time series
 * - Top expense categories
 */

import { Prisma } from '@prisma/client';
import { dateRangeToDbFilter, type DateRangeStrings, getBrazilNow, formatDateString } from '@/lib/dateRange';

// Types for dashboard data
export interface DashboardSummary {
  totalRevenue: number;       // Receita Realizada (RECEIVABLE + SETTLED)
  totalExpenses: number;      // Despesa Paga (PAYABLE + SETTLED)
  netProfit: number;          // Lucro Líquido
  pendingPayables: number;    // A Pagar (Aberto) - PAYABLE + PENDING
  overduePayables: number;    // Vencidos (PAYABLE + PENDING + dueDate < hoje)
}

export interface CashflowDataPoint {
  date: string;         // YYYY-MM-DD
  revenue: number;      // Receitas SETTLED naquele dia
  expenses: number;     // Despesas SETTLED naquele dia
  balance: number;      // revenue - expenses
}

export interface CategoryExpense {
  category: string;
  total: number;
  count: number;
}

/**
 * Get dashboard summary metrics for a date range
 */
export async function getDashboardSummary(
  db: any,
  dateRange: DateRangeStrings
): Promise<DashboardSummary> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  const now = getBrazilNow();
  const todayStr = formatDateString(now);
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');

  // Parallel queries for better performance
  const [revenueResult, expensesResult, pendingResult, overdueResult] = await Promise.all([
    // Total Revenue (RECEIVABLE + SETTLED)
    // Use actualAmount if exists, otherwise plannedAmount
    db.transaction.aggregate({
      where: {
        type: 'RECEIVABLE',
        status: 'SETTLED',
        dueDate: dateFilter,
      },
      _sum: {
        actualAmount: true,
        plannedAmount: true,
      },
    }),
    
    // Total Expenses (PAYABLE + SETTLED)
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        dueDate: dateFilter,
      },
      _sum: {
        actualAmount: true,
        plannedAmount: true,
      },
    }),
    
    // Pending Payables (PAYABLE + PENDING within date range)
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: dateFilter,
      },
      _sum: {
        plannedAmount: true,
      },
    }),
    
    // Overdue Payables (PAYABLE + PENDING + dueDate < today, within date range)
    db.transaction.aggregate({
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: {
          ...dateFilter,
          lt: todayStart,
        },
      },
      _sum: {
        plannedAmount: true,
      },
    }),
  ]);

  // Calculate totals (prefer actualAmount, fallback to plannedAmount)
  const totalRevenue = Number(revenueResult._sum.actualAmount || revenueResult._sum.plannedAmount || 0);
  const totalExpenses = Number(expensesResult._sum.actualAmount || expensesResult._sum.plannedAmount || 0);
  const pendingPayables = Number(pendingResult._sum.plannedAmount || 0);
  const overduePayables = Number(overdueResult._sum.plannedAmount || 0);

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    pendingPayables,
    overduePayables,
  };
}

/**
 * Get cash flow time series for the date range
 * Uses raw SQL for efficient date grouping
 */
export async function getCashflowSeries(
  db: any,
  dateRange: DateRangeStrings,
  granularity: 'day' | 'month' = 'day'
): Promise<CashflowDataPoint[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);

  // Use raw SQL for efficient grouping by date
  // Note: We use $queryRawUnsafe because date_trunc's first param must be a string literal
  const truncFn = granularity === 'month' ? 'month' : 'day';
  
  const rawData = await db.$queryRawUnsafe(`
    SELECT 
      date_trunc('${truncFn}', "dueDate") as date_period,
      type,
      SUM(COALESCE("actualAmount", "plannedAmount")) as total
    FROM "Transaction"
    WHERE 
      status = 'SETTLED'
      AND "dueDate" >= $1
      AND "dueDate" <= $2
    GROUP BY date_trunc('${truncFn}', "dueDate"), type
    ORDER BY date_period ASC
  `, dateFilter.gte, dateFilter.lte);

  // Process raw data into structured format
  const dataMap = new Map<string, { revenue: number; expenses: number }>();

  for (const row of rawData as any[]) {
    const dateStr = row.date_period instanceof Date 
      ? row.date_period.toISOString().split('T')[0]
      : String(row.date_period).split('T')[0];
    
    if (!dataMap.has(dateStr)) {
      dataMap.set(dateStr, { revenue: 0, expenses: 0 });
    }
    
    const entry = dataMap.get(dateStr)!;
    const amount = Number(row.total || 0);
    
    if (row.type === 'RECEIVABLE') {
      entry.revenue += amount;
    } else {
      entry.expenses += amount;
    }
  }

  // Convert to array and add balance
  const result: CashflowDataPoint[] = [];
  
  // Sort by date and create array
  const sortedDates = Array.from(dataMap.keys()).sort();
  for (const date of sortedDates) {
    const entry = dataMap.get(date)!;
    result.push({
      date,
      revenue: entry.revenue,
      expenses: entry.expenses,
      balance: entry.revenue - entry.expenses,
    });
  }

  return result;
}

/**
 * Get top expense categories for the date range
 */
export async function getTopExpenseCategories(
  db: any,
  dateRange: DateRangeStrings,
  limit: number = 10
): Promise<CategoryExpense[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);

  const result = await db.transaction.groupBy({
    by: ['category'],
    where: {
      type: 'PAYABLE',
      status: 'SETTLED',
      dueDate: dateFilter,
    },
    _sum: {
      actualAmount: true,
      plannedAmount: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        actualAmount: 'desc',
      },
    },
    take: limit,
  });

  return result.map((item: any) => ({
    category: item.category || 'Sem Categoria',
    total: Number(item._sum.actualAmount || item._sum.plannedAmount || 0),
    count: item._count.id,
  }));
}

/**
 * Get all dashboard data in a single call
 */
export async function getDashboardData(
  db: any,
  dateRange: DateRangeStrings
) {
  const [summary, cashflow, topCategories] = await Promise.all([
    getDashboardSummary(db, dateRange),
    getCashflowSeries(db, dateRange),
    getTopExpenseCategories(db, dateRange, 8),
  ]);

  return {
    summary,
    cashflow,
    topCategories,
    dateRange,
  };
}
