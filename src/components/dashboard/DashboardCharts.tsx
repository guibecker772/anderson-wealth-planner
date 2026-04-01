'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  DollarSign,
  HelpCircle,
  Info,
  Layers3,
  Loader2,
  Minus,
  PiggyBank,
  Radar,
  Receipt,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';

type BucketGranularity = 'day' | 'week' | 'month';

interface ExecSeriesPoint {
  bucketStart: string;
  bucketLabel: string;
  incomeReceived: number;
  expensePaid: number;
  profitCash: number;
}

interface CategoryDriver {
  categoryId: string | null;
  categoryName: string;
  totalPaid: number;
  prevTotalPaid: number | null;
  deltaValue: number | null;
  deltaPct: number | null;
}

interface ExecDashboardResponse {
  summary: {
    incomeReceived: number;
    expensePaid: number;
    profitCash: number;
    margin: number | null;
    receivable: number;
    payable: number;
    receivableOverdue: number;
    payableOverdue: number;
  };
  comparison: {
    incomeReceived: { prev: number; deltaValue: number; deltaPct: number | null };
    expensePaid: { prev: number; deltaValue: number; deltaPct: number | null };
    profitCash: { prev: number; deltaValue: number; deltaPct: number | null };
    receivable: { prev: number; deltaValue: number; deltaPct: number | null };
    payable: { prev: number; deltaValue: number; deltaPct: number | null };
    margin: { prev: number | null; deltaPP: number | null };
  };
  series: ExecSeriesPoint[];
  drivers: CategoryDriver[];
  dateRange: { from: string; to: string };
  previousRange: { from: string; to: string };
  bucket: BucketGranularity;
  error?: string;
}

export interface DashboardEmptyState {
  isEmpty: true;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export interface DashboardChartsData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    pendingPayables: number;
    overduePayables: number;
    pendingReceivables: number;
    overdueReceivables: number;
  };
  cashflow: Array<{
    date: string;
    revenue: number;
    expenses: number;
    balance: number;
  }>;
  topCategories: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  dateRange: {
    from: string;
    to: string;
  };
  financialSummary?: {
    revenue: number;
    expense: number;
    investments: number;
    netCashAfterInvestments: number;
    entryCount: number;
  };
  operationalSummary?: {
    revenueReceived: number;
    amountToCharge: number;
    operationalCost: number;
    netOperational: number;
    pendingReceivables: number;
    fleetStates: Array<{ status: string; count: number }>;
    qualitySummary: Record<'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN', number>;
    snapshotCount: number;
  };
  error?: string;
  emptyState?: DashboardEmptyState;
}

interface DashboardChartsProps {
  data: DashboardChartsData;
  initialExecData: ExecDashboardResponse;
  dateRange: { from: string; to: string };
  initialBucket?: BucketGranularity;
}

const GRANULARITY_OPTIONS: { value: BucketGranularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

const CHART_COLORS = {
  primary: '#022D44',
  accent: '#A8CF4C',
  revenue: '#22c55e',
  expenses: '#ef4444',
  balance: '#022D44',
};

const CATEGORY_COLORS = [
  '#022D44',
  '#A8CF4C',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
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
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function DashboardCharts({
  data,
  initialExecData,
  dateRange,
  initialBucket = 'week',
}: DashboardChartsProps) {
  const [execData, setExecData] = useState<ExecDashboardResponse>(initialExecData);
  const [bucket, setBucket] = useState<BucketGranularity>(initialBucket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(data.error ?? initialExecData.error ?? null);

  const { summary, cashflow, topCategories, emptyState, financialSummary, operationalSummary } = data;
  const isEmptyState = Boolean(emptyState?.isEmpty);
  const showComparisons = !isEmptyState;
  const marginValue =
    execData.summary.margin != null
      ? `${execData.summary.margin.toFixed(1)}%`
      : isEmptyState
        ? '0,0%'
        : '-';

  useEffect(() => {
    setExecData(initialExecData);
    setBucket(initialBucket);
    setLoading(false);
    setError(data.error ?? initialExecData.error ?? null);
  }, [data.error, initialBucket, initialExecData]);

  useEffect(() => {
    const hasCurrentDateRange =
      execData.dateRange.from === dateRange.from &&
      execData.dateRange.to === dateRange.to;

    if (!hasCurrentDateRange || bucket === initialBucket) {
      return;
    }

    let ignore = false;

    async function fetchExecData() {
      setLoading(true);
      setError(null);

      try {
        const execParams = new URLSearchParams({
          from: dateRange.from,
          to: dateRange.to,
          bucket,
        });

        const execRes = await fetch(`/api/dashboard/exec?${execParams.toString()}`, {
          cache: 'no-store',
        });

        if (!execRes.ok) {
          throw new Error('Falha ao carregar dados do dashboard');
        }

        const execJson: ExecDashboardResponse = await execRes.json();

        if (!ignore) {
          setExecData(execJson);
          setError(execJson.error ?? null);
        }
      } catch (err) {
        if (!ignore) {
          setError((err as Error).message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchExecData();

    return () => {
      ignore = true;
    };
  }, [bucket, dateRange.from, dateRange.to, execData.dateRange.from, execData.dateRange.to, initialBucket]);

  if (error) {
    return (
      <div className="premium-empty h-[400px]">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-base font-medium text-foreground">{error}</p>
      </div>
    );
  }

  const handleBucketChange = (nextBucket: BucketGranularity) => {
    if (nextBucket === bucket) return;

    const hasCurrentDateRange =
      initialExecData.dateRange.from === dateRange.from &&
      initialExecData.dateRange.to === dateRange.to;

    if (nextBucket === initialBucket && hasCurrentDateRange) {
      setBucket(nextBucket);
      setExecData(initialExecData);
      setLoading(false);
      setError(data.error ?? initialExecData.error ?? null);
      return;
    }

    setBucket(nextBucket);
  };

  return (
    <div className="page-shell">
      <div className="editorial-panel overflow-hidden px-7 py-7 lg:px-9">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#022D44] via-[#0d4566] to-[#A8CF4C]" />
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#A8CF4C]/18 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#022D44]/10 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.4fr_0.95fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="page-hero-chip">
                <Sparkles className="h-3.5 w-3.5" />
                Painel Executivo multiaba
              </span>
              <span className="page-hero-chip">
                <Layers3 className="h-3.5 w-3.5" />
                Operacao + caixa sem dupla contagem
              </span>
              <DateRangeBadge from={dateRange.from} to={dateRange.to} />
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Visao Geral
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/82 sm:text-base">
                Um cockpit com a camada operacional da frota, o ledger financeiro do workbook e os
                sinais de qualidade que impactam a leitura executiva.
              </p>
            </div>

            <div className="hero-metrics-grid">
              <HeroMetricCard
                label="Resultado de caixa"
                value={formatCurrencyFull(execData.summary.profitCash ?? summary.netProfit)}
                tone={(execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'emerald' : 'red'}
                detail={showComparisons ? `${formatDeltaPct(execData.comparison.profitCash.deltaPct)} vs ant.` : 'Sem comparacao'}
              />
              <HeroMetricCard
                label="Resultado operacional"
                value={formatCurrencyFull(operationalSummary?.netOperational ?? 0)}
                tone={(operationalSummary?.netOperational ?? 0) >= 0 ? 'blue' : 'red'}
                detail={`${operationalSummary?.snapshotCount ?? 0} snapshots no periodo`}
              />
              <HeroMetricCard
                label="Exposicao a receber"
                value={formatCurrencyFull(summary.pendingReceivables)}
                tone={summary.pendingReceivables > 0 ? 'blue' : 'emerald'}
                detail={summary.overdueReceivables > 0 ? `${formatCurrencyFull(summary.overdueReceivables)} vencidos` : 'Sem vencidos relevantes'}
              />
            </div>
          </div>

          <div className="glass-panel border-white/75 bg-white/86 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Leitura viva</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Pulso do periodo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Compare margem, cobertura da base e volume financeiro sem repetir todos os KPIs da dobra seguinte.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm">
                {GRANULARITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleBucketChange(opt.value)}
                    disabled={loading}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      bucket === opt.value
                        ? 'bg-[#022D44] text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    } ${loading ? 'opacity-60' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <PulseItem
                icon={<CircleDollarSign className="h-4 w-4" />}
                label="Margem"
                value={marginValue}
                delta={showComparisons ? execData.comparison.margin.deltaPP : null}
                isPercent
                positiveIsGood
              />
              <PulseItem
                icon={<Receipt className="h-4 w-4" />}
                label="Investimentos"
                value={formatCurrencyFull(financialSummary?.investments ?? 0)}
                delta={null}
                positiveIsGood={false}
              />
              <PulseItem
                icon={<Truck className="h-4 w-4" />}
                label="Snapshots"
                value={String(operationalSummary?.snapshotCount ?? 0)}
                delta={null}
                positiveIsGood
              />
              <PulseItem
                icon={<Wallet className="h-4 w-4" />}
                label="Lancamentos"
                value={String(financialSummary?.entryCount ?? 0)}
                delta={null}
                positiveIsGood
              />
            </div>

            {loading ? (
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recarregando granularidade...
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {emptyState ? <DashboardEmptyBanner emptyState={emptyState} /> : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <KPIBandCard
          title="Receita financeira"
          value={formatCurrencyFull(summary.totalRevenue)}
          tooltip="Entradas do workbook na aba Receita."
          deltaPct={showComparisons ? execData.comparison.incomeReceived.deltaPct : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="emerald"
          deltaPositiveIsGood
        />
        <KPIBandCard
          title="Despesa financeira"
          value={formatCurrencyFull(summary.totalExpenses)}
          tooltip="Saidas de caixa da aba Despesa."
          deltaPct={showComparisons ? execData.comparison.expensePaid.deltaPct : undefined}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="red"
          deltaPositiveIsGood={false}
        />
        <KPIBandCard
          title="Contas a receber"
          value={formatCurrencyFull(summary.pendingReceivables)}
          tooltip="Pendencia financeira do periodo."
          subtext={summary.overdueReceivables > 0 ? `${formatCurrencyFull(summary.overdueReceivables)} vencidos` : 'Sem vencidos'}
          deltaPct={showComparisons ? execData.comparison.receivable.deltaPct : undefined}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          accent={summary.overdueReceivables > 0 ? 'amber' : 'blue'}
        />
        <KPIBandCard
          title="Contas a pagar"
          value={formatCurrencyFull(summary.pendingPayables)}
          tooltip="Pendencia financeira do periodo."
          subtext={summary.overduePayables > 0 ? `${formatCurrencyFull(summary.overduePayables)} vencidos` : 'Sem vencidos'}
          deltaPct={showComparisons ? execData.comparison.payable.deltaPct : undefined}
          icon={<Receipt className="h-5 w-5" />}
          accent={summary.overduePayables > 0 ? 'amber' : 'slate'}
        />
      </div>

      {(financialSummary || operationalSummary) ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {financialSummary ? (
            <LayerShowcase
              title="Camada Financeira"
              subtitle="Ledger canonico do workbook: entradas, saidas e investimentos."
              badge="Fluxo financeiro"
              variant="financial"
              icon={<Wallet className="h-4 w-4" />}
              footer={`${financialSummary.entryCount} lancamentos reconhecidos`}
              metrics={[
                {
                  label: 'Entradas',
                  value: formatCurrencyFull(financialSummary.revenue),
                  tone: 'emerald',
                  icon: <TrendingUp className="h-4 w-4" />,
                },
                {
                  label: 'Saidas',
                  value: formatCurrencyFull(financialSummary.expense),
                  tone: 'red',
                  icon: <TrendingDown className="h-4 w-4" />,
                },
                {
                  label: 'Investimentos',
                  value: formatCurrencyFull(financialSummary.investments),
                  tone: 'blue',
                  icon: <PiggyBank className="h-4 w-4" />,
                },
                {
                  label: 'Saldo apos investimentos',
                  value: formatCurrencyFull(financialSummary.netCashAfterInvestments),
                  tone: financialSummary.netCashAfterInvestments >= 0 ? 'emerald' : 'red',
                  icon: <DollarSign className="h-4 w-4" />,
                  featured: true,
                },
              ]}
            />
          ) : null}
          {operationalSummary ? (
            <LayerShowcase
              title="Camada Operacional"
              subtitle="Cobranca, recebimento e custo da frota pela planilha operacional."
              badge="Base operacional"
              variant="operational"
              icon={<Truck className="h-4 w-4" />}
              footer={`${operationalSummary.snapshotCount} snapshots e ${operationalSummary.fleetStates.length} estados de frota`}
              metrics={[
                {
                  label: 'Receita recebida',
                  value: formatCurrencyFull(operationalSummary.revenueReceived),
                  tone: 'emerald',
                  icon: <TrendingUp className="h-4 w-4" />,
                },
                {
                  label: 'Custo operacional',
                  value: formatCurrencyFull(operationalSummary.operationalCost),
                  tone: 'amber',
                  icon: <TrendingDown className="h-4 w-4" />,
                },
                {
                  label: 'Valor a cobrar',
                  value: formatCurrencyFull(operationalSummary.amountToCharge),
                  tone: 'slate',
                  icon: <Target className="h-4 w-4" />,
                },
                {
                  label: 'Resultado operacional',
                  value: formatCurrencyFull(operationalSummary.netOperational),
                  tone: operationalSummary.netOperational >= 0 ? 'emerald' : 'red',
                  icon: <DollarSign className="h-4 w-4" />,
                  featured: true,
                  subtext: operationalSummary.pendingReceivables > 0 ? `${formatCurrencyFull(operationalSummary.pendingReceivables)} em aberto` : 'Sem aberto relevante',
                },
              ]}
            >
              <div className="mt-5 flex flex-wrap gap-2">
                {operationalSummary.fleetStates.slice(0, 6).map((fs) => (
                  <span key={fs.status} className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs text-slate-600 shadow-sm">
                    {fs.status}: {fs.count}
                  </span>
                ))}
              </div>
            </LayerShowcase>
          ) : null}
        </div>
      ) : null}

      {operationalSummary && hasQualityAlerts(operationalSummary.qualitySummary) ? (
        <div className="glass-panel border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.92))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-amber-700">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-sm font-semibold">Alertas de qualidade operacional</span>
              </div>
              <p className="text-sm text-slate-600">
                Os dados seguem visiveis, mas a camada operacional contem sinais que merecem leitura cuidadosa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {operationalSummary.qualitySummary.REVIEW_REQUIRED > 0 && (
                <QualityBadge label="Revisao" count={operationalSummary.qualitySummary.REVIEW_REQUIRED} variant="error" />
              )}
              {operationalSummary.qualitySummary.WARNING > 0 && (
                <QualityBadge label="Alertas" count={operationalSummary.qualitySummary.WARNING} variant="warning" />
              )}
              {operationalSummary.qualitySummary.UNKNOWN > 0 && (
                <QualityBadge label="Nao classificado" count={operationalSummary.qualitySummary.UNKNOWN} variant="neutral" />
              )}
              {operationalSummary.qualitySummary.OK > 0 && (
                <QualityBadge label="OK" count={operationalSummary.qualitySummary.OK} variant="success" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard
          title="Receita x despesa por janela"
          subtitle={`Camada financeira agregada por ${bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mes'}.`}
          icon={<Radar className="h-4 w-4 text-slate-500" />}
          heightClass="h-[380px]"
        >
          {execData.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={execData.series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'incomeReceived' ? 'Receita' : 'Despesa']}
                  contentStyle={tooltipStyle}
                />
                <Legend formatter={(value) => (value === 'incomeReceived' ? 'Receita' : 'Despesa')} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="incomeReceived" name="incomeReceived" fill={CHART_COLORS.revenue} radius={[10, 10, 0, 0]} />
                <Bar dataKey="expensePaid" name="expensePaid" fill={CHART_COLORS.expenses} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPanelState
              heightClass="h-[380px]"
              message={isEmptyState ? 'Nenhum dado importado ainda para compor este grafico.' : 'Nenhum dado no periodo selecionado'}
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Evolucao do lucro"
          subtitle="Lucro de caixa sem misturar ledger e operacional."
          icon={<Sparkles className="h-4 w-4 text-slate-500" />}
          heightClass="h-[380px]"
        >
          {execData.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={execData.series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGradientBold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <ReferenceLine y={0} stroke="rgba(100,116,139,0.5)" strokeDasharray="4 4" />
                <Tooltip formatter={(value: number) => [formatCurrencyFull(value), 'Lucro']} contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="profitCash"
                  name="profitCash"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={3}
                  fill="url(#profitGradientBold)"
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPanelState
              heightClass="h-[380px]"
              message={isEmptyState ? 'Nenhum dado importado ainda para acompanhar o lucro.' : 'Nenhum dado no periodo selecionado'}
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ChartCard
          title="Drivers de mudanca"
          subtitle="Categorias que puxaram a despesa versus periodo anterior."
          icon={<HelpCircle className="h-4 w-4 text-slate-500" />}
          heightClass="h-full"
        >
          {execData.drivers.length > 0 ? (
            <div className="soft-grid grid gap-3">
              {execData.drivers.map((driver, index) => (
                <div key={driver.categoryId ?? driver.categoryName} className="rounded-[20px] border border-white/80 bg-white/88 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.25)]">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                    <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500" title={driver.categoryName}>
                      {driver.categoryName}
                    </span>
                  </div>
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">{formatCurrency(driver.totalPaid)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <DeltaIndicator value={driver.deltaValue} pct={driver.deltaPct} positiveIsGood={false} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanelState
              compact
              message={isEmptyState ? 'Os drivers aparecerao aqui assim que os arquivos forem importados.' : 'Nenhuma variacao relevante no periodo selecionado'}
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </ChartCard>

        <div className="grid gap-6">
          <ChartCard
          title="Fluxo de Caixa Diario"
            subtitle="Receitas, despesas e saldo em leitura continua."
            icon={<BarChart3 className="h-4 w-4 text-slate-500" />}
            heightClass="h-[300px]"
          >
            {cashflow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflow} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrencyFull(value)} labelFormatter={(label) => formatDateDisplay(label)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="revenue" name="Receitas" stroke={CHART_COLORS.revenue} strokeWidth={2.6} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Despesas" stroke={CHART_COLORS.expenses} strokeWidth={2.3} dot={false} />
                  <Line type="monotone" dataKey="balance" name="Saldo" stroke={CHART_COLORS.balance} strokeWidth={2.8} strokeDasharray="7 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanelState
                heightClass="h-[300px]"
                message={isEmptyState ? 'O fluxo de caixa aparecera depois da primeira importacao.' : 'Nenhum dado no periodo selecionado'}
                actionHref={emptyState?.actionHref}
                actionLabel={emptyState?.actionLabel}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Top Categorias"
            subtitle="Maiores gastos financeiros do periodo."
            icon={<Receipt className="h-4 w-4 text-slate-500" />}
            heightClass="h-[300px]"
          >
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories} layout="vertical" margin={{ top: 5, right: 10, left: 72, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} width={68} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrencyFull(value)} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" name="Total gasto" radius={[0, 10, 10, 0]}>
                    {topCategories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanelState
                heightClass="h-[300px]"
                message={isEmptyState ? 'As categorias aparecerao aqui apos a importacao.' : 'Nenhum dado no periodo selecionado'}
                actionHref={emptyState?.actionHref}
                actionLabel={emptyState?.actionLabel}
              />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function DashboardEmptyBanner({ emptyState }: { emptyState: DashboardEmptyState }) {
  return (
    <div className="glass-panel p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground">
            <Info className="h-4 w-4 text-[#022D44]" />
            <p className="font-medium">{emptyState.title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{emptyState.description}</p>
        </div>
        <Link
          href={emptyState.actionHref}
          className="inline-flex items-center justify-center rounded-full bg-[#022D44] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#011f30]"
        >
          {emptyState.actionLabel}
        </Link>
      </div>
    </div>
  );
}

function EmptyPanelState({
  message,
  actionHref,
  actionLabel,
  compact = false,
  heightClass,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
  compact?: boolean;
  heightClass?: string;
}) {
  return (
    <div className={`premium-empty ${compact ? 'min-h-[140px]' : heightClass ?? 'h-[280px]'}`}>
      <Info className="h-5 w-5 text-[#022D44]" />
      <p className="max-w-sm text-center text-sm text-slate-600">{message}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="text-sm font-medium text-[#022D44] underline underline-offset-4">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatDeltaValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDeltaPP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} p.p.`;
}

function HeroMetricCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'red';
  detail: string;
}) {
  const palette = {
    blue: 'from-[#022D44]/12 to-white text-[#022D44]',
    emerald: 'from-emerald-500/12 to-white text-emerald-700',
    red: 'from-red-500/12 to-white text-red-700',
  }[tone];

  return (
    <div className={`hero-metric-card bg-gradient-to-br ${palette}`}>
      <p className="metric-label-soft">{label}</p>
      <p className="metric-value-fluid mt-3">{value}</p>
      <p className="metric-helper mt-2">{detail}</p>
    </div>
  );
}

function PulseItem({
  icon,
  label,
  value,
  delta,
  positiveIsGood,
  isPercent = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: number | null;
  positiveIsGood: boolean;
  isPercent?: boolean;
}) {
  const color = delta == null
    ? 'text-slate-400'
    : positiveIsGood
      ? delta >= 0 ? 'text-emerald-600' : 'text-red-600'
      : delta >= 0 ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.3)]">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="break-words text-lg font-semibold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">{value}</p>
      <p className={`mt-2 text-xs font-medium ${color}`}>
        {delta == null ? 'Sem base comparativa' : isPercent ? formatDeltaPP(delta) : `${formatDeltaPct(delta)} vs ant.`}
      </p>
    </div>
  );
}

function KPIBandCard({
  title,
  value,
  icon,
  subtext,
  tooltip,
  deltaPct,
  deltaPositiveIsGood = true,
  accent = 'slate',
}: {
  title: string;
  value: string;
  icon?: ReactNode;
  subtext?: string;
  tooltip?: string;
  deltaPct?: number | null;
  deltaPositiveIsGood?: boolean;
  accent?: 'emerald' | 'red' | 'blue' | 'amber' | 'slate';
}) {
  const accents = {
    emerald: 'from-emerald-500/14 to-white text-emerald-700',
    red: 'from-red-500/14 to-white text-red-700',
    blue: 'from-sky-500/14 to-white text-sky-700',
    amber: 'from-amber-500/16 to-white text-amber-700',
    slate: 'from-[#022D44]/12 to-white text-[#022D44]',
  }[accent];

  const deltaColor = deltaPct == null
    ? 'text-slate-400'
    : deltaPositiveIsGood
      ? deltaPct >= 0 ? 'text-emerald-600' : 'text-red-600'
      : deltaPct >= 0 ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className={`card-premium bg-gradient-to-br ${accents} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</p>
            {tooltip ? (
              <div className="group/tip relative">
                <Info className="h-3.5 w-3.5 cursor-help text-slate-300" />
                <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 opacity-0 shadow-xl transition-all group-hover/tip:visible group-hover/tip:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          <p className="metric-value-fluid mt-3 text-slate-900">{value}</p>
          <p className={`mt-2 text-xs font-medium ${deltaColor}`}>
            {deltaPct == null ? 'Sem comparacao' : `${formatDeltaPct(deltaPct)} vs ant.`}
          </p>
          {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 text-slate-700 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function LayerShowcase({
  title,
  subtitle,
  badge,
  variant,
  icon,
  metrics,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  variant: 'financial' | 'operational';
  icon: ReactNode;
  metrics: Array<{
    label: string;
    value: string;
    tone: 'emerald' | 'red' | 'blue' | 'amber' | 'slate';
    icon: ReactNode;
    featured?: boolean;
    subtext?: string;
  }>;
  footer: string;
  children?: ReactNode;
}) {
  const variantClass = variant === 'financial' ? 'module-surface module-surface-financial' : 'module-surface module-surface-operational';

  return (
    <div className={variantClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="page-hero-chip">
            {icon}
            {badge}
          </span>
          <div>
            <h3 className={`text-[1.65rem] font-semibold tracking-[-0.03em] ${variant === 'financial' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`mt-1 max-w-xl text-sm leading-6 ${variant === 'financial' ? 'text-white/78' : 'text-slate-600'}`}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <LayerMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {children}

      <div className={`mt-5 border-t pt-4 text-xs font-medium uppercase tracking-[0.1em] ${variant === 'financial' ? 'border-white/12 text-white/68' : 'border-slate-200/70 text-slate-500'}`}>
        {footer}
      </div>
    </div>
  );
}

function LayerMetricCard({
  label,
  value,
  tone,
  icon,
  featured,
  subtext,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'red' | 'blue' | 'amber' | 'slate';
  icon: ReactNode;
  featured?: boolean;
  subtext?: string;
}) {
  const toneClass = {
    emerald: 'text-emerald-700 bg-emerald-500/10',
    red: 'text-red-700 bg-red-500/10',
    blue: 'text-sky-700 bg-sky-500/10',
    amber: 'text-amber-700 bg-amber-500/12',
    slate: 'text-slate-700 bg-slate-200/70',
  }[tone];

  return (
      <div className={`rounded-[24px] border border-white/85 bg-white/96 p-4 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.24)] ${featured ? 'ring-1 ring-[#A8CF4C]/35' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="break-words text-[clamp(1.2rem,1.7vw,1.8rem)] font-semibold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">{value}</p>
          {subtext ? <p className="mt-2 text-xs leading-5 text-slate-500">{subtext}</p> : null}
        </div>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
  heightClass,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  heightClass?: string;
}) {
  return (
    <div className="card-premium overflow-hidden p-0">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-5">
        <div className="flex items-center gap-3">
          {icon ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">{icon}</span> : null}
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className={`px-4 py-5 sm:px-6 ${heightClass ?? ''}`}>
        {children}
      </div>
    </div>
  );
}

function QualityBadge({ label, count, variant }: { label: string; count: number; variant: 'error' | 'warning' | 'neutral' | 'success' }) {
  const styles: Record<string, string> = {
    error: 'border-red-200 bg-red-50 text-red-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles[variant]}`}>
      {label}
      <span>{count}</span>
    </span>
  );
}

function DeltaIndicator({ value, pct, positiveIsGood = true }: { value?: number | null; pct?: number | null; positiveIsGood?: boolean }) {
  const getColor = (v: number) => {
    if (positiveIsGood) return v >= 0 ? 'text-emerald-600' : 'text-red-600';
    return v >= 0 ? 'text-red-600' : 'text-emerald-600';
  };
  const getIcon = (v: number) => {
    if (v > 0) return <ArrowUpRight className="h-3 w-3" />;
    if (v < 0) return <ArrowDownRight className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <>
      {value !== null && value !== undefined ? (
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${getColor(value)}`}>
          {getIcon(value)}
          {formatDeltaValue(value)}
        </span>
      ) : null}
      {pct !== null && pct !== undefined ? (
        <span className={`text-[11px] ${getColor(pct)}`}>({formatDeltaPct(pct)})</span>
      ) : null}
    </>
  );
}

function hasQualityAlerts(qs: { REVIEW_REQUIRED: number; WARNING: number; UNKNOWN: number; OK: number }): boolean {
  return qs.REVIEW_REQUIRED > 0 || qs.WARNING > 0 || qs.UNKNOWN > 0;
}

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(226,232,240,0.9)',
  borderRadius: '16px',
  boxShadow: '0 20px 45px -28px rgba(15,23,42,0.32)',
  fontSize: '12px',
};
