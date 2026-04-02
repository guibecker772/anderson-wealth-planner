import { PrismaClient } from '@prisma/client';
import { type DateRangeStrings, dateRangeToDbFilter } from '@/lib/dateRange';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QualityStatus = 'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN';

export interface FleetKPIs {
  totalVehicles: number;
  totalSnapshots: number;
  operationalRevenueReceived: number;
  operationalCost: number;
  amountToCharge: number;
  openAmount: number;
  operationalResult: number;
  statusDistribution: FleetStatusCount[];
}

export interface FleetStatusCount {
  status: string;
  count: number;
}

export interface FleetVehicleRow {
  plate: string;
  model: string | null;
  investor: string | null;
  driver: string | null;
  currentStatus: string;
  snapshotCount: number;
  revenueReceived: number;
  operationalCost: number;
  amountToCharge: number;
  openAmount: number;
  operationalResult: number;
  weekCount: number;
  qualitySummary: Record<QualityStatus, number>;
}

export interface FleetResponse {
  kpis: FleetKPIs;
  vehicles: FleetVehicleRow[];
  dateRange: DateRangeStrings;
}

// ---------------------------------------------------------------------------
// Vehicle detail types
// ---------------------------------------------------------------------------

export interface VehicleSnapshotRow {
  id: string;
  referenceDate: string; // ISO date
  referenceYear: number;
  referenceMonth: number;
  weekOfMonth: number | null;
  status: string;
  driver: string | null;
  contractValue: number;
  amountPaidWeek: number;
  maintenanceByDriverAmount: number;
  lateFeeAmount: number;
  discountAmount: number;
  amountToCharge: number;
  openAmount: number;
  operationalResult: number;
  paymentState: string;
  quality: QualityStatus;
}

export interface VehicleDetailKPIs {
  snapshotCount: number;
  weekCount: number;
  totalRevenueReceived: number;
  totalOperationalCost: number;
  totalAmountToCharge: number;
  totalOpenAmount: number;
  operationalResult: number;
  qualitySummary: Record<QualityStatus, number>;
}

export interface VehicleDetailResponse {
  plate: string;
  model: string | null;
  investor: string | null;
  driver: string | null;
  currentStatus: string;
  kpis: VehicleDetailKPIs;
  snapshots: VehicleSnapshotRow[];
  dateRange: DateRangeStrings;
}

// ---------------------------------------------------------------------------
// V2 extended types
// ---------------------------------------------------------------------------

export interface PeriodComparison {
  current: VehicleDetailKPIs;
  previous: VehicleDetailKPIs | null;
  previousDateRange: DateRangeStrings | null;
  deltas: {
    snapshotCount: number | null;
    totalRevenueReceived: number | null;
    totalOperationalCost: number | null;
    totalAmountToCharge: number | null;
    operationalResult: number | null;
  };
}

export interface WeeklyEvolutionPoint {
  weekLabel: string; // "S1 Jan/26"
  sortKey: string;   // "2026-01-1"
  revenue: number;
  cost: number;
  result: number;
  amountToCharge: number;
  snapshotCount: number;
}

export interface StatusTransition {
  date: string;
  from: string;
  to: string;
}

export interface VehicleDetailV2Response extends VehicleDetailResponse {
  comparison: PeriodComparison;
  weeklyEvolution: WeeklyEvolutionPoint[];
  statusTransitions: StatusTransition[];
  statusTimeline: Array<{ status: string; count: number }>;
  neighbors: { prev: string | null; next: string | null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getQualityStatus(rawJson: unknown): QualityStatus {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return 'UNKNOWN';
  const quality = (rawJson as Record<string, unknown>)['__quality'];
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return 'UNKNOWN';
  const status = (quality as Record<string, unknown>)['status'];
  if (status === 'OK' || status === 'WARNING' || status === 'REVIEW_REQUIRED') return status;
  return 'UNKNOWN';
}

function emptyQuality(): Record<QualityStatus, number> {
  return { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 };
}

/**
 * Status atual do veículo: snapshot mais recente do veículo dentro do período.
 * Se não houver status normalizado, usa o raw. Se nenhum, retorna "Desconhecido".
 */
function deriveCurrentStatus(
  snapshots: Array<{ referenceDate: Date; vehicleStatusNormalized: string | null; vehicleStatusRaw: string | null }>,
): string {
  if (snapshots.length === 0) return 'Desconhecido';
  const sorted = [...snapshots].sort((a, b) => b.referenceDate.getTime() - a.referenceDate.getTime());
  const latest = sorted[0];
  return latest.vehicleStatusNormalized || latest.vehicleStatusRaw || 'Desconhecido';
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getFleetData(
  db: PrismaClient,
  dateRange: DateRangeStrings,
): Promise<FleetResponse> {
  const dateFilter = dateRangeToDbFilter(dateRange);

  const snapshots = await db.operationalSnapshot.findMany({
    where: { referenceDate: dateFilter },
    select: {
      plate: true,
      model: true,
      investorNormalized: true,
      driverNormalized: true,
      vehicleStatusNormalized: true,
      vehicleStatusRaw: true,
      referenceDate: true,
      weekOfMonth: true,
      amountPaidWeek: true,
      maintenanceByDriverAmount: true,
      lateFeeAmount: true,
      discountAmount: true,
      amountToCharge: true,
      openAmount: true,
      rawJson: true,
    },
    orderBy: { referenceDate: 'desc' },
  });

  // Group by plate
  const byPlate = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const arr = byPlate.get(snap.plate) ?? [];
    arr.push(snap);
    byPlate.set(snap.plate, arr);
  }

  // Build vehicle rows
  const vehicles: FleetVehicleRow[] = [];
  const statusCounter = new Map<string, number>();
  let totalRevenue = 0;
  let totalCost = 0;
  let totalToCharge = 0;
  let totalOpen = 0;

  for (const [plate, plateSnaps] of byPlate) {
    const currentStatus = deriveCurrentStatus(plateSnaps);
    statusCounter.set(currentStatus, (statusCounter.get(currentStatus) ?? 0) + 1);

    // Latest snapshot for investor/model/driver
    const latest = plateSnaps[0]; // already sorted desc

    // Unique weeks
    const weekSet = new Set<string>();
    let revenue = 0;
    let cost = 0;
    let charge = 0;
    let open = 0;
    const quality = emptyQuality();

    for (const s of plateSnaps) {
      const weekKey = `${s.referenceDate.getFullYear()}-${s.referenceDate.getMonth()}-${s.weekOfMonth ?? 0}`;
      weekSet.add(weekKey);

      revenue += toNumber(s.amountPaidWeek);
      cost += toNumber(s.maintenanceByDriverAmount) + toNumber(s.lateFeeAmount) + toNumber(s.discountAmount);
      charge += toNumber(s.amountToCharge);
      open += toNumber(s.openAmount);

      const q = getQualityStatus(s.rawJson);
      quality[q]++;
    }

    const row: FleetVehicleRow = {
      plate,
      model: latest.model ?? null,
      investor: latest.investorNormalized ?? null,
      driver: latest.driverNormalized ?? null,
      currentStatus,
      snapshotCount: plateSnaps.length,
      revenueReceived: round2(revenue),
      operationalCost: round2(cost),
      amountToCharge: round2(charge),
      openAmount: round2(open),
      operationalResult: round2(revenue - cost),
      weekCount: weekSet.size,
      qualitySummary: quality,
    };
    vehicles.push(row);

    totalRevenue += revenue;
    totalCost += cost;
    totalToCharge += charge;
    totalOpen += open;
  }

  // Sort by plate
  vehicles.sort((a, b) => a.plate.localeCompare(b.plate));

  // Status distribution sorted by count desc
  const statusDistribution: FleetStatusCount[] = Array.from(statusCounter.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const kpis: FleetKPIs = {
    totalVehicles: byPlate.size,
    totalSnapshots: snapshots.length,
    operationalRevenueReceived: round2(totalRevenue),
    operationalCost: round2(totalCost),
    amountToCharge: round2(totalToCharge),
    openAmount: round2(totalOpen),
    operationalResult: round2(totalRevenue - totalCost),
    statusDistribution,
  };

  return { kpis, vehicles, dateRange };
}

// ---------------------------------------------------------------------------
// Vehicle detail query
// ---------------------------------------------------------------------------

export async function getVehicleDetail(
  db: PrismaClient,
  plate: string,
  dateRange: DateRangeStrings,
): Promise<VehicleDetailResponse | null> {
  const dateFilter = dateRangeToDbFilter(dateRange);

  const snapshots = await db.operationalSnapshot.findMany({
    where: { plate, referenceDate: dateFilter },
    select: {
      id: true,
      referenceDate: true,
      referenceYear: true,
      referenceMonth: true,
      weekOfMonth: true,
      model: true,
      investorNormalized: true,
      driverNormalized: true,
      vehicleStatusNormalized: true,
      vehicleStatusRaw: true,
      contractValue: true,
      amountPaidWeek: true,
      maintenanceByDriverAmount: true,
      lateFeeAmount: true,
      discountAmount: true,
      amountToCharge: true,
      openAmount: true,
      paymentState: true,
      rawJson: true,
    },
    orderBy: { referenceDate: 'asc' },
  });

  if (snapshots.length === 0) return null;

  // Latest snapshot for header info (most recent)
  const latest = [...snapshots].sort((a, b) => b.referenceDate.getTime() - a.referenceDate.getTime())[0];
  const currentStatus = latest.vehicleStatusNormalized || latest.vehicleStatusRaw || 'Desconhecido';

  const weekSet = new Set<string>();
  let totalRevenue = 0;
  let totalCost = 0;
  let totalCharge = 0;
  let totalOpen = 0;
  const quality = emptyQuality();

  const rows: VehicleSnapshotRow[] = snapshots.map((s) => {
    const revenue = toNumber(s.amountPaidWeek);
    const maintenance = toNumber(s.maintenanceByDriverAmount);
    const lateFee = toNumber(s.lateFeeAmount);
    const discount = toNumber(s.discountAmount);
    const cost = maintenance + lateFee + discount;
    const charge = toNumber(s.amountToCharge);
    const open = toNumber(s.openAmount);
    const q = getQualityStatus(s.rawJson);

    totalRevenue += revenue;
    totalCost += cost;
    totalCharge += charge;
    totalOpen += open;
    quality[q]++;

    const weekKey = `${s.referenceDate.getFullYear()}-${s.referenceDate.getMonth()}-${s.weekOfMonth ?? 0}`;
    weekSet.add(weekKey);

    return {
      id: s.id,
      referenceDate: s.referenceDate.toISOString().split('T')[0],
      referenceYear: s.referenceYear,
      referenceMonth: s.referenceMonth,
      weekOfMonth: s.weekOfMonth,
      status: s.vehicleStatusNormalized || s.vehicleStatusRaw || 'Desconhecido',
      driver: s.driverNormalized ?? null,
      contractValue: round2(toNumber(s.contractValue)),
      amountPaidWeek: round2(revenue),
      maintenanceByDriverAmount: round2(maintenance),
      lateFeeAmount: round2(lateFee),
      discountAmount: round2(discount),
      amountToCharge: round2(charge),
      openAmount: round2(open),
      operationalResult: round2(revenue - cost),
      paymentState: s.paymentState,
      quality: q,
    };
  });

  return {
    plate,
    model: latest.model ?? null,
    investor: latest.investorNormalized ?? null,
    driver: latest.driverNormalized ?? null,
    currentStatus,
    kpis: {
      snapshotCount: snapshots.length,
      weekCount: weekSet.size,
      totalRevenueReceived: round2(totalRevenue),
      totalOperationalCost: round2(totalCost),
      totalAmountToCharge: round2(totalCharge),
      totalOpenAmount: round2(totalOpen),
      operationalResult: round2(totalRevenue - totalCost),
      qualitySummary: quality,
    },
    snapshots: rows,
    dateRange,
  };
}

// ---------------------------------------------------------------------------
// V2 vehicle detail — enriched analytics
// ---------------------------------------------------------------------------

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function computePreviousRange(dateRange: DateRangeStrings): DateRangeStrings {
  const from = new Date(dateRange.from + 'T12:00:00');
  const to = new Date(dateRange.to + 'T12:00:00');
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86_400_000); // day before 'from'
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

function buildKPIsFromSnapshots(
  snaps: Array<{
    referenceDate: Date;
    weekOfMonth: number | null;
    amountPaidWeek: unknown;
    maintenanceByDriverAmount: unknown;
    lateFeeAmount: unknown;
    discountAmount: unknown;
    amountToCharge: unknown;
    openAmount: unknown;
    rawJson: unknown;
  }>,
): VehicleDetailKPIs {
  const weekSet = new Set<string>();
  let totalRevenue = 0;
  let totalCost = 0;
  let totalCharge = 0;
  let totalOpen = 0;
  const quality = emptyQuality();

  for (const s of snaps) {
    const revenue = toNumber(s.amountPaidWeek);
    const cost = toNumber(s.maintenanceByDriverAmount) + toNumber(s.lateFeeAmount) + toNumber(s.discountAmount);
    totalRevenue += revenue;
    totalCost += cost;
    totalCharge += toNumber(s.amountToCharge);
    totalOpen += toNumber(s.openAmount);
    quality[getQualityStatus(s.rawJson)]++;
    const weekKey = `${s.referenceDate.getFullYear()}-${s.referenceDate.getMonth()}-${s.weekOfMonth ?? 0}`;
    weekSet.add(weekKey);
  }

  return {
    snapshotCount: snaps.length,
    weekCount: weekSet.size,
    totalRevenueReceived: round2(totalRevenue),
    totalOperationalCost: round2(totalCost),
    totalAmountToCharge: round2(totalCharge),
    totalOpenAmount: round2(totalOpen),
    operationalResult: round2(totalRevenue - totalCost),
    qualitySummary: quality,
  };
}

export async function getVehicleDetailV2(
  db: PrismaClient,
  plate: string,
  dateRange: DateRangeStrings,
): Promise<VehicleDetailV2Response | null> {
  // 1. Get base V1 data
  const base = await getVehicleDetail(db, plate, dateRange);
  if (!base) return null;

  // 2. Previous period comparison
  const prevRange = computePreviousRange(dateRange);
  const prevDateFilter = dateRangeToDbFilter(prevRange);
  const prevSnaps = await db.operationalSnapshot.findMany({
    where: { plate, referenceDate: prevDateFilter },
    select: {
      referenceDate: true,
      weekOfMonth: true,
      amountPaidWeek: true,
      maintenanceByDriverAmount: true,
      lateFeeAmount: true,
      discountAmount: true,
      amountToCharge: true,
      openAmount: true,
      rawJson: true,
    },
  });

  const prevKPIs = prevSnaps.length > 0 ? buildKPIsFromSnapshots(prevSnaps) : null;
  const deltas = prevKPIs
    ? {
        snapshotCount: base.kpis.snapshotCount - prevKPIs.snapshotCount,
        totalRevenueReceived: round2(base.kpis.totalRevenueReceived - prevKPIs.totalRevenueReceived),
        totalOperationalCost: round2(base.kpis.totalOperationalCost - prevKPIs.totalOperationalCost),
        totalAmountToCharge: round2(base.kpis.totalAmountToCharge - prevKPIs.totalAmountToCharge),
        operationalResult: round2(base.kpis.operationalResult - prevKPIs.operationalResult),
      }
    : { snapshotCount: null, totalRevenueReceived: null, totalOperationalCost: null, totalAmountToCharge: null, operationalResult: null };

  const comparison: PeriodComparison = {
    current: base.kpis,
    previous: prevKPIs,
    previousDateRange: prevKPIs ? prevRange : null,
    deltas,
  };

  // 3. Weekly evolution
  const weeklyMap = new Map<string, WeeklyEvolutionPoint>();
  for (const s of base.snapshots) {
    const week = s.weekOfMonth ?? 1;
    const monthIdx = s.referenceMonth - 1;
    const yr = String(s.referenceYear).slice(-2);
    const sortKey = `${s.referenceYear}-${String(s.referenceMonth).padStart(2, '0')}-${week}`;
    const label = `S${week} ${MONTH_ABBR[monthIdx]}/${yr}`;
    const existing = weeklyMap.get(sortKey);
    if (existing) {
      existing.revenue += s.amountPaidWeek;
      existing.cost += s.maintenanceByDriverAmount + s.lateFeeAmount + s.discountAmount;
      existing.result += s.operationalResult;
      existing.amountToCharge += s.amountToCharge;
      existing.snapshotCount += 1;
    } else {
      weeklyMap.set(sortKey, {
        weekLabel: label,
        sortKey,
        revenue: s.amountPaidWeek,
        cost: s.maintenanceByDriverAmount + s.lateFeeAmount + s.discountAmount,
        result: s.operationalResult,
        amountToCharge: s.amountToCharge,
        snapshotCount: 1,
      });
    }
  }
  const weeklyEvolution = Array.from(weeklyMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((p) => ({ ...p, revenue: round2(p.revenue), cost: round2(p.cost), result: round2(p.result), amountToCharge: round2(p.amountToCharge) }));

  // 4. Status transitions
  const statusTransitions: StatusTransition[] = [];
  const statusTimeline = new Map<string, number>();
  let prevStatus = '';
  for (const s of base.snapshots) {
    statusTimeline.set(s.status, (statusTimeline.get(s.status) ?? 0) + 1);
    if (s.status !== prevStatus && prevStatus !== '') {
      statusTransitions.push({ date: s.referenceDate, from: prevStatus, to: s.status });
    }
    prevStatus = s.status;
  }
  const statusTimelineSorted = Array.from(statusTimeline.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // 5. Neighbor plates (prev/next in sorted list for the period)
  const allPlates = await db.operationalSnapshot.findMany({
    where: { referenceDate: dateRangeToDbFilter(dateRange) },
    select: { plate: true },
    distinct: ['plate'],
    orderBy: { plate: 'asc' },
  });
  const plateList = allPlates.map((p) => p.plate);
  const currentIdx = plateList.indexOf(plate);
  const neighbors = {
    prev: currentIdx > 0 ? plateList[currentIdx - 1] : null,
    next: currentIdx >= 0 && currentIdx < plateList.length - 1 ? plateList[currentIdx + 1] : null,
  };

  return {
    ...base,
    comparison,
    weeklyEvolution,
    statusTransitions,
    statusTimeline: statusTimelineSorted,
    neighbors,
  };
}
