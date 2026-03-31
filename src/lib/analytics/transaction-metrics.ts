/**
 * Transaction Metrics Analytics Service
 * 
 * Provides aggregated metrics for:
 * - Time series (evolution charts)
 * - Top N rankings (by class/category)
 * - Summary with period comparison
 * 
 * All functions use centralized rules from metrics-utils.ts
 */

import { parseISO, format } from 'date-fns';
import { PrismaClient } from '@prisma/client';
import { dateRangeToDbFilter, type DateRangeStrings } from '@/lib/dateRange';
import {
  resolveAmount,
  chooseBucketGranularity,
  resolveCanonicalDate,
  getBucketKey,
  formatBucketLabel,
  calculatePreviousPeriod,
  calculateDelta,
  normalizeClassKey,
  formatClassLabel,
  extractAIT,
  matchesPaidByFilter,
  resolveFinePaidBy,
  resolveFinePaidByLabel,
  resolveTransactionPlate,
  type BucketGranularity,
  type MetricsSummary,
  type TimeSeriesPoint,
  type RankingItem,
  type PaidBy,
} from './metrics-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface TransactionMetricsParams {
  from: string;
  to: string;
  scope: 'income' | 'expense' | 'fines';
  paidByFilter?: 'ALL' | 'COMPANY' | 'LESSOR'; // For fines only
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

export interface SummaryResponse extends MetricsSummary {
  dateRange: DateRangeStrings;
  previousRange: DateRangeStrings;
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
  paidBy: PaidBy;
  paidByLabel: string;
  description: string | null;
  counterparty: string | null;
  category: string | null;
}

export interface FineListResponse {
  data: FineDetailItem[];
  total: number;
  page: number;
  pageSize: number;
  dateRange: DateRangeStrings;
}

interface AnalyticsRow {
  dueDate: Date | null;
  plannedDate: Date | null;
  actualDate: Date | null;
  status: string;
  plannedAmount: number | string | { toString(): string } | null;
  actualAmount: number | string | { toString(): string } | null;
  grossAmount: number | string | { toString(): string } | null;
  category?: string | null;
}

function buildTransactionWhere(
  scope: 'income' | 'expense' | 'fines',
  dateRange: DateRangeStrings
) {
  const dateFilter = dateRangeToDbFilter(dateRange);
  const where: {
    dueDate: { gte: Date; lte: Date };
    type?: 'PAYABLE' | 'RECEIVABLE';
    OR?: Array<{ category: { contains: string; mode: 'insensitive' } }>;
  } = {
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
  };

  if (scope === 'income') {
    where.type = 'RECEIVABLE';
  } else if (scope === 'expense') {
    where.type = 'PAYABLE';
  } else {
    where.type = 'PAYABLE';
    where.OR = [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ];
  }

  return where;
}

function toAnalyticsAmount(row: AnalyticsRow) {
  return resolveAmount({
    status: row.status,
    actualAmount: row.actualAmount != null ? Number(row.actualAmount) : null,
    plannedAmount: row.plannedAmount != null ? Number(row.plannedAmount) : null,
    grossAmount: row.grossAmount != null ? Number(row.grossAmount) : null,
  });
}

function buildSummaryResponse(
  currentRows: AnalyticsRow[],
  previousRows: AnalyticsRow[],
  currentRange: DateRangeStrings,
  previousRange: DateRangeStrings
): SummaryResponse {
  const currentMetrics = currentRows.reduce(
    (acc, row) => {
      acc.total += toAnalyticsAmount(row);
      acc.count += 1;
      return acc;
    },
    { total: 0, count: 0 }
  );

  const previousMetrics = previousRows.reduce(
    (acc, row) => {
      acc.total += toAnalyticsAmount(row);
      acc.count += 1;
      return acc;
    },
    { total: 0, count: 0 }
  );

  const delta = calculateDelta(currentMetrics.total, previousMetrics.total);

  return {
    total: currentMetrics.total,
    count: currentMetrics.count,
    prevTotal: previousMetrics.total,
    prevCount: previousMetrics.count,
    deltaValue: delta.value,
    deltaPct: delta.pct,
    dateRange: currentRange,
    previousRange,
  };
}

function buildTimeSeriesResponse(
  rows: AnalyticsRow[],
  dateRange: DateRangeStrings
): TimeSeriesResponse {
  const granularity = chooseBucketGranularity(parseISO(dateRange.from), parseISO(dateRange.to));
  const bucketMap = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const date = resolveCanonicalDate(row);
    if (!date) continue;

    const bucketKey = getBucketKey(date, granularity);
    const amount = toAnalyticsAmount(row);

    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { total: 0, count: 0 });
    }

    const bucket = bucketMap.get(bucketKey)!;
    bucket.total += amount;
    bucket.count += 1;
  }

  const data: TimeSeriesPoint[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      label: formatBucketLabel(date, granularity),
      total: values.total,
      count: values.count,
    }));

  return {
    data,
    granularity,
    dateRange,
  };
}

function buildTopRankingResponse(
  rows: AnalyticsRow[],
  dateRange: DateRangeStrings,
  limit: number
): TopRankingResponse {
  const categoryMap = new Map<string, { key: string; label: string; total: number; count: number }>();

  for (const row of rows) {
    const key = normalizeClassKey(row.category);
    const label = formatClassLabel(row.category);
    const amount = toAnalyticsAmount(row);

    if (!categoryMap.has(key)) {
      categoryMap.set(key, { key, label, total: 0, count: 0 });
    }

    const entry = categoryMap.get(key)!;
    entry.total += amount;
    entry.count += 1;
  }

  return {
    data: Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit),
    limit,
    dateRange,
  };
}

export async function getTransactionAnalyticsBundle(
  db: PrismaClient,
  params: Omit<TransactionMetricsParams, 'paidByFilter'> & { limit?: number }
): Promise<TransactionAnalyticsBundle> {
  const comparison = calculatePreviousPeriod(params.from, params.to);
  const limit = params.limit || 5;
  const select = {
    dueDate: true,
    plannedDate: true,
    actualDate: true,
    status: true,
    plannedAmount: true,
    actualAmount: true,
    grossAmount: true,
    category: true,
  };

  const [currentRows, previousRows] = await Promise.all([
    db.transaction.findMany({
      where: buildTransactionWhere(params.scope, comparison.current),
      select,
    }),
    db.transaction.findMany({
      where: buildTransactionWhere(params.scope, comparison.previous),
      select,
    }),
  ]);

  return {
    summary: buildSummaryResponse(currentRows, previousRows, comparison.current, comparison.previous),
    series: buildTimeSeriesResponse(currentRows, comparison.current),
    top: buildTopRankingResponse(currentRows, comparison.current, limit),
  };
}

// ============================================================================
// TIME SERIES
// ============================================================================

/**
 * Get time series data for transactions
 */
export async function getTransactionTimeSeries(
  db: PrismaClient,
  params: TransactionMetricsParams
): Promise<TimeSeriesResponse> {
  const dateFilter = dateRangeToDbFilter(params);
  const granularity = chooseBucketGranularity(parseISO(params.from), parseISO(params.to));
  
  // Build where clause based on scope
  const where: any = {
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
  };
  
  if (params.scope === 'income') {
    where.type = 'RECEIVABLE';
  } else if (params.scope === 'expense') {
    where.type = 'PAYABLE';
    // Exclude fines from general expenses if needed
    // where.NOT = { category: { in: finesCategories } };
  } else if (params.scope === 'fines') {
    where.type = 'PAYABLE';
    // Only include fines categories
    where.OR = [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ];
  }
  
  const transactions = await db.transaction.findMany({
    where,
    select: {
      id: true,
      dueDate: true,
      plannedDate: true,
      actualDate: true,
      status: true,
      plannedAmount: true,
      actualAmount: true,
      grossAmount: true,
      description: true,
      rawJson: true,
    },
  });
  
  // Aggregate by bucket
  const bucketMap = new Map<string, { total: number; count: number }>();
  
  for (const tx of transactions) {
    // For fines, apply paidBy filter if specified
    if (params.scope === 'fines' && params.paidByFilter) {
      const rawJson = tx.rawJson as Record<string, unknown> | null;
      const description = tx.description || (rawJson?.['Histórico'] as string) || (rawJson?.['Descrição'] as string) || '';
      const paidBy = resolveFinePaidBy({ description, rawJson });
      if (!matchesPaidByFilter(paidBy, params.paidByFilter)) {
        continue;
      }
    }
    
    const date = tx.dueDate || tx.plannedDate || tx.actualDate;
    if (!date) continue;
    
    const bucketKey = getBucketKey(date, granularity);
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { total: 0, count: 0 });
    }
    
    const bucket = bucketMap.get(bucketKey)!;
    bucket.total += amount;
    bucket.count += 1;
  }
  
  // Convert to sorted array
  const data: TimeSeriesPoint[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      label: formatBucketLabel(date, granularity),
      total: values.total,
      count: values.count,
    }));
  
  return {
    data,
    granularity,
    dateRange: { from: params.from, to: params.to },
  };
}

// ============================================================================
// TOP RANKING BY CLASS
// ============================================================================

/**
 * Get top N categories/classes by total value
 */
export async function getTopByClass(
  db: PrismaClient,
  params: TransactionMetricsParams & { limit?: number }
): Promise<TopRankingResponse> {
  const dateFilter = dateRangeToDbFilter(params);
  const limit = params.limit || 5;
  
  // Build where clause based on scope
  const where: any = {
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
  };
  
  if (params.scope === 'income') {
    where.type = 'RECEIVABLE';
  } else if (params.scope === 'expense') {
    where.type = 'PAYABLE';
  } else if (params.scope === 'fines') {
    where.type = 'PAYABLE';
    where.OR = [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ];
  }
  
  const transactions = await db.transaction.findMany({
    where,
    select: {
      category: true,
      status: true,
      plannedAmount: true,
      actualAmount: true,
      grossAmount: true,
    },
  });
  
  // Aggregate by category
  const categoryMap = new Map<string, { key: string; label: string; total: number; count: number }>();
  
  for (const tx of transactions) {
    const key = normalizeClassKey(tx.category);
    const label = formatClassLabel(tx.category);
    
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { key, label, total: 0, count: 0 });
    }
    
    const entry = categoryMap.get(key)!;
    entry.total += amount;
    entry.count += 1;
  }
  
  // Sort by total descending and take top N
  const data: RankingItem[] = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  
  return {
    data,
    limit,
    dateRange: { from: params.from, to: params.to },
  };
}

// ============================================================================
// SUMMARY WITH PERIOD COMPARISON
// ============================================================================

/**
 * Get summary metrics with comparison to previous period
 */
export async function getTransactionSummary(
  db: PrismaClient,
  params: TransactionMetricsParams
): Promise<SummaryResponse> {
  const comparison = calculatePreviousPeriod(params.from, params.to);
  
  // Get current period metrics
  const currentMetrics = await aggregateForPeriod(db, params, comparison.current);
  
  // Get previous period metrics
  const previousMetrics = await aggregateForPeriod(db, params, comparison.previous);
  
  // Calculate deltas
  const deltaTotal = calculateDelta(currentMetrics.total, previousMetrics.total);
  // deltaCount is computed but not used in return; keeping for potential future use
  const _deltaCount = calculateDelta(currentMetrics.count, previousMetrics.count);
  
  return {
    total: currentMetrics.total,
    count: currentMetrics.count,
    prevTotal: previousMetrics.total,
    prevCount: previousMetrics.count,
    deltaValue: deltaTotal.value,
    deltaPct: deltaTotal.pct,
    dateRange: comparison.current,
    previousRange: comparison.previous,
  };
}

async function aggregateForPeriod(
  db: PrismaClient,
  params: TransactionMetricsParams,
  period: DateRangeStrings
): Promise<{ total: number; count: number }> {
  const dateFilter = dateRangeToDbFilter(period);
  
  const where: any = {
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
  };
  
  if (params.scope === 'income') {
    where.type = 'RECEIVABLE';
  } else if (params.scope === 'expense') {
    where.type = 'PAYABLE';
  } else if (params.scope === 'fines') {
    where.type = 'PAYABLE';
    where.OR = [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ];
  }
  
  const transactions = await db.transaction.findMany({
    where,
    select: {
      status: true,
      plannedAmount: true,
      actualAmount: true,
      grossAmount: true,
      description: true,
      rawJson: true,
    },
  });
  
  let total = 0;
  let count = 0;
  
  for (const tx of transactions) {
    // Apply paidBy filter for fines
    if (params.scope === 'fines' && params.paidByFilter) {
      const rawJson = tx.rawJson as Record<string, unknown> | null;
      const description = tx.description || (rawJson?.['Histórico'] as string) || (rawJson?.['Descrição'] as string) || '';
      const paidBy = resolveFinePaidBy({ description, rawJson });
      if (!matchesPaidByFilter(paidBy, params.paidByFilter)) {
        continue;
      }
    }
    
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    total += amount;
    count += 1;
  }
  
  return { total, count };
}

// ============================================================================
// VEHICLE RANKING (for fines)
// ============================================================================

/**
 * Get vehicle ranking for fines by plate
 */
export async function getVehicleRanking(
  db: PrismaClient,
  params: TransactionMetricsParams & { 
    limit?: number; 
    sortBy?: 'count' | 'value';
  }
): Promise<VehicleRankingResponse> {
  const dateFilter = dateRangeToDbFilter(params);
  const limit = params.limit || 10;
  const sortBy = params.sortBy || 'count';
  
  const where: any = {
    type: 'PAYABLE',
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
    OR: [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ],
  };
  
  const transactions = await db.transaction.findMany({
    where,
    select: {
      status: true,
      plannedAmount: true,
      actualAmount: true,
      grossAmount: true,
      description: true,
      rawJson: true,
    },
  });
  
  // Aggregate by plate
  const plateMap = new Map<string, { total: number; count: number; aitCodes: Set<string> }>();
  
  for (const tx of transactions) {
    // Apply paidBy filter
    const rawJson = tx.rawJson as Record<string, unknown> | null;
    const description = tx.description || (rawJson?.['Histórico'] as string) || (rawJson?.['Descrição'] as string) || '';
    if (params.paidByFilter) {
      const paidBy = resolveFinePaidBy({ description, rawJson });
      if (!matchesPaidByFilter(paidBy, params.paidByFilter)) {
        continue;
      }
    }
    
    // Extract plate
    const plate = resolveTransactionPlate({ description, rawJson }) || 'SEM PLACA';
    const ait = extractAIT(description);
    
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    if (!plateMap.has(plate)) {
      plateMap.set(plate, { total: 0, count: 0, aitCodes: new Set() });
    }
    
    const entry = plateMap.get(plate)!;
    entry.total += amount;
    entry.count += 1;
    if (ait) entry.aitCodes.add(ait);
  }
  
  // Sort and take top N
  const sortedEntries = Array.from(plateMap.entries())
    .sort(([, a], [, b]) => 
      sortBy === 'count' ? b.count - a.count : b.total - a.total
    )
    .slice(0, limit);
  
  const data: VehicleRankingItem[] = sortedEntries.map(([plate, values]) => ({
    plate,
    total: values.total,
    count: values.count,
    aitCodes: Array.from(values.aitCodes),
  }));
  
  return {
    data,
    limit,
    sortBy,
    dateRange: { from: params.from, to: params.to },
  };
}

// ============================================================================
// FINES DETAILED LIST
// ============================================================================

/**
 * Get paginated list of fines with detailed info
 */
export async function getFinesList(
  db: PrismaClient,
  params: TransactionMetricsParams & { 
    page?: number; 
    pageSize?: number;
  }
): Promise<FineListResponse> {
  const dateFilter = dateRangeToDbFilter(params);
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  
  const where: any = {
    type: 'PAYABLE',
    dueDate: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
    OR: [
      { category: { contains: 'Multa', mode: 'insensitive' } },
      { category: { contains: 'Detran', mode: 'insensitive' } },
      { category: { contains: 'Correios', mode: 'insensitive' } },
    ],
  };
  
  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        dueDate: true,
        plannedDate: true,
        actualDate: true,
        status: true,
        plannedAmount: true,
        actualAmount: true,
        grossAmount: true,
        description: true,
        counterparty: true,
        category: true,
        rawJson: true,
      },
    }),
  ]);
  
  // Process and filter by paidBy
  const data: FineDetailItem[] = [];
  
  for (const tx of transactions) {
    const rawJson = tx.rawJson as Record<string, unknown> | null;
    const description = tx.description || (rawJson?.['Histórico'] as string) || (rawJson?.['Descrição'] as string) || '';
    const paidBy = resolveFinePaidBy({ description, rawJson });
    const paidByLabel = resolveFinePaidByLabel({ description, rawJson });
    
    // Apply paidBy filter
    if (params.paidByFilter && !matchesPaidByFilter(paidBy, params.paidByFilter)) {
      continue;
    }
    
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    data.push({
      id: tx.id,
      date: tx.dueDate ? format(tx.dueDate, 'yyyy-MM-dd') : '',
      plate: resolveTransactionPlate({ description, rawJson }),
      aitCode: extractAIT(description),
      amount,
      status: tx.status,
      paidBy,
      paidByLabel,
      description: tx.description,
      counterparty: tx.counterparty,
      category: tx.category,
    });
  }
  
  return {
    data,
    total,
    page,
    pageSize,
    dateRange: { from: params.from, to: params.to },
  };
}
