export type {
  DashboardSummary,
  CashflowDataPoint,
  CategoryExpense,
} from './operational-metrics';

export { getDashboardData } from './workbook-metrics';

import { PrismaClient } from '@prisma/client';
import { type DateRangeStrings } from '@/lib/dateRange';
import { getDashboardData } from './workbook-metrics';

export async function getDashboardSummary(db: PrismaClient, dateRange: DateRangeStrings) {
  const data = await getDashboardData(db, dateRange);
  return data.summary;
}

export async function getCashflowSeries(db: PrismaClient, dateRange: DateRangeStrings) {
  const data = await getDashboardData(db, dateRange);
  return data.cashflow;
}

export async function getTopExpenseCategories(db: PrismaClient, dateRange: DateRangeStrings, limit = 10) {
  const data = await getDashboardData(db, dateRange);
  return data.topCategories.slice(0, limit);
}
