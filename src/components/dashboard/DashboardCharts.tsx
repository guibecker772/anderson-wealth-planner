'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownCircle,
  Clock3,
  DollarSign,
  Info,
  Layers3,
  Loader2,
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
    latestReferenceDate: string | null;
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

  const { summary, topCategories, emptyState, financialSummary, operationalSummary } = data;
  const isEmptyState = Boolean(emptyState?.isEmpty);
  const showComparisons = !isEmptyState;
  const latestOperationalReferenceLabel = operationalSummary?.latestReferenceDate
    ? formatDateDisplay(operationalSummary.latestReferenceDate)
    : null;
  const analyticSeries = trimExecSeries(execData.series);
  const bucketLabel = bucket === 'month' ? 'mes' : 'semana';
  const sortedCategories = [...topCategories].sort((a, b) => b.total - a.total);
  const executiveKpis = [
    {
      title: 'Receita total',
      value: formatCurrencyFull(summary.totalRevenue),
      tooltip: 'Entradas financeiras reconhecidas no workbook no periodo selecionado.',
      deltaPct: showComparisons ? execData.comparison.incomeReceived.deltaPct : undefined,
      icon: <TrendingUp className="h-5 w-5" />,
      accent: 'emerald' as const,
      deltaPositiveIsGood: true,
      subtext: 'Camada financeira do periodo.',
    },
    {
      title: 'Despesa total',
      value: formatCurrencyFull(summary.totalExpenses),
      tooltip: 'Saidas financeiras reconhecidas no workbook no periodo selecionado.',
      deltaPct: showComparisons ? execData.comparison.expensePaid.deltaPct : undefined,
      icon: <TrendingDown className="h-5 w-5" />,
      accent: 'red' as const,
      deltaPositiveIsGood: false,
      subtext: 'Nao inclui investimentos.',
    },
    {
      title: 'Resultado de caixa',
      value: formatCurrencyFull(execData.summary.profitCash ?? summary.netProfit),
      tooltip: 'Receita total menos despesa total no ledger financeiro, antes de considerar investimentos.',
      deltaPct: showComparisons ? execData.comparison.profitCash.deltaPct : undefined,
      icon: <DollarSign className="h-5 w-5" />,
      accent: (execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'emerald' as const : 'red' as const,
      deltaPositiveIsGood: true,
      subtext: financialSummary
        ? `Receita menos despesa financeira. Apos investimentos: ${formatCurrencyFull(financialSummary.netCashAfterInvestments)}.`
        : 'Receita menos despesa financeira do periodo.',
    },
    {
      title: 'Investimentos',
      value: formatCurrencyFull(financialSummary?.investments ?? 0),
      tooltip: 'Saidas classificadas como investimento no workbook financeiro.',
      deltaPct: undefined,
      icon: <PiggyBank className="h-5 w-5" />,
      accent: 'blue' as const,
      deltaPositiveIsGood: false,
      subtext: financialSummary ? `${financialSummary.entryCount} lancamentos reconhecidos` : 'Sem lancamentos no periodo.',
    },
    {
      title: 'Valor a receber',
      value: formatCurrencyFull(operationalSummary?.amountToCharge ?? 0),
      tooltip: 'Base prevista de cobranca da operacao no periodo.',
      deltaPct: undefined,
      icon: <ArrowDownCircle className="h-5 w-5" />,
      accent: 'blue' as const,
      deltaPositiveIsGood: true,
      subtext:
        operationalSummary && operationalSummary.pendingReceivables > 0
          ? `${formatCurrencyFull(operationalSummary.pendingReceivables)} em aberto`
          : 'Sem aberto relevante na operacao.',
    },
  ];

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
      <div className="editorial-panel overflow-hidden px-7 py-6 lg:px-8 lg:py-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#022D44] via-[#0d4566] to-[#A8CF4C]" />
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#A8CF4C]/18 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#022D44]/10 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="page-hero-chip">
              <Sparkles className="h-3.5 w-3.5" />
              Painel executivo do periodo
            </span>
            <span className="page-hero-chip">
              <Layers3 className="h-3.5 w-3.5" />
              Financeiro e operacao em camadas separadas
            </span>
            <DateRangeBadge from={dateRange.from} to={dateRange.to} />
          </div>

          {latestOperationalReferenceLabel ? (
            <div className="inline-flex max-w-md items-start gap-3 rounded-[20px] border border-white/12 bg-white/8 px-4 py-3 text-white/92 shadow-[0_20px_40px_-30px_rgba(2,45,68,0.45)] backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/14 text-white">
                <Clock3 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/68">
                  Última leitura disponível
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {latestOperationalReferenceLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/70">
                  Data mais recente encontrada na base operacional para o período consultado.
                </p>
              </div>
            </div>
          ) : null}

          <div className="max-w-3xl space-y-2.5">
            <h1 className="text-[clamp(2.35rem,4vw,3.3rem)] font-semibold tracking-[-0.045em] text-white">
              Visao Geral
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82 sm:text-[15px] sm:leading-6">
              Leitura executiva do periodo para acompanhar caixa, investimentos, cobranca prevista
              e desempenho operacional sem redundancia no topo.
            </p>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-5">
            {executiveKpis.map((metric) => (
              <KPIBandCard key={metric.title} {...metric} />
            ))}
          </div>
        </div>
      </div>

      {emptyState ? <DashboardEmptyBanner emptyState={emptyState} /> : null}

      {(financialSummary || operationalSummary) ? (
        <div className="space-y-7 pt-1">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Leitura por camada</p>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">Financeiro e operacional, sem disputar o topo</h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                  Os indicadores principais ficam na abertura. Abaixo, cada camada detalha a composicao
                  dos numeros sem perder investimentos, custo operacional, valor a receber e resultado operacional.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {financialSummary ? (
              <LayerShowcase
                title="Camada Financeira"
                subtitle="Entradas, saidas e investimentos reconhecidos no workbook financeiro."
                badge="Fluxo financeiro"
                variant="financial"
                icon={<Wallet className="h-4 w-4" />}
                footer={`${financialSummary.entryCount} lancamentos reconhecidos`}
                metrics={[
                  {
                    label: 'Receita total',
                    value: formatCurrencyFull(financialSummary.revenue),
                    tone: 'emerald',
                    icon: <TrendingUp className="h-4 w-4" />,
                  },
                  {
                    label: 'Despesa total',
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
                subtitle="Recebimento, custo e valor previsto da frota na leitura operacional."
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
                    label: 'Valor a receber',
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

      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Analise temporal</p>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">Graficos de acompanhamento do periodo</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Detalhamento por periodo de receita, despesa, resultado de caixa e margem.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1 shadow-sm">
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
            {loading ? (
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recarregando granularidade...
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard
            title="Receita e despesa por período"
            subtitle={`Entradas e saidas por ${bucketLabel} dentro do recorte selecionado.`}
            icon={<Radar className="h-4 w-4 text-slate-500" />}
            heightClass="h-[360px]"
          >
            {analyticSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticSeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'incomeReceived' ? 'Receita' : 'Despesa']}
                    labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                    contentStyle={tooltipStyle}
                  />
                  <Legend formatter={(value) => (value === 'incomeReceived' ? 'Receita' : 'Despesa')} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="incomeReceived" name="incomeReceived" fill={CHART_COLORS.revenue} radius={[10, 10, 0, 0]} />
                  <Bar dataKey="expensePaid" name="expensePaid" fill={CHART_COLORS.expenses} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanelState
                heightClass="h-[360px]"
                message={isEmptyState ? 'Nenhum dado importado ainda para compor este comparativo.' : 'Nenhuma movimentacao relevante no periodo selecionado'}
                actionHref={emptyState?.actionHref}
                actionLabel={emptyState?.actionLabel}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Evolução do resultado de caixa"
            subtitle={`Saldo entre receita e despesa por ${bucketLabel}.`}
            icon={<Sparkles className="h-4 w-4 text-slate-500" />}
            heightClass="h-[360px]"
          >
            {analyticSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticSeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="rgba(100,116,139,0.5)" strokeDasharray="4 4" />
                  <Tooltip formatter={(value: number) => [formatCurrencyFull(value), 'Resultado de caixa']} labelStyle={{ fontWeight: 600, marginBottom: 2 }} contentStyle={tooltipStyle} />
                  <Bar dataKey="profitCash" name="Resultado de caixa" radius={[10, 10, 0, 0]}>
                    {analyticSeries.map((entry) => (
                      <Cell
                        key={entry.bucketStart}
                        fill={entry.profitCash >= 0 ? CHART_COLORS.primary : CHART_COLORS.expenses}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanelState
                heightClass="h-[360px]"
                message={isEmptyState ? 'Nenhum dado importado ainda para acompanhar o resultado de caixa.' : 'Nenhum resultado de caixa no periodo selecionado'}
                actionHref={emptyState?.actionHref}
                actionLabel={emptyState?.actionLabel}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Margem de lucro"
            subtitle="Resultado de caixa sobre a receita do periodo."
            icon={<DollarSign className="h-4 w-4 text-slate-500" />}
            heightClass="h-[360px]"
          >
            {execData.summary.margin != null ? (
              <MarginGauge
                value={execData.summary.margin}
                delta={showComparisons ? execData.comparison.margin.deltaPP : null}
              />
            ) : (
              <EmptyPanelState
                heightClass="h-[360px]"
                message={isEmptyState ? 'A margem aparecera aqui depois da primeira importacao.' : 'Sem receita suficiente no periodo para calcular a margem'}
                actionHref={emptyState?.actionHref}
                actionLabel={emptyState?.actionLabel}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Valor gasto por categoria financeira"
            subtitle="Ranking das categorias que mais consumiram caixa no periodo."
            icon={<Receipt className="h-4 w-4 text-slate-500" />}
            heightClass="h-[360px]"
          >
            {sortedCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedCategories} layout="vertical" margin={{ top: 0, right: 95, left: 8, bottom: 0 }} barCategoryGap="24%">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 600 }}
                    width={170}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: string) => (value.length > 24 ? `${value.slice(0, 23)}…` : value)}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), 'Total gasto']}
                    labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="total" name="Total gasto" radius={[0, 6, 6, 0]} barSize={24}>
                    {sortedCategories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                    <LabelList dataKey="total" position="right" formatter={(value: number) => formatCurrency(value)} style={{ fontSize: 12, fontWeight: 700, fill: '#1e293b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanelState
                heightClass="h-[360px]"
                message={isEmptyState ? 'As categorias aparecerao aqui apos a importacao.' : 'Nenhum gasto categorizado no periodo selecionado'}
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

function formatDeltaPP(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Sem comparacao';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} p.p.`;
}

function trimExecSeries(series: ExecSeriesPoint[]): ExecSeriesPoint[] {
  const firstIndex = series.findIndex((entry) =>
    Math.abs(entry.incomeReceived) > 0.009 || Math.abs(entry.expensePaid) > 0.009 || Math.abs(entry.profitCash) > 0.009
  );

  if (firstIndex === -1) {
    return [];
  }

  let lastIndex = series.length - 1;
  while (
    lastIndex >= firstIndex &&
    Math.abs(series[lastIndex].incomeReceived) <= 0.009 &&
    Math.abs(series[lastIndex].expensePaid) <= 0.009 &&
    Math.abs(series[lastIndex].profitCash) <= 0.009
  ) {
    lastIndex -= 1;
  }

  return series.slice(firstIndex, lastIndex + 1);
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function MarginGauge({ value, delta }: { value: number; delta: number | null }) {
  const clampedValue = Math.max(-100, Math.min(100, value));
  const sweepAngle = ((clampedValue + 100) / 200) * 180;
  const pointerAngle = sweepAngle - 180;
  const gaugeColor = clampedValue >= 30 ? '#22c55e' : clampedValue >= 0 ? '#f59e0b' : '#ef4444';

  const cx = 200;
  const cy = 190;
  const r = 148;
  const sw = 30;
  const pointer = polarToCartesian(cx, cy, r, pointerAngle + 180);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex w-full flex-col items-center">
        <svg viewBox="0 0 400 225" className="w-full">
          {/* Background track */}
          <path d={describeArc(cx, cy, r, -180, 0)} fill="none" stroke="#e2e8f0" strokeWidth={sw} strokeLinecap="round" />
          {/* Subtle color zones */}
          <path d={describeArc(cx, cy, r, -180, -120)} fill="none" stroke="rgba(239,68,68,0.10)" strokeWidth={sw} strokeLinecap="round" />
          <path d={describeArc(cx, cy, r, -120, -60)} fill="none" stroke="rgba(245,158,11,0.08)" strokeWidth={sw} strokeLinecap="round" />
          <path d={describeArc(cx, cy, r, -60, 0)} fill="none" stroke="rgba(34,197,94,0.08)" strokeWidth={sw} strokeLinecap="round" />
          {/* Value arc */}
          {sweepAngle > 0.5 && (
            <path d={describeArc(cx, cy, r, -180, -180 + sweepAngle)} fill="none" stroke={gaugeColor} strokeWidth={sw} strokeLinecap="round" />
          )}
          {/* Pointer */}
          <circle cx={pointer.x} cy={pointer.y} r="11" fill={gaugeColor} stroke="white" strokeWidth="3.5" />
          {/* Hero percentage – centered inside the gauge */}
          <text x={cx} y={cy - 45} textAnchor="middle" dominantBaseline="auto">
            <tspan style={{ fontSize: '78px', fontWeight: 700, fill: '#0f172a', letterSpacing: '-0.04em' }}>{value.toFixed(1)}</tspan>
            <tspan dx="2" style={{ fontSize: '40px', fontWeight: 600, fill: '#64748b' }}>%</tspan>
          </text>
          <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: '13px', fontWeight: 600, fill: '#94a3b8', letterSpacing: '0.08em' }}>
            MARGEM DO PERIODO
          </text>
        </svg>
        {delta != null && (
          <p className={`-mt-2 text-sm font-medium ${delta >= 0 ? 'delta-positive' : 'delta-negative'}`}>
            {formatDeltaPP(delta)} vs. anterior
          </p>
        )}
      </div>
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
      ? deltaPct >= 0 ? 'delta-positive' : 'delta-negative'
      : deltaPct >= 0 ? 'delta-negative' : 'delta-positive';

  return (
    <div className={`card-premium bg-gradient-to-br ${accents} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500 sm:text-[11px]">{title}</p>
            {tooltip ? (
              <div className="group/tip relative">
                <Info className="h-3.5 w-3.5 cursor-help text-slate-300" />
                <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 opacity-0 shadow-xl transition-all group-hover/tip:visible group-hover/tip:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-2.5 overflow-hidden whitespace-nowrap text-[clamp(1.2rem,1.3vw,1.85rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums text-slate-900">
            {value}
          </p>
          <p className={`mt-1.5 text-xs font-medium ${deltaColor}`}>
            {deltaPct == null ? 'Sem comparacao' : `${formatDeltaPct(deltaPct)} vs ant.`}
          </p>
          {subtext ? <p className="mt-1.5 text-xs leading-4.5 text-slate-500">{subtext}</p> : null}
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-slate-700 shadow-sm sm:h-11 sm:w-11">
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
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-4">
        <div className="flex items-center gap-2.5">
          {icon ? <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500">{icon}</span> : null}
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className={`px-4 py-4 sm:px-5 ${heightClass ?? ''}`}>
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
