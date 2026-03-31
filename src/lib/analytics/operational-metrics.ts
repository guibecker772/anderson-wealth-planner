import { PrismaClient } from '@prisma/client';
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInDays,
  format,
  isAfter,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { dateRangeToDbFilter, getBrazilNow, type DateRangeStrings } from '@/lib/dateRange';

export type BucketGranularity = 'day' | 'week' | 'month';
export type AnalyticsScope = 'income' | 'expense' | 'fines';
export type OperationalQualityStatus = 'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN';

export interface MetricsSummary {
  income: {
    received: number;
    receivable: number;
    overdue: number;
    receivedCount: number;
    receivableCount: number;
    overdueCount: number;
  };
  expense: {
    paid: number;
    payable: number;
    overdue: number;
    paidCount: number;
    payableCount: number;
    overdueCount: number;
  };
  netCash: number;
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

export interface SummaryResponse {
  total: number;
  count: number;
  prevTotal: number;
  prevCount: number;
  deltaValue: number;
  deltaPct: number | null;
  dateRange: DateRangeStrings;
  previousRange: DateRangeStrings;
  qualitySummary?: Record<OperationalQualityStatus, number>;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  total: number;
  count: number;
}

export interface RankingItem {
  key: string;
  label: string;
  total: number;
  count: number;
}

export interface TimeSeriesResponse {
  data: TimeSeriesPoint[];
  granularity: BucketGranularity;
  dateRange: DateRangeStrings;
}

export interface TopRankingResponse {
  data: RankingItem[];
  limit: number;
  dateRange: DateRangeStrings;
}

export interface TransactionAnalyticsBundle {
  summary: SummaryResponse;
  series: TimeSeriesResponse;
  top: TopRankingResponse;
}

export interface FineDetailItem {
  id: string;
  date: string;
  plate: string | null;
  aitCode: string | null;
  amount: number;
  status: string;
  paidBy: 'UNKNOWN';
  paidByLabel: string;
  description: string | null;
  counterparty: string | null;
  category: string | null;
  investor: string | null;
  driver: string | null;
  qualityStatus: OperationalQualityStatus;
  sourceRowNumber: number | null;
}

export interface FineListResponse {
  data: FineDetailItem[];
  total: number;
  page: number;
  pageSize: number;
  dateRange: DateRangeStrings;
}

export interface VehicleRankingItem {
  plate: string;
  total: number;
  count: number;
  aitCodes: string[];
}

export interface VehicleRankingResponse {
  data: VehicleRankingItem[];
  limit: number;
  sortBy: 'count' | 'value';
  dateRange: DateRangeStrings;
}

export interface OperationalTableRow {
  id: string;
  dueDate: Date;
  counterparty: string | null;
  category: string | null;
  plannedAmount: number | null;
  actualAmount: number | null;
  status: 'PENDING' | 'SETTLED' | 'OVERDUE';
  categorySource: null;
  qualityStatus: OperationalQualityStatus;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingPayables: number;
  overduePayables: number;
  pendingReceivables: number;
  overdueReceivables: number;
  fleetStates: Array<{ status: string; count: number }>;
  qualitySummary: Record<OperationalQualityStatus, number>;
}

export interface CashflowDataPoint {
  date: string;
  revenue: number;
  expenses: number;
  balance: number;
}

export interface CategoryExpense {
  category: string;
  total: number;
  count: number;
}

export interface ExecSummary {
  incomeReceived: number;
  expensePaid: number;
  profitCash: number;
  margin: number | null;
  receivable: number;
  payable: number;
  receivableOverdue: number;
  payableOverdue: number;
}

export interface ExecComparison {
  incomeReceived: { prev: number; deltaValue: number; deltaPct: number | null };
  expensePaid: { prev: number; deltaValue: number; deltaPct: number | null };
  profitCash: { prev: number; deltaValue: number; deltaPct: number | null };
  receivable: { prev: number; deltaValue: number; deltaPct: number | null };
  payable: { prev: number; deltaValue: number; deltaPct: number | null };
  margin: { prev: number | null; deltaPP: number | null };
}

export interface ExecSeriesPoint {
  bucketStart: string;
  bucketLabel: string;
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
  qualitySummary: Record<OperationalQualityStatus, number>;
  error?: string;
}

export interface Investor {
  id: string;
  name: string;
  vehicles: string[];
}

export interface InvestorVehicleMetrics {
  plate: string;
  status: string;
  rentalIncome: number;
  maintenanceCost: number;
  finesCost: number;
  netResult: number;
  qualitySummary: Record<OperationalQualityStatus, number>;
}

export interface InvestorMetrics {
  investor: Investor;
  totals: {
    rentalIncome: number;
    maintenanceCost: number;
    finesCost: number;
    discountCost: number;
    netResult: number;
  };
  vehicles: InvestorVehicleMetrics[];
  qualitySummary: Record<OperationalQualityStatus, number>;
  dateRange: DateRangeStrings;
}

export interface InvestorListResponse {
  investors: Investor[];
  total: number;
}

type SnapshotRow = {
  id: string;
  referenceDate: Date;
  referenceMonth: number;
  referenceYear: number;
  weekOfMonth: number | null;
  vehicleStatusNormalized: string | null;
  paymentState: string;
  plate: string;
  model: string | null;
  investorNormalized: string | null;
  driverNormalized: string | null;
  contractValue: unknown;
  lateFeeAmount: unknown;
  discountAmount: unknown;
  amountToCharge: unknown;
  maintenanceByDriverAmount: unknown;
  amountPaidWeek: unknown;
  openAmount: unknown;
  rawJson: unknown;
  sourceRowNumber: number;
};

const snapshotSelect = {
  id: true,
  referenceDate: true,
  referenceMonth: true,
  referenceYear: true,
  weekOfMonth: true,
  vehicleStatusNormalized: true,
  paymentState: true,
  plate: true,
  model: true,
  investorNormalized: true,
  driverNormalized: true,
  contractValue: true,
  lateFeeAmount: true,
  discountAmount: true,
  amountToCharge: true,
  maintenanceByDriverAmount: true,
  amountPaidWeek: true,
  openAmount: true,
  rawJson: true,
  sourceRowNumber: true,
} as const;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getQualityStatus(rawJson: unknown): OperationalQualityStatus {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return 'UNKNOWN';
  const quality = (rawJson as Record<string, unknown>)['__quality'];
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return 'UNKNOWN';
  const status = (quality as Record<string, unknown>)['status'];
  if (status === 'OK' || status === 'WARNING' || status === 'REVIEW_REQUIRED') return status;
  return 'UNKNOWN';
}

function emptyQualitySummary(): Record<OperationalQualityStatus, number> {
  return { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 };
}

function summarizeQuality(rows: SnapshotRow[]): Record<OperationalQualityStatus, number> {
  return rows.reduce((acc, row) => {
    acc[getQualityStatus(row.rawJson)] += 1;
    return acc;
  }, emptyQualitySummary());
}

function clampMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDerivedReceivable(row: SnapshotRow): number {
  const revenueChargeBase = getRevenueChargeBase(row);
  const revenuePaid = getIncomeActual(row);
  return Math.max(clampMoney(revenueChargeBase - revenuePaid), 0);
}

function getDerivedExpense(row: SnapshotRow): number {
  return clampMoney(
    toNumber(row.maintenanceByDriverAmount) +
      toNumber(row.lateFeeAmount) +
      toNumber(row.discountAmount)
  );
}

function getFineAmount(row: SnapshotRow): number {
  return clampMoney(toNumber(row.lateFeeAmount));
}

function getRevenueChargeBase(row: SnapshotRow): number {
  const grossCharge = toNumber(row.amountToCharge) || toNumber(row.contractValue);
  const fines = toNumber(row.lateFeeAmount);
  return Math.max(clampMoney(grossCharge - fines), 0);
}

function getIncomePlanned(row: SnapshotRow): number {
  return getRevenueChargeBase(row);
}

function getIncomeActual(row: SnapshotRow): number {
  const paid = toNumber(row.amountPaidWeek);
  const revenueChargeBase = getRevenueChargeBase(row);
  return clampMoney(Math.min(paid, revenueChargeBase));
}

function getIncomeAnalyticsValue(row: SnapshotRow): number {
  return clampMoney(getIncomeActual(row) + getDerivedReceivable(row));
}

function getScopeValue(row: SnapshotRow, scope: AnalyticsScope): number {
  if (scope === 'income') return getIncomeAnalyticsValue(row);
  if (scope === 'expense') return getDerivedExpense(row);
  return getFineAmount(row);
}

function getScopeCountable(row: SnapshotRow, scope: AnalyticsScope): boolean {
  return getScopeValue(row, scope) > 0;
}

function isOverdue(referenceDate: Date, openAmount: number): boolean {
  const today = startOfDay(getBrazilNow());
  return openAmount > 0 && referenceDate < today;
}

function calculateDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calculatePreviousPeriod(from: string, to: string): DateRangeStrings {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const days = differenceInDays(toDate, fromDate) + 1;
  const prevTo = subDays(fromDate, 1);
  const prevFrom = subDays(fromDate, days);
  return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') };
}

export function calculateMargin(profit: number, income: number): number | null {
  if (income === 0) return null;
  return (profit / income) * 100;
}

export function getBucketKey(date: Date, granularity: BucketGranularity): string {
  switch (granularity) {
    case 'week':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM-dd');
    default:
      return format(date, 'yyyy-MM-dd');
  }
}

export function getBucketLabel(bucketStart: string, granularity: BucketGranularity): string {
  const date = parseISO(bucketStart);
  switch (granularity) {
    case 'week':
      return `Sem ${format(date, 'dd/MM')}`;
    case 'month':
      return format(date, 'MMM/yy');
    default:
      return format(date, 'dd/MM');
  }
}

export function generateBuckets(from: string, to: string, granularity: BucketGranularity): string[] {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const buckets: string[] = [];
  let current: Date;

  switch (granularity) {
    case 'week':
      current = startOfWeek(fromDate, { weekStartsOn: 1 });
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addWeeks(current, 1);
      }
      return buckets;
    case 'month':
      current = startOfMonth(fromDate);
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addMonths(current, 1);
      }
      return buckets;
    default:
      current = startOfDay(fromDate);
      while (!isAfter(current, toDate)) {
        buckets.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
      }
      return buckets;
  }
}

async function listSnapshots(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  extraWhere: Record<string, unknown> = {}
): Promise<SnapshotRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.operationalSnapshot.findMany({
    where: {
      referenceDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
      ...extraWhere,
    },
    select: snapshotSelect,
    orderBy: [{ referenceDate: 'desc' }, { plate: 'asc' }],
  }) as Promise<SnapshotRow[]>;
}

function buildTopRanking(rows: SnapshotRow[], scope: AnalyticsScope, limit: number): TopRankingResponse['data'] {
  const ranking = new Map<string, RankingItem>();

  const add = (key: string, label: string, total: number, count: number) => {
    if (total <= 0 && count <= 0) return;
    const current = ranking.get(key) ?? { key, label, total: 0, count: 0 };
    current.total += total;
    current.count += count;
    ranking.set(key, current);
  };

  if (scope === 'income') {
    for (const row of rows) {
      add('contract', 'Base Contratual', toNumber(row.contractValue), 1);
      add('to-charge', 'Valor a Cobrar Liquido', getRevenueChargeBase(row), 1);
      add('paid', 'Valor Pago Liquido', getIncomeActual(row), getIncomeActual(row) > 0 ? 1 : 0);
      add('discount', 'Desconto', toNumber(row.discountAmount), toNumber(row.discountAmount) > 0 ? 1 : 0);
    }
  } else if (scope === 'expense') {
    for (const row of rows) {
      add('maintenance', 'Manutencao', toNumber(row.maintenanceByDriverAmount), toNumber(row.maintenanceByDriverAmount) > 0 ? 1 : 0);
      add('late-fee', 'Multa/Atraso', toNumber(row.lateFeeAmount), toNumber(row.lateFeeAmount) > 0 ? 1 : 0);
      add('discount', 'Desconto', toNumber(row.discountAmount), toNumber(row.discountAmount) > 0 ? 1 : 0);
    }
  } else {
    const byInvestor = new Map<string, RankingItem>();
    for (const row of rows) {
      const amount = getFineAmount(row);
      if (amount <= 0) continue;
      const label = row.investorNormalized || 'Sem investidor';
      const key = label.toLowerCase();
      const current = byInvestor.get(key) ?? { key, label, total: 0, count: 0 };
      current.total += amount;
      current.count += 1;
      byInvestor.set(key, current);
    }
    return Array.from(byInvestor.values()).sort((a, b) => b.total - a.total).slice(0, limit);
  }

  return Array.from(ranking.values()).sort((a, b) => b.total - a.total).slice(0, limit);
}

function buildSeries(rows: SnapshotRow[], scope: AnalyticsScope, dateRange: DateRangeStrings): TimeSeriesResponse {
  const days = differenceInDays(parseISO(dateRange.to), parseISO(dateRange.from));
  const granularity: BucketGranularity = days > 90 ? 'month' : days > 35 ? 'week' : 'day';
  const bucketMap = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const value = getScopeValue(row, scope);
    if (value <= 0) continue;
    const bucket = getBucketKey(row.referenceDate, granularity);
    const current = bucketMap.get(bucket) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    bucketMap.set(bucket, current);
  }

  return {
    data: Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        label: getBucketLabel(date, granularity),
        total: clampMoney(values.total),
        count: values.count,
      })),
    granularity,
    dateRange,
  };
}

export async function getMetricsSummary(db: PrismaClient, dateRange: DateRangeStrings): Promise<MetricsSummary> {
  const rows = await listSnapshots(db, dateRange);
  const incomeReceived = rows.reduce((acc, row) => acc + getIncomeActual(row), 0);
  const incomeReceivable = rows.reduce((acc, row) => acc + getDerivedReceivable(row), 0);
  const incomeOverdueRows = rows.filter((row) => isOverdue(row.referenceDate, getDerivedReceivable(row)));
  const expensePaid = rows.reduce((acc, row) => acc + getDerivedExpense(row), 0);

  return {
    income: {
      received: clampMoney(incomeReceived),
      receivable: clampMoney(incomeReceivable),
      overdue: clampMoney(incomeOverdueRows.reduce((acc, row) => acc + getDerivedReceivable(row), 0)),
      receivedCount: rows.filter((row) => getIncomeActual(row) > 0).length,
      receivableCount: rows.filter((row) => getDerivedReceivable(row) > 0).length,
      overdueCount: incomeOverdueRows.length,
    },
    expense: {
      paid: clampMoney(expensePaid),
      payable: 0,
      overdue: 0,
      paidCount: rows.filter((row) => getDerivedExpense(row) > 0).length,
      payableCount: 0,
      overdueCount: 0,
    },
    netCash: clampMoney(incomeReceived - expensePaid),
    dateRange,
  };
}

export async function getMetricsSummaryWithComparison(
  db: PrismaClient,
  dateRange: DateRangeStrings
): Promise<MetricsSummaryWithComparison> {
  const previousRange = calculatePreviousPeriod(dateRange.from, dateRange.to);
  const [current, previous] = await Promise.all([
    getMetricsSummary(db, dateRange),
    getMetricsSummary(db, previousRange),
  ]);

  return {
    current,
    previous,
    delta: {
      receivedDelta: clampMoney(current.income.received - previous.income.received),
      receivedDeltaPct: calculateDeltaPct(current.income.received, previous.income.received),
      paidDelta: clampMoney(current.expense.paid - previous.expense.paid),
      paidDeltaPct: calculateDeltaPct(current.expense.paid, previous.expense.paid),
      netCashDelta: clampMoney(current.netCash - previous.netCash),
      netCashDeltaPct: calculateDeltaPct(current.netCash, previous.netCash),
      receivableDelta: clampMoney(current.income.receivable - previous.income.receivable),
      receivableDeltaPct: calculateDeltaPct(current.income.receivable, previous.income.receivable),
      payableDelta: clampMoney(current.expense.payable - previous.expense.payable),
      payableDeltaPct: calculateDeltaPct(current.expense.payable, previous.expense.payable),
    },
  };
}

export async function getTransactionSummary(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<SummaryResponse> {
  const currentRange = { from: params.from, to: params.to };
  const previousRange = calculatePreviousPeriod(params.from, params.to);
  const [currentRows, previousRows] = await Promise.all([
    listSnapshots(db, currentRange),
    listSnapshots(db, previousRange),
  ]);

  const currentScopeRows = currentRows.filter((row) => getScopeCountable(row, params.scope));
  const previousScopeRows = previousRows.filter((row) => getScopeCountable(row, params.scope));
  const currentTotal = clampMoney(currentScopeRows.reduce((acc, row) => acc + getScopeValue(row, params.scope), 0));
  const previousTotal = clampMoney(previousScopeRows.reduce((acc, row) => acc + getScopeValue(row, params.scope), 0));

  return {
    total: currentTotal,
    count: currentScopeRows.length,
    prevTotal: previousTotal,
    prevCount: previousScopeRows.length,
    deltaValue: clampMoney(currentTotal - previousTotal),
    deltaPct: calculateDeltaPct(currentTotal, previousTotal),
    dateRange: currentRange,
    previousRange,
    qualitySummary: summarizeQuality(currentScopeRows),
  };
}

export async function getTransactionTimeSeries(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<TimeSeriesResponse> {
  const rows = await listSnapshots(db, { from: params.from, to: params.to });
  return buildSeries(rows, params.scope, { from: params.from, to: params.to });
}

export async function getTopByClass(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; limit?: number }
): Promise<TopRankingResponse> {
  const rows = await listSnapshots(db, { from: params.from, to: params.to });
  const limit = params.limit ?? 5;
  return {
    data: buildTopRanking(rows, params.scope, limit),
    limit,
    dateRange: { from: params.from, to: params.to },
  };
}

export async function getTransactionAnalyticsBundle(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; limit?: number }
): Promise<TransactionAnalyticsBundle> {
  const [summary, series, top] = await Promise.all([
    getTransactionSummary(db, params),
    getTransactionTimeSeries(db, params),
    getTopByClass(db, params),
  ]);
  return { summary, series, top };
}

export async function getVehicleRanking(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; limit?: number; sortBy?: 'count' | 'value'; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<VehicleRankingResponse> {
  const rows = await listSnapshots(db, { from: params.from, to: params.to });
  const limit = params.limit ?? 10;
  const sortBy = params.sortBy ?? 'count';
  const byPlate = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const amount = getFineAmount(row);
    if (amount <= 0) continue;
    const current = byPlate.get(row.plate) ?? { total: 0, count: 0 };
    current.total += amount;
    current.count += 1;
    byPlate.set(row.plate, current);
  }

  return {
    data: Array.from(byPlate.entries())
      .map(([plate, values]) => ({ plate, total: clampMoney(values.total), count: values.count, aitCodes: [] }))
      .sort((a, b) => (sortBy === 'count' ? b.count - a.count : b.total - a.total))
      .slice(0, limit),
    limit,
    sortBy,
    dateRange: { from: params.from, to: params.to },
  };
}

export async function getFinesList(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; page?: number; pageSize?: number; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<FineListResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const rows = await listSnapshots(db, { from: params.from, to: params.to });
  const fineRows = rows.filter((row) => getFineAmount(row) > 0);
  const pageRows = fineRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: pageRows.map((row) => ({
      id: row.id,
      date: toDateKey(row.referenceDate),
      plate: row.plate,
      aitCode: null,
      amount: getFineAmount(row),
      status: 'SETTLED',
      paidBy: 'UNKNOWN',
      paidByLabel: 'Operacional',
      description: `Multa/Atraso operacional - semana ${row.weekOfMonth ?? '-'} - ${row.plate}`,
      counterparty: row.investorNormalized,
      category: 'Multa/Atraso operacional',
      investor: row.investorNormalized,
      driver: row.driverNormalized,
      qualityStatus: getQualityStatus(row.rawJson),
      sourceRowNumber: row.sourceRowNumber,
    })),
    total: fineRows.length,
    page,
    pageSize,
    dateRange: { from: params.from, to: params.to },
  };
}

export async function getDashboardData(db: PrismaClient, dateRange: DateRangeStrings) {
  const rows = await listSnapshots(db, dateRange);
  const summary: DashboardSummary = {
    totalRevenue: clampMoney(rows.reduce((acc, row) => acc + getIncomeActual(row), 0)),
    totalExpenses: clampMoney(rows.reduce((acc, row) => acc + getDerivedExpense(row), 0)),
    netProfit: 0,
    pendingPayables: 0,
    overduePayables: 0,
    pendingReceivables: clampMoney(rows.reduce((acc, row) => acc + getDerivedReceivable(row), 0)),
    overdueReceivables: clampMoney(
      rows.filter((row) => isOverdue(row.referenceDate, getDerivedReceivable(row))).reduce((acc, row) => acc + getDerivedReceivable(row), 0)
    ),
    fleetStates: [],
    qualitySummary: summarizeQuality(rows),
  };
  summary.netProfit = clampMoney(summary.totalRevenue - summary.totalExpenses);

  const fleetStatesMap = new Map<string, number>();
  for (const row of rows) {
    const key = row.vehicleStatusNormalized || 'Sem situacao';
    fleetStatesMap.set(key, (fleetStatesMap.get(key) ?? 0) + 1);
  }
  summary.fleetStates = Array.from(fleetStatesMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const cashflowMap = new Map<string, CashflowDataPoint>();
  for (const row of rows) {
    const key = toDateKey(row.referenceDate);
    const current = cashflowMap.get(key) ?? { date: key, revenue: 0, expenses: 0, balance: 0 };
    current.revenue += getIncomeActual(row);
    current.expenses += getDerivedExpense(row);
    current.balance = current.revenue - current.expenses;
    cashflowMap.set(key, current);
  }

  const topCategories = buildTopRanking(rows, 'expense', 8).map((entry) => ({
    category: entry.label,
    total: clampMoney(entry.total),
    count: entry.count,
  }));

  return {
    summary,
    cashflow: Array.from(cashflowMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topCategories,
    dateRange,
  };
}

export async function getExecDashboardData(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  bucket: BucketGranularity = 'day'
): Promise<ExecDashboardResponse> {
  const previousRange = calculatePreviousPeriod(dateRange.from, dateRange.to);
  const [currentRows, previousRows] = await Promise.all([
    listSnapshots(db, dateRange),
    listSnapshots(db, previousRange),
  ]);

  const currentIncome = clampMoney(currentRows.reduce((acc, row) => acc + getIncomeActual(row), 0));
  const currentExpense = clampMoney(currentRows.reduce((acc, row) => acc + getDerivedExpense(row), 0));
  const previousIncome = clampMoney(previousRows.reduce((acc, row) => acc + getIncomeActual(row), 0));
  const previousExpense = clampMoney(previousRows.reduce((acc, row) => acc + getDerivedExpense(row), 0));
  const currentReceivable = clampMoney(currentRows.reduce((acc, row) => acc + getDerivedReceivable(row), 0));
  const previousReceivable = clampMoney(previousRows.reduce((acc, row) => acc + getDerivedReceivable(row), 0));

  const currentSummary: ExecSummary = {
    incomeReceived: currentIncome,
    expensePaid: currentExpense,
    profitCash: clampMoney(currentIncome - currentExpense),
    margin: calculateMargin(currentIncome - currentExpense, currentIncome),
    receivable: currentReceivable,
    payable: 0,
    receivableOverdue: clampMoney(
      currentRows.filter((row) => isOverdue(row.referenceDate, getDerivedReceivable(row))).reduce((acc, row) => acc + getDerivedReceivable(row), 0)
    ),
    payableOverdue: 0,
  };

  const previousSummary: ExecSummary = {
    incomeReceived: previousIncome,
    expensePaid: previousExpense,
    profitCash: clampMoney(previousIncome - previousExpense),
    margin: calculateMargin(previousIncome - previousExpense, previousIncome),
    receivable: previousReceivable,
    payable: 0,
    receivableOverdue: clampMoney(
      previousRows.filter((row) => isOverdue(row.referenceDate, getDerivedReceivable(row))).reduce((acc, row) => acc + getDerivedReceivable(row), 0)
    ),
    payableOverdue: 0,
  };

  const bucketKeys = generateBuckets(dateRange.from, dateRange.to, bucket);
  const seriesMap = new Map<string, ExecSeriesPoint>();
  for (const key of bucketKeys) {
    seriesMap.set(key, {
      bucketStart: key,
      bucketLabel: getBucketLabel(key, bucket),
      incomeReceived: 0,
      expensePaid: 0,
      profitCash: 0,
    });
  }
  for (const row of currentRows) {
    const key = getBucketKey(row.referenceDate, bucket);
    const entry = seriesMap.get(key);
    if (!entry) continue;
    entry.incomeReceived += getIncomeActual(row);
    entry.expensePaid += getDerivedExpense(row);
    entry.profitCash = clampMoney(entry.incomeReceived - entry.expensePaid);
  }

  const currentDrivers = buildTopRanking(currentRows, 'expense', 5);
  const previousDrivers = buildTopRanking(previousRows, 'expense', 20);
  const previousDriversMap = new Map(previousDrivers.map((entry) => [entry.key, entry.total]));

  return {
    summary: currentSummary,
    comparison: {
      incomeReceived: {
        prev: previousSummary.incomeReceived,
        deltaValue: clampMoney(currentSummary.incomeReceived - previousSummary.incomeReceived),
        deltaPct: calculateDeltaPct(currentSummary.incomeReceived, previousSummary.incomeReceived),
      },
      expensePaid: {
        prev: previousSummary.expensePaid,
        deltaValue: clampMoney(currentSummary.expensePaid - previousSummary.expensePaid),
        deltaPct: calculateDeltaPct(currentSummary.expensePaid, previousSummary.expensePaid),
      },
      profitCash: {
        prev: previousSummary.profitCash,
        deltaValue: clampMoney(currentSummary.profitCash - previousSummary.profitCash),
        deltaPct: calculateDeltaPct(currentSummary.profitCash, previousSummary.profitCash),
      },
      receivable: {
        prev: previousSummary.receivable,
        deltaValue: clampMoney(currentSummary.receivable - previousSummary.receivable),
        deltaPct: calculateDeltaPct(currentSummary.receivable, previousSummary.receivable),
      },
      payable: {
        prev: previousSummary.payable,
        deltaValue: 0,
        deltaPct: null,
      },
      margin: {
        prev: previousSummary.margin,
        deltaPP:
          currentSummary.margin != null && previousSummary.margin != null
            ? clampMoney(currentSummary.margin - previousSummary.margin)
            : null,
      },
    },
    series: Array.from(seriesMap.values()),
    drivers: currentDrivers.map((entry) => {
      const prevTotalPaid = previousDriversMap.get(entry.key) ?? null;
      return {
        categoryId: entry.key,
        categoryName: entry.label,
        totalPaid: clampMoney(entry.total),
        prevTotalPaid,
        deltaValue: prevTotalPaid == null ? null : clampMoney(entry.total - prevTotalPaid),
        deltaPct: prevTotalPaid == null ? null : calculateDeltaPct(entry.total, prevTotalPaid),
      };
    }),
    dateRange,
    previousRange,
    bucket,
    qualitySummary: summarizeQuality(currentRows),
  };
}

function slugifyInvestor(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function getInvestorList(db: PrismaClient): Promise<InvestorListResponse> {
  const rows = await db.operationalSnapshot.findMany({
    where: {
      investorNormalized: { not: null },
    },
    select: {
      investorNormalized: true,
      plate: true,
    },
    orderBy: [{ investorNormalized: 'asc' }, { plate: 'asc' }],
  });

  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.investorNormalized) continue;
    const vehicles = map.get(row.investorNormalized) ?? new Set<string>();
    vehicles.add(row.plate);
    map.set(row.investorNormalized, vehicles);
  }

  const investors = Array.from(map.entries()).map(([name, vehicles]) => ({
    id: slugifyInvestor(name),
    name,
    vehicles: Array.from(vehicles).sort(),
  }));

  return { investors, total: investors.length };
}

export async function getInvestorMetrics(
  db: PrismaClient,
  investorId: string,
  dateRange: DateRangeStrings
): Promise<InvestorMetrics | null> {
  const list = await getInvestorList(db);
  const investor = list.investors.find((item) => item.id === investorId);
  if (!investor) return null;

  const rows = await listSnapshots(db, dateRange, {
    investorNormalized: investor.name,
  });

  const vehicleMap = new Map<string, InvestorVehicleMetrics>();
  const latestStatusMap = new Map<string, string>();
  for (const row of rows) {
    latestStatusMap.set(row.plate, row.vehicleStatusNormalized || 'Sem situacao');
    const qualityStatus = getQualityStatus(row.rawJson);
    const current = vehicleMap.get(row.plate) ?? {
      plate: row.plate,
      status: row.vehicleStatusNormalized || 'Sem situacao',
      rentalIncome: 0,
      maintenanceCost: 0,
      finesCost: 0,
      netResult: 0,
      qualitySummary: emptyQualitySummary(),
    };
    current.status = latestStatusMap.get(row.plate) || current.status;
    current.rentalIncome += getIncomeActual(row);
    current.maintenanceCost += toNumber(row.maintenanceByDriverAmount) + toNumber(row.discountAmount);
    current.finesCost += toNumber(row.lateFeeAmount);
    current.qualitySummary[qualityStatus] += 1;
    vehicleMap.set(row.plate, current);
  }

  const vehicles = Array.from(vehicleMap.values())
    .map((vehicle) => ({
      ...vehicle,
      rentalIncome: clampMoney(vehicle.rentalIncome),
      maintenanceCost: clampMoney(vehicle.maintenanceCost),
      finesCost: clampMoney(vehicle.finesCost),
      netResult: clampMoney(vehicle.rentalIncome - vehicle.maintenanceCost - vehicle.finesCost),
    }))
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const discountCost = clampMoney(rows.reduce((acc, row) => acc + toNumber(row.discountAmount), 0));
  const totals = {
    rentalIncome: clampMoney(rows.reduce((acc, row) => acc + getIncomeActual(row), 0)),
    maintenanceCost: clampMoney(rows.reduce((acc, row) => acc + toNumber(row.maintenanceByDriverAmount), 0)),
    finesCost: clampMoney(rows.reduce((acc, row) => acc + toNumber(row.lateFeeAmount), 0)),
    discountCost,
    netResult: 0,
  };
  totals.netResult = clampMoney(totals.rentalIncome - totals.maintenanceCost - totals.finesCost - totals.discountCost);

  return {
    investor,
    totals,
    vehicles,
    qualitySummary: summarizeQuality(rows),
    dateRange,
  };
}

export async function listOperationalTableRows(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  scope: 'income' | 'expense'
): Promise<OperationalTableRow[]> {
  const rows = await listSnapshots(db, dateRange);
  const mapped = rows.flatMap((row) => {
    const qualityStatus = getQualityStatus(row.rawJson);
    if (scope === 'income') {
      const plannedAmount = getIncomePlanned(row);
      const actualAmount = getIncomeActual(row);
      const openAmount = getDerivedReceivable(row);
      const status: 'PENDING' | 'SETTLED' | 'OVERDUE' =
        openAmount <= 0 && actualAmount > 0
          ? 'SETTLED'
          : isOverdue(row.referenceDate, openAmount)
            ? 'OVERDUE'
            : 'PENDING';
      return [{
        id: row.id,
        dueDate: row.referenceDate,
        counterparty: row.investorNormalized ?? row.driverNormalized ?? row.plate,
        category: `${row.plate}${row.model ? ` • ${row.model}` : ''}`,
        plannedAmount,
        actualAmount,
        status,
        categorySource: null,
        qualityStatus,
      }];
    }

    const expenseTotal = getDerivedExpense(row);
    if (expenseTotal <= 0) return [];
    const parts = [
      toNumber(row.maintenanceByDriverAmount) > 0 ? 'Manutencao' : null,
      toNumber(row.lateFeeAmount) > 0 ? 'Multa/Atraso' : null,
      toNumber(row.discountAmount) > 0 ? 'Desconto' : null,
    ].filter(Boolean);

    return [{
      id: row.id,
      dueDate: row.referenceDate,
      counterparty: row.investorNormalized ?? row.driverNormalized ?? row.plate,
      category: `${parts.join(' + ')} • ${row.plate}`,
      plannedAmount: expenseTotal,
      actualAmount: expenseTotal,
      status: 'SETTLED' as const,
      categorySource: null,
      qualityStatus,
    }];
  });

  return mapped.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
}
