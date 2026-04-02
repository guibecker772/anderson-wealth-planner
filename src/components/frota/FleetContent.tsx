'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpDown,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  Download,
  Filter,
  Hash,
  Loader2,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react';
import { parseDateRangeFromParams } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import type { FleetResponse, FleetVehicleRow } from '@/lib/analytics/fleet-metrics';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface Filters {
  search: string; // plate / model / investor / driver
  status: string; // '' = all
  investor: string;
  onlyAlerts: boolean;
  onlyOpenAmount: boolean;
}

const EMPTY_FILTERS: Filters = { search: '', status: '', investor: '', onlyAlerts: false, onlyOpenAmount: false };

function applyFilters(vehicles: FleetVehicleRow[], f: Filters): FleetVehicleRow[] {
  let result = vehicles;

  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        (v.model ?? '').toLowerCase().includes(q) ||
        (v.investor ?? '').toLowerCase().includes(q) ||
        (v.driver ?? '').toLowerCase().includes(q),
    );
  }
  if (f.status) {
    result = result.filter((v) => v.currentStatus === f.status);
  }
  if (f.investor) {
    result = result.filter((v) => v.investor === f.investor);
  }
  if (f.onlyAlerts) {
    result = result.filter((v) => v.qualitySummary.WARNING > 0 || v.qualitySummary.REVIEW_REQUIRED > 0);
  }
  if (f.onlyOpenAmount) {
    result = result.filter((v) => v.openAmount > 0);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortKey = 'plate' | 'investor' | 'currentStatus' | 'snapshotCount' | 'revenueReceived' | 'operationalCost' | 'amountToCharge' | 'operationalResult' | 'quality';
type SortDir = 'asc' | 'desc';

const SORT_KEYS = new Set<string>(['plate', 'investor', 'currentStatus', 'snapshotCount', 'revenueReceived', 'operationalCost', 'amountToCharge', 'operationalResult', 'quality']);

function applySorting(vehicles: FleetVehicleRow[], key: SortKey, dir: SortDir): FleetVehicleRow[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...vehicles].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'plate': cmp = a.plate.localeCompare(b.plate); break;
      case 'investor': cmp = (a.investor ?? '').localeCompare(b.investor ?? ''); break;
      case 'currentStatus': cmp = a.currentStatus.localeCompare(b.currentStatus); break;
      case 'snapshotCount': cmp = a.snapshotCount - b.snapshotCount; break;
      case 'revenueReceived': cmp = a.revenueReceived - b.revenueReceived; break;
      case 'operationalCost': cmp = a.operationalCost - b.operationalCost; break;
      case 'amountToCharge': cmp = a.amountToCharge - b.amountToCharge; break;
      case 'operationalResult': cmp = a.operationalResult - b.operationalResult; break;
      case 'quality': {
        const aAlerts = a.qualitySummary.WARNING + a.qualitySummary.REVIEW_REQUIRED;
        const bAlerts = b.qualitySummary.WARNING + b.qualitySummary.REVIEW_REQUIRED;
        cmp = aAlerts - bAlerts;
        break;
      }
    }
    return cmp * mult;
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportFleetCSV(vehicles: FleetVehicleRow[], dateFrom: string, dateTo: string) {
  const BOM = '\uFEFF';
  const headers = ['Placa', 'Modelo', 'Investidor', 'Motorista', 'Status', 'Snapshots', 'Recebido', 'Custos', 'A cobrar', 'Resultado', 'Qualidade'];
  const rows = vehicles.map((v) => {
    const alertCount = v.qualitySummary.WARNING + v.qualitySummary.REVIEW_REQUIRED;
    return [
      v.plate,
      v.model ?? '',
      v.investor ?? '',
      v.driver ?? '',
      v.currentStatus,
      String(v.snapshotCount),
      v.revenueReceived.toFixed(2),
      v.operationalCost.toFixed(2),
      v.amountToCharge.toFixed(2),
      v.operationalResult.toFixed(2),
      alertCount > 0 ? `${alertCount} alerta(s)` : 'OK',
    ];
  });

  const csvContent = BOM + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `frota_${dateFrom}_${dateTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FleetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateRange = parseDateRangeFromParams(searchParams);

  const [data, setData] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL-initialised state
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    investor: searchParams.get('investor') || '',
    onlyAlerts: searchParams.get('alerts') === '1',
    onlyOpenAmount: searchParams.get('open') === '1',
  }));
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = searchParams.get('sort');
    return v && SORT_KEYS.has(v) ? (v as SortKey) : 'plate';
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => (searchParams.get('dir') === 'desc' ? 'desc' : 'asc'));
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [pageSize, setPageSize] = useState<number>(() => {
    const v = Number(searchParams.get('size'));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(v) ? v : 25;
  });

  // Sync state → URL (debounced to avoid lag on search typing)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.investor) params.set('investor', filters.investor);
      if (filters.onlyAlerts) params.set('alerts', '1');
      if (filters.onlyOpenAmount) params.set('open', '1');
      if (sortKey !== 'plate') params.set('sort', sortKey);
      if (sortDir !== 'asc') params.set('dir', sortDir);
      if (page > 1) params.set('page', String(page));
      if (pageSize !== 25) params.set('size', String(pageSize));
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 300);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [filters, sortKey, sortDir, page, pageSize, dateRange.from, dateRange.to, router]);

  // Reset page on filter/sort changes (skip first render to preserve URL-initialised page)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
  }, [filters, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
        const res = await fetch(`/api/frota?${params.toString()}`);
        if (!res.ok) throw new Error('Falha ao carregar dados da frota');
        const json: FleetResponse = await res.json();
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange.from, dateRange.to]);

  // Derived lists for filters
  const investorOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const v of data.vehicles) {
      if (v.investor) set.add(v.investor);
    }
    return Array.from(set).sort();
  }, [data]);

  const filteredVehicles = useMemo(() => (data ? applyFilters(data.vehicles, filters) : []), [data, filters]);
  const sortedVehicles = useMemo(() => applySorting(filteredVehicles, sortKey, sortDir), [filteredVehicles, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedVehicles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedVehicles = sortedVehicles.slice(pageStart, pageStart + pageSize);
  const hasActiveFilters = filters.search || filters.status || filters.investor || filters.onlyAlerts || filters.onlyOpenAmount;

  // Loading / error states
  if (loading) {
    return <div className="premium-empty h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="premium-empty h-[400px]"><AlertTriangle className="h-6 w-6 text-destructive" /><p>{error}</p></div>;
  }
  if (!data) return null;

  const { kpis } = data;
  const isEmpty = kpis.totalVehicles === 0;

  return (
    <div className="space-y-6">
      {/* ── Hero panel ── */}
      <div className="glass-panel px-6 py-5">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <Truck className="h-3.5 w-3.5" />
              Base operacional
            </div>
            <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">
              Frota &amp; Operação
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Leitura operacional por veículo, derivada dos snapshots da planilha.
              O status atual de cada veículo reflete o <strong>snapshot mais recente</strong> dentro do período selecionado.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <DateRangeBadge from={dateRange.from} to={dateRange.to} />
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="premium-empty h-[300px]">
          <Truck className="h-10 w-10 text-slate-300" />
          <p className="text-base font-medium text-slate-700">Nenhum veículo no período</p>
          <p className="text-sm text-slate-500">A base operacional ainda não possui snapshots importados para esse intervalo.</p>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="kpi-auto-grid">
            <KPICard title="Veículos" value={String(kpis.totalVehicles)} icon={<Car className="h-5 w-5" />} tone="blue" />
            <KPICard title="Snapshots" value={String(kpis.totalSnapshots)} icon={<Hash className="h-5 w-5" />} tone="slate" />
            <KPICard title="Receita operacional" value={formatCurrency(kpis.operationalRevenueReceived)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
            <KPICard title="Custo operacional" value={formatCurrency(kpis.operationalCost)} icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <KPICard title="Valor a cobrar" value={formatCurrency(kpis.amountToCharge)} icon={<DollarSign className="h-5 w-5" />} tone="amber" />
            <KPICard title="Resultado operacional" value={formatCurrency(kpis.operationalResult)} icon={<DollarSign className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'emerald' : 'red'} />
          </div>

          {/* ── Status distribution ── */}
          {kpis.statusDistribution.length > 0 && (
            <div className="glass-panel px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Distribuição da frota por status</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {kpis.statusDistribution.map((s) => (
                  <StatusChip
                    key={s.status}
                    status={s.status}
                    count={s.count}
                    active={filters.status === s.status}
                    onClick={() => setFilters((prev) => ({ ...prev, status: prev.status === s.status ? '' : s.status }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Filters ── */}
          <div className="glass-panel px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Filter className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Filtros</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Placa, modelo, investidor ou motorista"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="h-10 w-72 rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"
                />
              </div>

              {/* Investor select */}
              {investorOptions.length > 0 && (
                <select
                  value={filters.investor}
                  onChange={(e) => setFilters((prev) => ({ ...prev, investor: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"
                >
                  <option value="">Todos investidores</option>
                  {investorOptions.map((inv) => (
                    <option key={inv} value={inv}>{inv}</option>
                  ))}
                </select>
              )}

              {/* Toggle filters */}
              <ToggleChip label="Com alerta" active={filters.onlyAlerts} onClick={() => setFilters((p) => ({ ...p, onlyAlerts: !p.onlyAlerts }))} />
              <ToggleChip label="Com valor a cobrar" active={filters.onlyOpenAmount} onClick={() => setFilters((p) => ({ ...p, onlyOpenAmount: !p.onlyOpenAmount }))} />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros
                </button>
              )}

              <span className="ml-auto text-xs text-slate-500">
                {filteredVehicles.length} de {data.vehicles.length} veículo(s)
              </span>
            </div>
          </div>

          {/* ── Vehicle table ── */}
          <div className="data-table-shell">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Detalhamento por veículo</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Status, receita, custo e resultado operacional individual.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{sortedVehicles.length} veículos</Badge>
                <button
                  type="button"
                  onClick={() => exportFleetCSV(sortedVehicles, dateRange.from, dateRange.to)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <SortableHeader label="Placa" sortKey="plate" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Modelo</th>
                    <SortableHeader label="Investidor" sortKey="investor" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Motorista</th>
                    <SortableHeader label="Status" sortKey="currentStatus" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                    <SortableHeader label="Snapshots" sortKey="snapshotCount" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHeader label="Recebido" sortKey="revenueReceived" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHeader label="Custos" sortKey="operationalCost" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHeader label="A cobrar" sortKey="amountToCharge" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHeader label="Resultado" sortKey="operationalResult" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHeader label="Qualidade" sortKey="quality" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedVehicles.map((v) => {
                    const alertCount = v.qualitySummary.WARNING + v.qualitySummary.REVIEW_REQUIRED;
                    return (
                      <tr key={v.plate} className="border-t border-slate-200/70 transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <Link
                            href={`/frota/${encodeURIComponent(v.plate)}?from=${dateRange.from}&to=${dateRange.to}`}
                            className="font-mono font-medium text-[#022D44] underline decoration-[#022D44]/25 underline-offset-2 hover:decoration-[#022D44]/60 transition-colors"
                          >
                            {v.plate}
                          </Link>
                        </td>
                        <td className="max-w-[160px] truncate px-6 py-4 text-slate-700" title={v.model ?? undefined}>{v.model || '—'}</td>
                        <td className="max-w-[160px] truncate px-6 py-4 text-slate-700" title={v.investor ?? undefined}>{v.investor || '—'}</td>
                        <td className="max-w-[140px] truncate px-6 py-4 text-slate-700" title={v.driver ?? undefined}>{v.driver || '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(v.currentStatus)} size="sm">{v.currentStatus}</Badge>
                        </td>
                        <td className="table-number px-6 py-4">{v.snapshotCount}</td>
                        <td className="table-number px-6 py-4 value-income">{formatCurrencyFull(v.revenueReceived)}</td>
                        <td className="table-number px-6 py-4 value-expense">{formatCurrencyFull(v.operationalCost)}</td>
                        <td className="table-number px-6 py-4 font-medium text-amber-700">{formatCurrencyFull(v.amountToCharge)}</td>
                        <td className={`table-number px-6 py-4 font-medium ${v.operationalResult >= 0 ? 'value-income' : 'value-expense'}`}>
                          {formatCurrencyFull(v.operationalResult)}
                        </td>
                        <td className="px-6 py-4">
                          {alertCount > 0 ? (
                            <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge>
                          ) : (
                            <Badge variant="success" size="sm">OK</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedVehicles.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-slate-500">
                        {hasActiveFilters
                          ? 'Nenhum veículo corresponde aos filtros selecionados.'
                          : 'Nenhum veículo encontrado no período.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {sortedVehicles.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Linhas por página</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"
                  >
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-slate-600 font-medium">
                  {pageStart + 1}–{Math.min(pageStart + pageSize, sortedVehicles.length)} de {sortedVehicles.length} veículo(s)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3rem] text-center text-xs font-medium text-slate-700">{safePage} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({ title, value, icon, tone }: { title: string; value: string; icon: ReactNode; tone: 'emerald' | 'red' | 'amber' | 'blue' | 'slate' }) {
  const toneClass = {
    emerald: 'from-emerald-500/12 to-white text-emerald-700',
    red: 'from-red-500/12 to-white text-red-700',
    amber: 'from-amber-500/12 to-white text-amber-700',
    blue: 'from-[#022D44]/12 to-white text-[#022D44]',
    slate: 'from-slate-200/40 to-white text-slate-700',
  }[tone];

  return (
    <div className={`card-premium bg-gradient-to-br ${toneClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="metric-value-fluid mt-3 text-slate-900">{value}</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function StatusChip({ status, count, active, onClick }: { status: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'border-[#022D44]/20 bg-[#022D44] text-white shadow-md'
          : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span>{status}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    </button>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {active ? <ShieldAlert className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort, align = 'left' }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir; onSort: (key: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-6 py-4 font-semibold text-slate-500 select-none cursor-pointer transition-colors hover:text-slate-800 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-[#022D44]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#022D44]" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-300" />
        )}
      </span>
    </th>
  );
}

function getStatusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'secondary' {
  const lower = status.toLowerCase();
  if (lower.includes('locado') || lower.includes('ativo')) return 'success';
  if (lower.includes('oficina') || lower.includes('manuten')) return 'warning';
  if (lower.includes('recolhido') || lower.includes('devolvido')) return 'error';
  if (lower.includes('preparação') || lower.includes('prepara') || lower.includes('chapeca')) return 'info';
  if (lower.includes('disponível') || lower.includes('disponivel')) return 'info';
  return 'secondary';
}
