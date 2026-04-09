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
import { dateRangeToDbFilter, type DateRangeStrings } from '@/lib/dateRange';
import type {
  AnalyticsScope,
  BucketGranularity,
  CashflowDataPoint,
  CategoryDriver,
  CategoryExpense,
  DashboardSummary,
  ExecComparison,
  ExecDashboardResponse,
  ExecSeriesPoint,
  ExecSummary,
  FineDetailItem,
  FineListResponse,
  MetricsSummary,
  MetricsSummaryWithComparison,
  OperationalQualityStatus,
  OperationalTableRow,
  SummaryResponse,
  TimeSeriesResponse,
  TopRankingResponse,
  TransactionAnalyticsBundle,
  VehicleRankingResponse,
} from './operational-metrics';

type FinancialEntryRow = {
  id: string;
  entryDate: Date;
  domain: 'REVENUE' | 'EXPENSE' | 'INVESTMENT';
  direction: 'INFLOW' | 'OUTFLOW';
  groupRaw: string | null;
  groupNormalized: string | null;
  detailRaw: string | null;
  categoryRaw: string | null;
  accountRaw: string | null;
  amount: unknown;
  rawJson: unknown;
  sourceSheetName: string;
  sourceRowNumber: number;
};

type FineRow = {
  id: string;
  infractionDate: Date;
  issuingAuthorityRaw: string | null;
  driverRaw: string | null;
  driverNormalized: string | null;
  paymentState: 'UNKNOWN' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CONTESTED' | 'CANCELLED';
  amount: unknown;
  plate: string;
  ait: string | null;
  vehicleRaw: string | null;
  rawJson: unknown;
  sourceRowNumber: number;
};

type SnapshotSummaryRow = {
  referenceDate: Date;
  vehicleStatusNormalized: string | null;
  contractValue: unknown;
  lateFeeAmount: unknown;
  discountAmount: unknown;
  amountToCharge: unknown;
  maintenanceByDriverAmount: unknown;
  amountPaidWeek: unknown;
  openAmount: unknown;
  rawJson: unknown;
};

type PlatePartyMap = Record<string, { investor: string | null; driver: string | null }>;

export interface WorkbookDashboardData {
  summary: DashboardSummary;
  cashflow: CashflowDataPoint[];
  topCategories: CategoryExpense[];
  dateRange: DateRangeStrings;
  financialSummary: {
    revenue: number;
    expense: number;
    investments: number;
    netCashAfterInvestments: number;
    entryCount: number;
  };
  operationalSummary: {
    revenueReceived: number;
    amountToCharge: number;
    operationalCost: number;
    netOperational: number;
    pendingReceivables: number;
    fleetStates: Array<{ status: string; count: number }>;
    qualitySummary: Record<OperationalQualityStatus, number>;
    snapshotCount: number;
    latestReferenceDate: string | null;
  };
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampMoney(value: number): number {
  return Math.round(value * 100) / 100;
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

function summarizeQuality(rawRows: Array<{ rawJson: unknown }>): Record<OperationalQualityStatus, number> {
  return rawRows.reduce((acc, row) => {
    acc[getQualityStatus(row.rawJson)] += 1;
    return acc;
  }, emptyQualitySummary());
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

async function listFinancialEntries(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  domains: Array<'REVENUE' | 'EXPENSE' | 'INVESTMENT'>
): Promise<FinancialEntryRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.financialEntry.findMany({
    where: {
      entryDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
      domain: { in: domains },
    },
    select: {
      id: true,
      entryDate: true,
      domain: true,
      direction: true,
      groupRaw: true,
      groupNormalized: true,
      detailRaw: true,
      categoryRaw: true,
      accountRaw: true,
      amount: true,
      rawJson: true,
      sourceSheetName: true,
      sourceRowNumber: true,
    },
    orderBy: [{ entryDate: 'desc' }, { sourceRowNumber: 'asc' }],
  }) as Promise<FinancialEntryRow[]>;
}

async function listFineRecords(db: PrismaClient, dateRange: DateRangeStrings): Promise<FineRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.fineRecord.findMany({
    where: {
      infractionDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
    },
    select: {
      id: true,
      infractionDate: true,
      issuingAuthorityRaw: true,
      driverRaw: true,
      driverNormalized: true,
      paymentState: true,
      amount: true,
      plate: true,
      ait: true,
      vehicleRaw: true,
      rawJson: true,
      sourceRowNumber: true,
    },
    orderBy: [{ infractionDate: 'desc' }, { plate: 'asc' }],
  }) as Promise<FineRow[]>;
}

async function listOperationalSummaryRows(db: PrismaClient, dateRange: DateRangeStrings): Promise<SnapshotSummaryRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.operationalSnapshot.findMany({
    where: {
      referenceDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
    },
    select: {
      referenceDate: true,
      vehicleStatusNormalized: true,
      contractValue: true,
      lateFeeAmount: true,
      discountAmount: true,
      amountToCharge: true,
      maintenanceByDriverAmount: true,
      amountPaidWeek: true,
      openAmount: true,
      rawJson: true,
    },
  }) as Promise<SnapshotSummaryRow[]>;
}

async function getPlatePartyMap(db: PrismaClient, plates: string[]): Promise<PlatePartyMap> {
  if (plates.length === 0) return {};

  const rows = await db.operationalSnapshot.findMany({
    where: { plate: { in: plates } },
    select: {
      plate: true,
      investorNormalized: true,
      driverNormalized: true,
      referenceDate: true,
    },
    orderBy: [{ referenceDate: 'desc' }],
  });

  const map: PlatePartyMap = {};
  for (const row of rows) {
    if (!map[row.plate]) {
      map[row.plate] = {
        investor: row.investorNormalized,
        driver: row.driverNormalized,
      };
    }
  }
  return map;
}

function getFinancialLabel(row: FinancialEntryRow): string {
  if (row.domain === 'REVENUE') {
    return row.groupRaw || row.accountRaw || 'Sem origem';
  }
  return row.categoryRaw || row.groupRaw || row.detailRaw || row.accountRaw || 'Sem categoria';
}

function getFinancialCounterparty(row: FinancialEntryRow): string | null {
  if (row.domain === 'REVENUE') {
    return row.accountRaw || row.groupRaw || null;
  }
  return row.accountRaw || row.groupRaw || null;
}

function buildFinancialSeries(rows: FinancialEntryRow[], dateRange: DateRangeStrings): TimeSeriesResponse {
  const days = differenceInDays(parseISO(dateRange.to), parseISO(dateRange.from));
  const granularity: BucketGranularity = days > 90 ? 'month' : days > 35 ? 'week' : 'day';
  const bucketMap = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const bucket = getBucketKey(row.entryDate, granularity);
    const current = bucketMap.get(bucket) ?? { total: 0, count: 0 };
    current.total += toNumber(row.amount);
    current.count += 1;
    bucketMap.set(bucket, current);
  }

  return {
    data: generateBuckets(dateRange.from, dateRange.to, granularity).map((bucket) => {
      const current = bucketMap.get(bucket) ?? { total: 0, count: 0 };
      return {
        date: bucket,
        label: getBucketLabel(bucket, granularity),
        total: clampMoney(current.total),
        count: current.count,
      };
    }),
    granularity,
    dateRange,
  };
}

function buildFinancialTopRanking(rows: FinancialEntryRow[], limit: number): TopRankingResponse['data'] {
  const ranking = new Map<string, { key: string; label: string; total: number; count: number }>();

  for (const row of rows) {
    const label = getFinancialLabel(row);
    const key = label.toLowerCase();
    const current = ranking.get(key) ?? { key, label, total: 0, count: 0 };
    current.total += toNumber(row.amount);
    current.count += 1;
    ranking.set(key, current);
  }

  return Array.from(ranking.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((item) => ({
      key: item.key,
      label: item.label,
      total: clampMoney(item.total),
      count: item.count,
    }));
}

function buildFineSeries(rows: FineRow[], dateRange: DateRangeStrings): TimeSeriesResponse {
  const days = differenceInDays(parseISO(dateRange.to), parseISO(dateRange.from));
  const granularity: BucketGranularity = days > 90 ? 'month' : days > 35 ? 'week' : 'day';
  const bucketMap = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const bucket = getBucketKey(row.infractionDate, granularity);
    const current = bucketMap.get(bucket) ?? { total: 0, count: 0 };
    current.total += toNumber(row.amount);
    current.count += 1;
    bucketMap.set(bucket, current);
  }

  return {
    data: generateBuckets(dateRange.from, dateRange.to, granularity).map((bucket) => {
      const current = bucketMap.get(bucket) ?? { total: 0, count: 0 };
      return {
        date: bucket,
        label: getBucketLabel(bucket, granularity),
        total: clampMoney(current.total),
        count: current.count,
      };
    }),
    granularity,
    dateRange,
  };
}

export async function getMetricsSummary(db: PrismaClient, dateRange: DateRangeStrings): Promise<MetricsSummary> {
  const [revenues, expenses] = await Promise.all([
    listFinancialEntries(db, dateRange, ['REVENUE']),
    listFinancialEntries(db, dateRange, ['EXPENSE']),
  ]);

  const incomeReceived = clampMoney(revenues.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const expensePaid = clampMoney(expenses.reduce((acc, row) => acc + toNumber(row.amount), 0));

  return {
    income: {
      received: incomeReceived,
      receivable: 0,
      overdue: 0,
      receivedCount: revenues.length,
      receivableCount: 0,
      overdueCount: 0,
    },
    expense: {
      paid: expensePaid,
      payable: 0,
      overdue: 0,
      paidCount: expenses.length,
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
      receivableDelta: 0,
      receivableDeltaPct: null,
      payableDelta: 0,
      payableDeltaPct: null,
    },
  };
}

export async function getTransactionSummary(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<SummaryResponse> {
  const currentRange = { from: params.from, to: params.to };
  const previousRange = calculatePreviousPeriod(params.from, params.to);

  if (params.scope === 'fines') {
    const [currentRows, previousRows] = await Promise.all([
      listFineRecords(db, currentRange),
      listFineRecords(db, previousRange),
    ]);
    const currentTotal = clampMoney(currentRows.reduce((acc, row) => acc + toNumber(row.amount), 0));
    const previousTotal = clampMoney(previousRows.reduce((acc, row) => acc + toNumber(row.amount), 0));

    return {
      total: currentTotal,
      count: currentRows.length,
      prevTotal: previousTotal,
      prevCount: previousRows.length,
      deltaValue: clampMoney(currentTotal - previousTotal),
      deltaPct: calculateDeltaPct(currentTotal, previousTotal),
      dateRange: currentRange,
      previousRange,
      qualitySummary: summarizeQuality(currentRows),
    };
  }

  const domains = params.scope === 'income' ? ['REVENUE'] as const : ['EXPENSE'] as const;
  const [currentRows, previousRows] = await Promise.all([
    listFinancialEntries(db, currentRange, [...domains]),
    listFinancialEntries(db, previousRange, [...domains]),
  ]);
  const currentTotal = clampMoney(currentRows.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const previousTotal = clampMoney(previousRows.reduce((acc, row) => acc + toNumber(row.amount), 0));

  return {
    total: currentTotal,
    count: currentRows.length,
    prevTotal: previousTotal,
    prevCount: previousRows.length,
    deltaValue: clampMoney(currentTotal - previousTotal),
    deltaPct: calculateDeltaPct(currentTotal, previousTotal),
    dateRange: currentRange,
    previousRange,
    qualitySummary: summarizeQuality(currentRows),
  };
}

export async function getTransactionTimeSeries(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR' }
): Promise<TimeSeriesResponse> {
  const dateRange = { from: params.from, to: params.to };
  if (params.scope === 'fines') {
    return buildFineSeries(await listFineRecords(db, dateRange), dateRange);
  }

  const domains = params.scope === 'income' ? ['REVENUE'] as const : ['EXPENSE'] as const;
  return buildFinancialSeries(await listFinancialEntries(db, dateRange, [...domains]), dateRange);
}

export async function getTopByClass(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; limit?: number }
): Promise<TopRankingResponse> {
  const limit = params.limit ?? 5;
  const dateRange = { from: params.from, to: params.to };

  if (params.scope === 'fines') {
    const rows = await listFineRecords(db, dateRange);
    const ranking = new Map<string, { key: string; label: string; total: number; count: number }>();
    for (const row of rows) {
      const label = row.issuingAuthorityRaw || 'Sem órgão';
      const key = label.toLowerCase();
      const current = ranking.get(key) ?? { key, label, total: 0, count: 0 };
      current.total += toNumber(row.amount);
      current.count += 1;
      ranking.set(key, current);
    }

    return {
      data: Array.from(ranking.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((item) => ({
          key: item.key,
          label: item.label,
          total: clampMoney(item.total),
          count: item.count,
        })),
      limit,
      dateRange,
    };
  }

  const domains = params.scope === 'income' ? ['REVENUE'] as const : ['EXPENSE'] as const;
  return {
    data: buildFinancialTopRanking(await listFinancialEntries(db, dateRange, [...domains]), limit),
    limit,
    dateRange,
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

export async function listFinancialTableRows(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  scope: 'income' | 'expense'
): Promise<OperationalTableRow[]> {
  const domains = scope === 'income' ? ['REVENUE'] as const : ['EXPENSE'] as const;
  const rows = await listFinancialEntries(db, dateRange, [...domains]);

  return rows.map((row) => ({
    id: row.id,
    dueDate: row.entryDate,
    counterparty: getFinancialCounterparty(row),
    category: getFinancialLabel(row),
    plannedAmount: clampMoney(toNumber(row.amount)),
    actualAmount: clampMoney(toNumber(row.amount)),
    status: 'SETTLED',
    categorySource: null,
    qualityStatus: getQualityStatus(row.rawJson),
  }));
}

function mapFinePaymentStateToLabel(
  state: FineRow['paymentState']
): { status: string; paidByLabel: string } {
  switch (state) {
    case 'PAID':
      return { status: 'PAGO', paidByLabel: 'Pago' };
    case 'PARTIAL':
      return { status: 'PARCIAL', paidByLabel: 'Parcial' };
    case 'CONTESTED':
      return { status: 'CONTESTADA', paidByLabel: 'Contestada' };
    case 'CANCELLED':
      return { status: 'CANCELADA', paidByLabel: 'Cancelada' };
    case 'UNPAID':
      return { status: 'ABERTA', paidByLabel: 'Em aberto' };
    default:
      return { status: 'DESCONHECIDO', paidByLabel: 'Nao informado' };
  }
}

export async function getVehicleRanking(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR'; limit?: number; sortBy?: 'count' | 'value' }
): Promise<VehicleRankingResponse> {
  const rows = await listFineRecords(db, { from: params.from, to: params.to });
  const limit = params.limit ?? 10;
  const sortBy = params.sortBy ?? 'count';
  const ranking = new Map<string, { plate: string; total: number; count: number; aitCodes: string[] }>();

  for (const row of rows) {
    const plate = row.plate || 'SEM-PLACA';
    const current = ranking.get(plate) ?? { plate, total: 0, count: 0, aitCodes: [] };
    current.total += toNumber(row.amount);
    current.count += 1;
    if (row.ait) {
      current.aitCodes.push(row.ait);
    }
    ranking.set(plate, current);
  }

  return {
    data: Array.from(ranking.values())
      .sort((a, b) => (sortBy === 'value' ? b.total - a.total : b.count - a.count))
      .slice(0, limit)
      .map((item) => ({
        plate: item.plate,
        total: clampMoney(item.total),
        count: item.count,
        aitCodes: item.aitCodes.slice(0, 5),
      })),
    limit,
    sortBy,
    dateRange: { from: params.from, to: params.to },
  };
}

export async function getFinesList(
  db: PrismaClient,
  params: { from: string; to: string; scope: AnalyticsScope; paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR'; page?: number; pageSize?: number }
): Promise<FineListResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const rows = await listFineRecords(db, { from: params.from, to: params.to });
  const plateMap = await getPlatePartyMap(db, Array.from(new Set(rows.map((row) => row.plate).filter(Boolean))));
  const start = (page - 1) * pageSize;
  const pagedRows = rows.slice(start, start + pageSize);

  const data: FineDetailItem[] = pagedRows.map((row) => {
    const match = plateMap[row.plate] ?? { investor: null, driver: null };
    const paymentInfo = mapFinePaymentStateToLabel(row.paymentState);
    return {
      id: row.id,
      date: format(row.infractionDate, 'yyyy-MM-dd'),
      plate: row.plate,
      aitCode: row.ait,
      amount: clampMoney(toNumber(row.amount)),
      status: paymentInfo.status,
      paidBy: 'UNKNOWN',
      paidByLabel: paymentInfo.paidByLabel,
      description: row.vehicleRaw,
      counterparty: row.issuingAuthorityRaw,
      category: 'Multa oficial',
      investor: match.investor,
      driver: row.driverNormalized || match.driver,
      qualityStatus: getQualityStatus(row.rawJson),
      sourceRowNumber: row.sourceRowNumber,
    };
  });

  return {
    data,
    total: rows.length,
    page,
    pageSize,
    dateRange: { from: params.from, to: params.to },
  };
}

export async function getDashboardData(db: PrismaClient, dateRange: DateRangeStrings): Promise<WorkbookDashboardData> {
  const [revenues, expenses, investments, snapshots] = await Promise.all([
    listFinancialEntries(db, dateRange, ['REVENUE']),
    listFinancialEntries(db, dateRange, ['EXPENSE']),
    listFinancialEntries(db, dateRange, ['INVESTMENT']),
    listOperationalSummaryRows(db, dateRange),
  ]);

  const totalRevenue = clampMoney(revenues.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const totalExpenses = clampMoney(expenses.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const totalInvestments = clampMoney(investments.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const operationalRevenue = clampMoney(snapshots.reduce((acc, row) => acc + toNumber(row.amountPaidWeek), 0));
  const operationalCosts = clampMoney(
    snapshots.reduce(
      (acc, row) =>
        acc +
        toNumber(row.maintenanceByDriverAmount) +
        toNumber(row.lateFeeAmount) +
        toNumber(row.discountAmount),
      0
    )
  );
  const operationalAmountToCharge = clampMoney(
    snapshots.reduce((acc, row) => acc + (toNumber(row.amountToCharge) || toNumber(row.contractValue)), 0)
  );
  const operationalPending = clampMoney(snapshots.reduce((acc, row) => acc + toNumber(row.openAmount), 0));
  const latestReferenceDate = snapshots.reduce<Date | null>(
    (latest, row) => (latest === null || isAfter(row.referenceDate, latest) ? row.referenceDate : latest),
    null
  );
  const fleetStatesMap = new Map<string, number>();
  for (const row of snapshots) {
    const key = row.vehicleStatusNormalized || 'Sem status';
    fleetStatesMap.set(key, (fleetStatesMap.get(key) ?? 0) + 1);
  }

  const cashflowBuckets = new Map<string, { revenue: number; expenses: number }>();
  for (const row of revenues) {
    const key = format(row.entryDate, 'yyyy-MM-dd');
    const current = cashflowBuckets.get(key) ?? { revenue: 0, expenses: 0 };
    current.revenue += toNumber(row.amount);
    cashflowBuckets.set(key, current);
  }
  for (const row of [...expenses, ...investments]) {
    const key = format(row.entryDate, 'yyyy-MM-dd');
    const current = cashflowBuckets.get(key) ?? { revenue: 0, expenses: 0 };
    current.expenses += toNumber(row.amount);
    cashflowBuckets.set(key, current);
  }

  let runningBalance = 0;
  const cashflow = generateBuckets(dateRange.from, dateRange.to, 'day').map((key) => {
    const values = cashflowBuckets.get(key) ?? { revenue: 0, expenses: 0 };
    runningBalance += values.revenue - values.expenses;
    return {
      date: key,
      revenue: clampMoney(values.revenue),
      expenses: clampMoney(values.expenses),
      balance: clampMoney(runningBalance),
    };
  });

  const outflowTopMap = new Map<string, { category: string; total: number; count: number }>();
  for (const row of [...expenses, ...investments]) {
    const category = row.domain === 'INVESTMENT'
      ? `Investimento: ${getFinancialLabel(row)}`
      : getFinancialLabel(row);
    const current = outflowTopMap.get(category) ?? { category, total: 0, count: 0 };
    current.total += toNumber(row.amount);
    current.count += 1;
    outflowTopMap.set(category, current);
  }

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      netProfit: clampMoney(totalRevenue - totalExpenses),
      pendingPayables: 0,
      overduePayables: 0,
      pendingReceivables: 0,
      overdueReceivables: 0,
      fleetStates: Array.from(fleetStatesMap.entries()).map(([status, count]) => ({ status, count })),
      qualitySummary: summarizeQuality(snapshots),
    },
    cashflow,
    topCategories: Array.from(outflowTopMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((item) => ({
        category: item.category,
        total: clampMoney(item.total),
        count: item.count,
      })),
    dateRange,
    financialSummary: {
      revenue: totalRevenue,
      expense: totalExpenses,
      investments: totalInvestments,
      netCashAfterInvestments: clampMoney(totalRevenue - totalExpenses - totalInvestments),
      entryCount: revenues.length + expenses.length + investments.length,
    },
    operationalSummary: {
      revenueReceived: operationalRevenue,
      amountToCharge: operationalAmountToCharge,
      operationalCost: operationalCosts,
      netOperational: clampMoney(operationalRevenue - operationalCosts),
      pendingReceivables: operationalPending,
      fleetStates: Array.from(fleetStatesMap.entries()).map(([status, count]) => ({ status, count })),
      qualitySummary: summarizeQuality(snapshots),
      snapshotCount: snapshots.length,
      latestReferenceDate: latestReferenceDate ? format(latestReferenceDate, 'yyyy-MM-dd') : null,
    },
  };
}

export async function getExecDashboardData(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  bucket: BucketGranularity = 'week'
): Promise<ExecDashboardResponse> {
  const previousRange = calculatePreviousPeriod(dateRange.from, dateRange.to);
  const [currentRevenue, currentExpense, previousRevenue, previousExpense] = await Promise.all([
    listFinancialEntries(db, dateRange, ['REVENUE']),
    listFinancialEntries(db, dateRange, ['EXPENSE']),
    listFinancialEntries(db, previousRange, ['REVENUE']),
    listFinancialEntries(db, previousRange, ['EXPENSE']),
  ]);

  const currentIncomeTotal = clampMoney(currentRevenue.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const currentExpenseTotal = clampMoney(currentExpense.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const previousIncomeTotal = clampMoney(previousRevenue.reduce((acc, row) => acc + toNumber(row.amount), 0));
  const previousExpenseTotal = clampMoney(previousExpense.reduce((acc, row) => acc + toNumber(row.amount), 0));

  const summary: ExecSummary = {
    incomeReceived: currentIncomeTotal,
    expensePaid: currentExpenseTotal,
    profitCash: clampMoney(currentIncomeTotal - currentExpenseTotal),
    margin: calculateMargin(currentIncomeTotal - currentExpenseTotal, currentIncomeTotal),
    receivable: 0,
    payable: 0,
    receivableOverdue: 0,
    payableOverdue: 0,
  };

  const previousProfit = clampMoney(previousIncomeTotal - previousExpenseTotal);
  const previousMargin = calculateMargin(previousProfit, previousIncomeTotal);

  const comparison: ExecComparison = {
    incomeReceived: {
      prev: previousIncomeTotal,
      deltaValue: clampMoney(currentIncomeTotal - previousIncomeTotal),
      deltaPct: calculateDeltaPct(currentIncomeTotal, previousIncomeTotal),
    },
    expensePaid: {
      prev: previousExpenseTotal,
      deltaValue: clampMoney(currentExpenseTotal - previousExpenseTotal),
      deltaPct: calculateDeltaPct(currentExpenseTotal, previousExpenseTotal),
    },
    profitCash: {
      prev: previousProfit,
      deltaValue: clampMoney(summary.profitCash - previousProfit),
      deltaPct: calculateDeltaPct(summary.profitCash, previousProfit),
    },
    receivable: { prev: 0, deltaValue: 0, deltaPct: null },
    payable: { prev: 0, deltaValue: 0, deltaPct: null },
    margin: {
      prev: previousMargin,
      deltaPP: summary.margin != null && previousMargin != null ? clampMoney(summary.margin - previousMargin) : null,
    },
  };

  const buckets = generateBuckets(dateRange.from, dateRange.to, bucket);
  const bucketMap = new Map<string, { incomeReceived: number; expensePaid: number }>();
  for (const row of currentRevenue) {
    const key = getBucketKey(row.entryDate, bucket);
    const current = bucketMap.get(key) ?? { incomeReceived: 0, expensePaid: 0 };
    current.incomeReceived += toNumber(row.amount);
    bucketMap.set(key, current);
  }
  for (const row of currentExpense) {
    const key = getBucketKey(row.entryDate, bucket);
    const current = bucketMap.get(key) ?? { incomeReceived: 0, expensePaid: 0 };
    current.expensePaid += toNumber(row.amount);
    bucketMap.set(key, current);
  }

  const previousExpenseMap = new Map<string, number>();
  for (const row of previousExpense) {
    const label = getFinancialLabel(row);
    previousExpenseMap.set(label, (previousExpenseMap.get(label) ?? 0) + toNumber(row.amount));
  }

  const currentExpenseMap = new Map<string, number>();
  for (const row of currentExpense) {
    const label = getFinancialLabel(row);
    currentExpenseMap.set(label, (currentExpenseMap.get(label) ?? 0) + toNumber(row.amount));
  }

  const drivers: CategoryDriver[] = Array.from(currentExpenseMap.entries())
    .map(([label, total]) => {
      const prev = clampMoney(previousExpenseMap.get(label) ?? 0);
      return {
        categoryId: label.toLowerCase(),
        categoryName: label,
        totalPaid: clampMoney(total),
        prevTotalPaid: prev,
        deltaValue: clampMoney(total - prev),
        deltaPct: calculateDeltaPct(total, prev),
      };
    })
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, 5);

  const series: ExecSeriesPoint[] = buckets.map((bucketStart) => {
    const current = bucketMap.get(bucketStart) ?? { incomeReceived: 0, expensePaid: 0 };
    return {
      bucketStart,
      bucketLabel: getBucketLabel(bucketStart, bucket),
      incomeReceived: clampMoney(current.incomeReceived),
      expensePaid: clampMoney(current.expensePaid),
      profitCash: clampMoney(current.incomeReceived - current.expensePaid),
    };
  });

  return {
    summary,
    comparison,
    series,
    drivers,
    dateRange,
    previousRange,
    bucket,
    qualitySummary: emptyQualitySummary(),
  };
}
