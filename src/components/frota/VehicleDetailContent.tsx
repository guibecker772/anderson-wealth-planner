'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  Hash,
  Loader2,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { parseDateRangeFromParams } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import type {
  VehicleDetailV2Response,
  VehicleSnapshotRow,
  PeriodComparison,
  WeeklyEvolutionPoint,
  StatusTransition,
} from '@/lib/analytics/fleet-metrics';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
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

function getQualityVariant(q: string): 'success' | 'warning' | 'error' | 'secondary' {
  if (q === 'OK') return 'success';
  if (q === 'WARNING') return 'warning';
  if (q === 'REVIEW_REQUIRED') return 'error';
  return 'secondary';
}

function getPaymentLabel(state: string): string {
  const map: Record<string, string> = { PAID: 'Pago', PARTIAL: 'Parcial', UNPAID: 'Não pago', OVERPAID: 'Excedente', UNKNOWN: '—' };
  return map[state] ?? state;
}

function getPaymentVariant(state: string): 'success' | 'warning' | 'error' | 'info' | 'secondary' {
  if (state === 'PAID') return 'success';
  if (state === 'PARTIAL') return 'warning';
  if (state === 'UNPAID') return 'error';
  if (state === 'OVERPAID') return 'info';
  return 'secondary';
}

// ---------------------------------------------------------------------------
// Snapshot filter
// ---------------------------------------------------------------------------

type SnapshotFilter = 'all' | 'alerts' | 'unpaid' | 'status-change';

function filterSnapshots(snapshots: VehicleSnapshotRow[], filter: SnapshotFilter, search: string): VehicleSnapshotRow[] {
  let result = snapshots;
  if (filter === 'alerts') result = result.filter((s) => s.quality === 'WARNING' || s.quality === 'REVIEW_REQUIRED');
  if (filter === 'unpaid') result = result.filter((s) => s.paymentState === 'UNPAID' || s.paymentState === 'PARTIAL');
  if (filter === 'status-change') {
    const statusChangeIds = new Set<string>();
    let prev = '';
    for (const s of snapshots) {
      if (prev !== '' && s.status !== prev) statusChangeIds.add(s.id);
      prev = s.status;
    }
    result = result.filter((s) => statusChangeIds.has(s.id));
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((s) => (s.driver ?? '').toLowerCase().includes(q) || s.status.toLowerCase().includes(q) || s.referenceDate.includes(q));
  }
  return result;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportSnapshotsCSV(snapshots: VehicleSnapshotRow[], plate: string, dateFrom: string, dateTo: string) {
  const BOM = '\uFEFF';
  const headers = ['Data', 'Semana', 'Status', 'Motorista', 'Contrato', 'Recebido', 'Manutenção', 'Multa/Atraso', 'A cobrar', 'Em aberto', 'Resultado', 'Pagamento', 'Qualidade'];
  const rows = snapshots.map((s) => [
    s.referenceDate,
    String(s.weekOfMonth ?? ''),
    s.status,
    s.driver ?? '',
    s.contractValue.toFixed(2),
    s.amountPaidWeek.toFixed(2),
    s.maintenanceByDriverAmount.toFixed(2),
    s.lateFeeAmount.toFixed(2),
    s.amountToCharge.toFixed(2),
    s.openAmount.toFixed(2),
    s.operationalResult.toFixed(2),
    s.paymentState,
    s.quality,
  ]);
  const csvContent = BOM + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${plate}_snapshots_${dateFrom}_${dateTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VehicleDetailContent({ plate }: { plate: string }) {
  const searchParams = useSearchParams();
  const dateRange = parseDateRangeFromParams(searchParams);

  const [data, setData] = useState<VehicleDetailV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>('all');
  const [snapshotSearch, setSnapshotSearch] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
        const res = await fetch(`/api/frota/${encodeURIComponent(plate)}?${params.toString()}`);
        if (res.status === 404) {
          setData(null);
          setError('Veículo não encontrado no período selecionado.');
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar dados do veículo');
        const json: VehicleDetailV2Response = await res.json();
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [plate, dateRange.from, dateRange.to]);

  const buildHref = (targetPlate: string) => {
    const p = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    return `/frota/${encodeURIComponent(targetPlate)}?${p.toString()}`;
  };

  const backHref = useMemo(() => {
    const p = new URLSearchParams();
    if (dateRange.from) p.set('from', dateRange.from);
    if (dateRange.to) p.set('to', dateRange.to);
    const qs = p.toString();
    return `/frota${qs ? `?${qs}` : ''}`;
  }, [dateRange.from, dateRange.to]);

  const filteredSnapshots = useMemo(
    () => (data ? filterSnapshots(data.snapshots, snapshotFilter, snapshotSearch) : []),
    [data, snapshotFilter, snapshotSearch],
  );

  // Loading state
  if (loading) {
    return <div className="premium-empty h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // Error / not found
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#022D44]/70 hover:text-[#022D44] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para frota
        </Link>
        <div className="premium-empty h-[300px]">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-base font-medium text-slate-700">{error || 'Veículo não encontrado'}</p>
          <p className="text-sm text-slate-500">Tente selecionar outro período no filtro de data.</p>
        </div>
      </div>
    );
  }

  const { kpis, snapshots, comparison, weeklyEvolution, statusTransitions, statusTimeline, neighbors } = data;
  const alertCount = kpis.qualitySummary.WARNING + kpis.qualitySummary.REVIEW_REQUIRED;

  return (
    <div className="space-y-6">
      {/* ── Navigation bar ── */}
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#022D44]/70 hover:text-[#022D44] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para frota
        </Link>
        <div className="flex items-center gap-2">
          {neighbors.prev ? (
            <Link href={buildHref(neighbors.prev)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" /> {neighbors.prev}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-300">
              <ChevronLeft className="h-3.5 w-3.5" /> —
            </span>
          )}
          {neighbors.next ? (
            <Link href={buildHref(neighbors.next)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
              {neighbors.next} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-300">
              — <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* ── Vehicle header ── */}
      <div className="glass-panel px-6 py-5">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <Car className="h-3.5 w-3.5" />
              Detalhe do veículo
            </div>

            <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-slate-900 font-mono">
              {data.plate}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {data.model && <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5 text-slate-400" />{data.model}</span>}
              {data.investor && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" />{data.investor}</span>}
              {data.driver && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" />{data.driver}</span>}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Badge variant={getStatusVariant(data.currentStatus)} size="sm">{data.currentStatus}</Badge>
              {alertCount > 0 && <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge>}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <DateRangeBadge from={dateRange.from} to={dateRange.to} />
          </div>
        </div>
      </div>

      {/* ── 1. Quality summary ── */}
      <QualitySummaryBlock quality={kpis.qualitySummary} total={kpis.snapshotCount} />

      {/* ── 2. KPIs with comparison ── */}
      <ComparisonKPIs comparison={comparison} />

      {/* ── 3. Weekly evolution chart ── */}
      {weeklyEvolution.length > 1 && <WeeklyEvolutionChart data={weeklyEvolution} />}

      {/* ── 4. Status timeline ── */}
      <StatusBlock timeline={statusTimeline} transitions={statusTransitions} />

      {/* ── 5. Snapshot history with filters ── */}
      <div className="data-table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Histórico de snapshots</h2>
              <p className="mt-1 text-sm text-slate-500">Cada registro da planilha operacional no período.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{filteredSnapshots.length} de {snapshots.length}</Badge>
            <button
              type="button"
              onClick={() => exportSnapshotsCSV(filteredSnapshots, plate, dateRange.from, dateRange.to)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Snapshot filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/70 px-6 py-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="h-4 w-4" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Motorista, status, data…"
              value={snapshotSearch}
              onChange={(e) => setSnapshotSearch(e.target.value)}
              className="h-8 w-52 rounded-full border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"
            />
          </div>
          {(['all', 'alerts', 'unpaid', 'status-change'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSnapshotFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                snapshotFilter === f
                  ? 'border-[#022D44]/20 bg-[#022D44] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {{ all: 'Todos', alerts: 'Alertas', unpaid: 'Não pagos', 'status-change': 'Mudança de status' }[f]}
            </button>
          ))}
          {(snapshotFilter !== 'all' || snapshotSearch) && (
            <button type="button" onClick={() => { setSnapshotFilter('all'); setSnapshotSearch(''); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Data</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Sem.</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Status</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Motorista</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Contrato</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Recebido</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Manutenção</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Multa/Atraso</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">A cobrar</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Em aberto</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Resultado</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Pgto</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Qualidade</th>
              </tr>
            </thead>
            <tbody>
              {filteredSnapshots.map((s, i) => {
                const prevSnap = i > 0 ? filteredSnapshots[i - 1] : null;
                const statusChanged = prevSnap ? s.status !== prevSnap.status : false;
                const isUnpaid = s.paymentState === 'UNPAID' || s.paymentState === 'PARTIAL';
                const hasAlert = s.quality === 'WARNING' || s.quality === 'REVIEW_REQUIRED';
                const highlight = statusChanged || isUnpaid || hasAlert;
                return (
                  <tr key={s.id} className={`border-t transition-colors hover:bg-slate-50/70 ${highlight ? 'border-l-2 border-l-amber-400 bg-amber-50/30' : 'border-slate-200/70'}`}>
                    <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">{formatDate(s.referenceDate)}</td>
                    <td className="table-number px-6 py-3.5">{s.weekOfMonth ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      <Badge variant={getStatusVariant(s.status)} size="sm">{s.status}</Badge>
                      {statusChanged && <span className="ml-1 text-[10px] text-amber-600">●</span>}
                    </td>
                    <td className="max-w-[140px] truncate px-6 py-3.5 text-slate-700" title={s.driver ?? undefined}>{s.driver || '—'}</td>
                    <td className="table-number px-6 py-3.5 text-slate-700">{formatCurrencyFull(s.contractValue)}</td>
                    <td className="table-number px-6 py-3.5 value-income">{formatCurrencyFull(s.amountPaidWeek)}</td>
                    <td className="table-number px-6 py-3.5 value-expense">{formatCurrencyFull(s.maintenanceByDriverAmount)}</td>
                    <td className="table-number px-6 py-3.5 value-expense">{formatCurrencyFull(s.lateFeeAmount)}</td>
                    <td className="table-number px-6 py-3.5 font-medium text-amber-700">{formatCurrencyFull(s.amountToCharge)}</td>
                    <td className="table-number px-6 py-3.5 font-medium text-amber-700">{formatCurrencyFull(s.openAmount)}</td>
                    <td className={`table-number px-6 py-3.5 font-medium ${s.operationalResult >= 0 ? 'value-income' : 'value-expense'}`}>
                      {formatCurrencyFull(s.operationalResult)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={getPaymentVariant(s.paymentState)} size="sm">{getPaymentLabel(s.paymentState)}</Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={getQualityVariant(s.quality)} size="sm">{s.quality === 'REVIEW_REQUIRED' ? 'Revisão' : s.quality}</Badge>
                    </td>
                  </tr>
                );
              })}
              {filteredSnapshots.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-6 py-10 text-center text-slate-500">
                    {snapshotFilter !== 'all' || snapshotSearch ? 'Nenhum snapshot corresponde ao filtro.' : 'Nenhum snapshot encontrado no período.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Quality summary block
// ---------------------------------------------------------------------------

function QualitySummaryBlock({ quality, total }: { quality: Record<string, number>; total: number }) {
  const ok = quality.OK ?? 0;
  const warn = quality.WARNING ?? 0;
  const review = quality.REVIEW_REQUIRED ?? 0;
  const unknown = quality.UNKNOWN ?? 0;
  const issues = warn + review;
  const overallStatus = issues === 0 ? 'OK' : review > 0 ? 'Requer atenção' : 'Atenção parcial';
  const overallVariant = issues === 0 ? 'success' : review > 0 ? 'error' : 'warning';

  return (
    <div className="glass-panel px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheck className="h-5 w-5 text-slate-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Qualidade operacional</h3>
        <Badge variant={overallVariant} size="sm">{overallStatus}</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        <QualityChip label="OK" count={ok} variant="success" />
        <QualityChip label="Alerta" count={warn} variant="warning" />
        <QualityChip label="Requer revisão" count={review} variant="error" />
        {unknown > 0 && <QualityChip label="Sem info" count={unknown} variant="secondary" />}
        <span className="ml-auto text-xs text-slate-500 self-center">{total} snapshot(s) analisados</span>
      </div>
    </div>
  );
}

function QualityChip({ label, count, variant }: { label: string; count: number; variant: 'success' | 'warning' | 'error' | 'secondary' }) {
  const colors = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    secondary: 'border-slate-200 bg-slate-50 text-slate-600',
  }[variant];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${colors}`}>
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${variant === 'success' ? 'bg-emerald-100' : variant === 'warning' ? 'bg-amber-100' : variant === 'error' ? 'bg-red-100' : 'bg-slate-100'}`}>
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Comparison KPIs
// ---------------------------------------------------------------------------

function ComparisonKPIs({ comparison }: { comparison: PeriodComparison }) {
  const { current, previous, deltas, previousDateRange } = comparison;
  const hasPrevious = previous !== null;

  return (
    <div className="space-y-2">
      <div className="kpi-auto-grid">
        <ComparisonCard title="Snapshots" current={String(current.snapshotCount)} previous={hasPrevious ? String(previous!.snapshotCount) : null} deltaRaw={deltas.snapshotCount} isCount icon={<Hash className="h-5 w-5" />} tone="slate" />
        <ComparisonCard title="Semanas" current={String(current.weekCount)} previous={hasPrevious ? String(previous!.weekCount) : null} deltaRaw={null} isCount icon={<Calendar className="h-5 w-5" />} tone="blue" />
        <ComparisonCard title="Receita operacional" current={formatCurrency(current.totalRevenueReceived)} previous={hasPrevious ? formatCurrency(previous!.totalRevenueReceived) : null} deltaRaw={deltas.totalRevenueReceived} positiveIsGood icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <ComparisonCard title="Custo operacional" current={formatCurrency(current.totalOperationalCost)} previous={hasPrevious ? formatCurrency(previous!.totalOperationalCost) : null} deltaRaw={deltas.totalOperationalCost} positiveIsGood={false} icon={<TrendingDown className="h-5 w-5" />} tone="red" />
        <ComparisonCard title="Valor a cobrar" current={formatCurrency(current.totalAmountToCharge)} previous={hasPrevious ? formatCurrency(previous!.totalAmountToCharge) : null} deltaRaw={deltas.totalAmountToCharge} icon={<DollarSign className="h-5 w-5" />} tone="amber" />
        <ComparisonCard title="Resultado operacional" current={formatCurrency(current.operationalResult)} previous={hasPrevious ? formatCurrency(previous!.operationalResult) : null} deltaRaw={deltas.operationalResult} positiveIsGood icon={<DollarSign className="h-5 w-5" />} tone={current.operationalResult >= 0 ? 'emerald' : 'red'} />
      </div>
      {!hasPrevious && (
        <p className="text-xs text-slate-400 italic px-1">Sem dados no período anterior equivalente para comparação.</p>
      )}
      {hasPrevious && previousDateRange && (
        <p className="text-xs text-slate-400 italic px-1">Comparado com {formatDate(previousDateRange.from)} – {formatDate(previousDateRange.to)}</p>
      )}
    </div>
  );
}

function ComparisonCard({ title, current, previous, deltaRaw, positiveIsGood, isCount, icon, tone }: {
  title: string; current: string; previous: string | null; deltaRaw: number | null; positiveIsGood?: boolean; isCount?: boolean; icon: ReactNode; tone: 'emerald' | 'red' | 'amber' | 'blue' | 'slate';
}) {
  const toneClass = {
    emerald: 'from-emerald-500/12 to-white text-emerald-700',
    red: 'from-red-500/12 to-white text-red-700',
    amber: 'from-amber-500/12 to-white text-amber-700',
    blue: 'from-[#022D44]/12 to-white text-[#022D44]',
    slate: 'from-slate-200/40 to-white text-slate-700',
  }[tone];

  let deltaText = '';
  let deltaColor = 'text-slate-400';
  if (deltaRaw !== null) {
    const prefix = deltaRaw > 0 ? '+' : '';
    deltaText = isCount ? `${prefix}${deltaRaw}` : formatDelta(deltaRaw);
    if (positiveIsGood !== undefined) {
      const good = positiveIsGood ? deltaRaw > 0 : deltaRaw < 0;
      const bad = positiveIsGood ? deltaRaw < 0 : deltaRaw > 0;
      deltaColor = good ? 'delta-positive' : bad ? 'delta-negative' : 'text-slate-400';
    }
  }

  return (
    <div className={`card-premium bg-gradient-to-br ${toneClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="metric-value-fluid mt-3 text-slate-900">{current}</p>
          {previous !== null && (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Anterior: {previous}</span>
              {deltaText && <span className={`font-medium ${deltaColor}`}>{deltaText}</span>}
            </div>
          )}
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Weekly evolution chart
// ---------------------------------------------------------------------------

function WeeklyEvolutionChart({ data }: { data: WeeklyEvolutionPoint[] }) {
  return (
    <div className="glass-panel px-6 py-5">
      <div className="mb-4 flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-slate-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Evolução semanal</h3>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="revenue" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cost" name="Custo" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="result" name="Resultado" fill="#022D44" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Status block (timeline + transitions)
// ---------------------------------------------------------------------------

function StatusBlock({ timeline, transitions }: { timeline: Array<{ status: string; count: number }>; transitions: StatusTransition[] }) {
  return (
    <div className="glass-panel px-6 py-5">
      <div className="mb-4 flex items-center gap-3">
        <Car className="h-5 w-5 text-slate-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Trajetória operacional</h3>
      </div>

      {/* Status distribution */}
      <div className="flex flex-wrap gap-2 mb-4">
        {timeline.map((s) => (
          <div key={s.status} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
            <Badge variant={getStatusVariant(s.status)} size="sm">{s.status}</Badge>
            <span className="text-slate-500">{s.count}×</span>
          </div>
        ))}
      </div>

      {/* Transitions */}
      {transitions.length > 0 ? (
        <div className="space-y-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Mudanças de status</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {transitions.map((t, i) => (
              <div key={i} className="inline-flex items-center gap-1 text-xs">
                {i === 0 && <Badge variant={getStatusVariant(t.from)} size="sm">{t.from}</Badge>}
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <Badge variant={getStatusVariant(t.to)} size="sm">{t.to}</Badge>
                <span className="text-[10px] text-slate-400 ml-0.5">{formatDate(t.date)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Sem mudanças de status no período — veículo estável.</p>
      )}
    </div>
  );
}
