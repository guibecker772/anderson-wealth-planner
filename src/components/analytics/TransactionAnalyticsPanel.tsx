'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatDateDisplay } from '@/lib/dateRange';
import type { SummaryResponse, TimeSeriesResponse, TopRankingResponse } from '@/lib/analytics/transaction-metrics';

interface TransactionAnalyticsPanelProps {
  scope: 'income' | 'expense';
  dateRange: { from: string; to: string };
  data: {
    summary: SummaryResponse;
    series: TimeSeriesResponse;
    top: TopRankingResponse;
  };
}

const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
};

const CATEGORY_COLORS = ['#022D44', '#A8CF4C', '#3b82f6', '#f59e0b', '#8b5cf6'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function TransactionAnalyticsPanel({ scope, dateRange, data }: TransactionAnalyticsPanelProps) {
  const summary = data.summary;
  const series = data.series.data || [];
  const ranking = data.top.data || [];

  const isPositiveDelta = summary.deltaValue >= 0;
  const deltaColor =
    scope === 'income'
      ? isPositiveDelta ? 'text-emerald-600' : 'text-red-600'
      : isPositiveDelta ? 'text-red-600' : 'text-emerald-600';
  const DeltaIcon = isPositiveDelta ? TrendingUp : TrendingDown;
  const chartTitle = scope === 'income' ? 'Fluxo de receitas' : 'Fluxo de despesas';
  const rankingTitle = scope === 'income' ? 'Maiores entradas' : 'Maiores saídas';
  const chartColor = CHART_COLORS[scope];

  return (
    <div className="space-y-4">
      <div className="editorial-panel px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ui-on-dark-muted">Pulso do ledger</p>
            <h3 className="metric-value-fluid mt-2 text-ui-on-dark">{formatCurrencyFull(summary.total)}</h3>
            <p className="mt-2 text-sm text-ui-on-dark-muted">
              {summary.count} lançamentos entre {formatDateDisplay(dateRange.from)} e {formatDateDisplay(dateRange.to)}.
            </p>
          </div>
          <div className="glass-panel flex items-center justify-between p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Comparação</p>
              <div className={`mt-2 flex items-center gap-2 ${deltaColor}`}>
                <DeltaIcon className="h-5 w-5" />
                <span className="text-[clamp(1.4rem,1.7vw,2rem)] font-semibold tracking-[-0.03em]">{formatPct(summary.deltaPct)}</span>
              </div>
              <p className={`mt-1 text-sm ${deltaColor}`}>{formatCurrency(summary.deltaValue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card-premium overflow-hidden p-0">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-5">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{chartTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateDisplay(dateRange.from)} até {formatDateDisplay(dateRange.to)}
            </p>
          </div>
          <div className="chart-panel px-4 py-5 sm:px-6">
            {series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#64748b' }} width={72} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    labelFormatter={(label) => formatDateDisplay(label)}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(226,232,240,0.9)', borderRadius: '16px', boxShadow: '0 20px 45px -28px rgba(15,23,42,0.32)', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="total" name="Total" stroke={chartColor} strokeWidth={2.8} dot={series.length < 15} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="premium-empty h-full">
                <p className="text-sm font-semibold text-slate-700">Série analítica indisponível</p>
                <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
                  Não houve lançamentos suficientes no período filtrado para compor o gráfico.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card-premium overflow-hidden p-0">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-5">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{rankingTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">Top 5 classes do ledger</p>
          </div>
          <div className="chart-panel px-4 py-5 sm:px-6">
            {ranking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking} layout="vertical" margin={{ top: 8, right: 10, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(226,232,240,0.9)', borderRadius: '16px', boxShadow: '0 20px 45px -28px rgba(15,23,42,0.32)', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" name="Total" radius={[0, 10, 10, 0]}>
                    {ranking.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="premium-empty h-full">
                <p className="text-sm font-semibold text-slate-700">Ranking indisponível</p>
                <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
                  O período não retornou classes suficientes para montar o ranking.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
