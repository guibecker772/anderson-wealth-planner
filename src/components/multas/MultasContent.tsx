'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Hash, Loader2, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { parseDateRangeFromParams, formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface SummaryData {
  total: number;
  count: number;
  prevTotal: number;
  deltaValue: number;
  deltaPct: number | null;
}

interface TimeSeriesPoint {
  date: string;
  total: number;
  count: number;
}

interface VehicleRankingItem {
  plate: string;
  total: number;
  count: number;
  aitCodes: string[];
}

interface FineDetailItem {
  id: string;
  date: string;
  plate: string | null;
  aitCode?: string | null;
  amount: number;
  status: string;
  investor: string | null;
  driver: string | null;
  description: string | null;
  counterparty?: string | null;
  qualityStatus?: 'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN';
}

const VEHICLE_COLORS = ['#022D44', '#A8CF4C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatPct(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function MultasContent() {
  const searchParams = useSearchParams();
  const dateRange = parseDateRangeFromParams(searchParams);
  const [sortBy, setSortBy] = useState<'count' | 'value'>('count');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRankingItem[]>([]);
  const [fines, setFines] = useState<FineDetailItem[]>([]);
  const [totalFines, setTotalFines] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const baseParams = new URLSearchParams({ from: dateRange.from, to: dateRange.to, paidBy: 'ALL' });
        const [summaryRes, seriesRes, vehiclesRes, finesRes] = await Promise.all([
          fetch(`/api/multas/summary?${baseParams.toString()}`),
          fetch(`/api/multas/series?${baseParams.toString()}`),
          fetch(`/api/multas/vehicles?${baseParams.toString()}&limit=10&sortBy=${sortBy}`),
          fetch(`/api/multas/list?${baseParams.toString()}&page=1&pageSize=10`),
        ]);
        if (!summaryRes.ok || !seriesRes.ok || !vehiclesRes.ok || !finesRes.ok) throw new Error('Falha ao carregar dados');
        const [summaryData, seriesData, vehiclesData, finesData] = await Promise.all([
          summaryRes.json(),
          seriesRes.json(),
          vehiclesRes.json(),
          finesRes.json(),
        ]);
        setSummary(summaryData);
        setSeries(seriesData.data || []);
        setVehicles(vehiclesData.data || []);
        setFines(finesData.data || []);
        setTotalFines(finesData.total || 0);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange.from, dateRange.to, sortBy]);

  if (loading) {
    return <div className="premium-empty h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return <div className="premium-empty h-[400px]"><AlertTriangle className="h-6 w-6 text-destructive" />{error}</div>;
  }

  const isPositiveDelta = summary?.deltaValue != null && summary.deltaValue >= 0;
  const deltaColor = isPositiveDelta ? 'text-red-600' : 'text-emerald-600';
  const DeltaIcon = isPositiveDelta ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6">
      <div className="glass-panel px-6 py-5">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <Receipt className="h-3.5 w-3.5" />
              FineRecord oficial
            </div>
            <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">Leitura oficial de multas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              A tela agora prioriza a base oficial de multas do workbook, sem depender da coluna operacional de multa/atraso.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Filtro e ordenacao</span>
              <DateRangeBadge from={dateRange.from} to={dateRange.to} />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'count' | 'value')}>
              <SelectTrigger className="mt-3 h-11 rounded-2xl border-slate-200 bg-white shadow-sm text-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Quantidade</SelectItem>
                <SelectItem value="value">Valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total em multas" value={formatCurrencyFull(summary?.total || 0)} tone="amber" icon={<Receipt className="h-5 w-5" />} />
        <MetricCard title="Ocorrencias" value={String(summary?.count || 0)} tone="blue" icon={<Hash className="h-5 w-5" />} />
        <div className="card-premium bg-gradient-to-br from-white via-white to-slate-50/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Variacao</p>
              <div className={`mt-3 flex items-center gap-2 ${deltaColor}`}>
                <DeltaIcon className="h-5 w-5" />
                <span className="break-words text-[clamp(1.5rem,2vw,2.2rem)] font-semibold tracking-[-0.04em] [overflow-wrap:anywhere]">{formatPct(summary?.deltaPct ?? null)}</span>
              </div>
              <p className={`mt-1 text-sm ${deltaColor}`}>{formatCurrency(summary?.deltaValue || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartShell title="Evolucao das multas" subtitle={`${formatDateDisplay(dateRange.from)} ate ${formatDateDisplay(dateRange.to)}`}>
          {series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => formatCurrencyFull(value)} labelFormatter={(label) => formatDateDisplay(label)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#f59e0b" strokeWidth={2.8} dot={series.length < 15} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="premium-empty h-full">Nenhum dado no periodo selecionado</div>
          )}
        </ChartShell>

        <ChartShell title="Veiculos mais afetados" subtitle={`Top 10 por ${sortBy === 'count' ? 'quantidade' : 'valor'}`}>
          {vehicles.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicles} layout="vertical" margin={{ top: 8, right: 10, left: 50, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" tickFormatter={(v) => sortBy === 'count' ? String(v) : formatCurrency(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="plate" width={56} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number, name: string) => [sortBy === 'count' ? `${value} ocorrencias` : formatCurrencyFull(value), name]} contentStyle={tooltipStyle} />
                <Bar dataKey={sortBy === 'count' ? 'count' : 'total'} name={sortBy === 'count' ? 'Ocorrencias' : 'Valor'} radius={[0, 10, 10, 0]}>
                  {vehicles.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="premium-empty h-full">Nenhum dado no periodo selecionado</div>
          )}
        </ChartShell>
      </div>

      <div className="data-table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Detalhamento oficial das multas</h2>
            <p className="mt-1 text-sm text-slate-500">Mostrando {fines.length} de {totalFines} registros oficiais.</p>
          </div>
          <Badge variant="secondary">{totalFines} registros</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Periodo</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Placa</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">AIT / Orgao</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Motorista</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Valor</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Status</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Qualidade</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Veiculo / Investidor</th>
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => (
                <tr key={fine.id} className="border-t border-slate-200/70">
                  <td className="px-6 py-4">{fine.date ? formatDateDisplay(fine.date) : '-'}</td>
                  <td className="px-6 py-4 font-mono">{fine.plate || '-'}</td>
                  <td className="px-6 py-4">
                    <div>{fine.aitCode || '-'}</div>
                    <div className="text-xs text-slate-500">{fine.counterparty || 'Sem orgao'}</div>
                  </td>
                  <td className="px-6 py-4">{fine.driver || '-'}</td>
                  <td className="table-number px-6 py-4 font-medium text-amber-700">{formatCurrencyFull(fine.amount)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={fine.status === 'PAGO' ? 'success' : fine.status === 'ABERTA' ? 'warning' : 'info'} size="sm">
                      {fine.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={fine.qualityStatus === 'REVIEW_REQUIRED' ? 'warning' : fine.qualityStatus === 'WARNING' ? 'info' : 'success'}
                      size="sm"
                    >
                      {fine.qualityStatus === 'REVIEW_REQUIRED' ? 'Revisar' : fine.qualityStatus === 'WARNING' ? 'Alerta' : 'OK'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="truncate">{fine.description || '-'}</div>
                    <div className="text-xs text-slate-500">{fine.investor || 'Sem investidor'}</div>
                  </td>
                </tr>
              ))}
              {fines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">Nenhuma multa encontrada no periodo.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, tone }: { title: string; value: string; icon: ReactNode; tone: 'amber' | 'blue' }) {
  const toneClass = {
    amber: 'from-amber-500/12 to-white text-amber-700',
    blue: 'from-[#022D44]/12 to-white text-[#022D44]',
  }[tone];
  return (
    <div className={`card-premium bg-gradient-to-br ${toneClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
          <p className="metric-value-fluid mt-3 text-slate-900">{value}</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function ChartShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="card-premium overflow-hidden p-0">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-5">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="h-[300px] px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(226,232,240,0.9)',
  borderRadius: '16px',
  boxShadow: '0 20px 45px -28px rgba(15,23,42,0.32)',
  fontSize: '12px',
};
