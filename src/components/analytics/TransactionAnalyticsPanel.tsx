'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatDateDisplay } from '@/lib/dateRange';
import type {
  SummaryResponse,
  TimeSeriesResponse,
  TopRankingResponse,
} from '@/lib/analytics/transaction-metrics';

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

const CATEGORY_COLORS = [
  '#022D44', '#A8CF4C', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

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
    const date = new Date(dateStr + 'T12:00:00');
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

export function TransactionAnalyticsPanel({
  scope,
  dateRange,
  data,
}: TransactionAnalyticsPanelProps) {
  const summary = data.summary;
  const series = data.series.data || [];
  const ranking = data.top.data || [];

  const isPositiveDelta = summary.deltaValue >= 0;
  const deltaColor = scope === 'income'
    ? (isPositiveDelta ? 'text-emerald-600' : 'text-red-600')
    : (isPositiveDelta ? 'text-red-600' : 'text-emerald-600');
  const DeltaIcon = isPositiveDelta ? TrendingUp : TrendingDown;

  const chartTitle = scope === 'income' ? 'EvoluÃ§Ã£o das Receitas' : 'EvoluÃ§Ã£o das Despesas';
  const rankingTitle = scope === 'income' ? 'Maiores receitas por classe' : 'Maiores gastos por classe';
  const chartColor = CHART_COLORS[scope];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Total no PerÃ­odo
            </p>
            <p className={`text-2xl font-bold mt-1 ${scope === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrencyFull(summary.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.count} lanÃ§amentos
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">vs perÃ­odo anterior</p>
            <div className={`flex items-center gap-1 ${deltaColor}`}>
              <DeltaIcon className="w-4 h-4" />
              <span className="font-semibold">
                {formatPct(summary.deltaPct)}
              </span>
            </div>
            <p className={`text-sm ${deltaColor}`}>
              {formatCurrency(summary.deltaValue)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4 bg-card rounded-xl border p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">{chartTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateDisplay(dateRange.from)} atÃ© {formatDateDisplay(dateRange.to)}
            </p>
          </div>
          {series.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    labelFormatter={(label) => formatDateDisplay(label)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={series.length < 15}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground text-sm">
              Nenhum dado no perÃ­odo selecionado
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-card rounded-xl border p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">{rankingTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Top 5 categorias</p>
          </div>
          {ranking.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ranking}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    className="text-xs"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                    {ranking.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground text-sm">
              Nenhum dado no perÃ­odo selecionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
