'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  Wallet,
  Receipt,
  Info,
  ArrowDownCircle,
  Percent,
  HelpCircle,
  DollarSign,
  Target,
  PiggyBank,
  BarChart3,
  Truck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
      <div className="flex h-[400px] items-center justify-center text-destructive">
        <AlertTriangle className="mr-2 h-6 w-6" />
        {error}
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
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Painel Executivo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Visao financeira e operacional sem dupla contagem</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleBucketChange(opt.value)}
                disabled={loading}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  bucket === opt.value
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${loading ? 'opacity-60' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          <DateRangeBadge from={dateRange.from} to={dateRange.to} />
        </div>
      </div>

      {emptyState ? <DashboardEmptyBanner emptyState={emptyState} /> : null}

      {/* ── Primary KPIs ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          title="Resultado Financeiro"
          value={formatCurrencyFull(execData.summary.profitCash ?? summary.netProfit)}
          tooltip="Entradas financeiras menos despesas financeiras do periodo"
          deltaPct={showComparisons ? execData.comparison.profitCash.deltaPct : undefined}
          deltaValue={showComparisons ? execData.comparison.profitCash.deltaValue : undefined}
          icon={<DollarSign className="h-5 w-5" />}
          accent={(execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'emerald' : 'red'}
          deltaPositiveIsGood
          featured
        />
        <KPICard
          title="Receita Financeira"
          value={formatCurrencyFull(summary.totalRevenue)}
          tooltip="Entradas do ledger financeiro (aba Receita)"
          deltaPct={showComparisons ? execData.comparison.incomeReceived.deltaPct : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="emerald"
          deltaPositiveIsGood
        />
        <KPICard
          title="Despesa Financeira"
          value={formatCurrencyFull(summary.totalExpenses)}
          tooltip="Saidas financeiras da aba Despesa"
          deltaPct={showComparisons ? execData.comparison.expensePaid.deltaPct : undefined}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="red"
          deltaPositiveIsGood={false}
        />
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Margem"
          value={marginValue}
          tooltip="Lucro dividido pela Receita Recebida"
          deltaPP={showComparisons ? execData.comparison.margin.deltaPP : undefined}
          icon={<Percent className="h-5 w-5" />}
          accent={(execData.summary.margin ?? 0) >= 0 ? 'blue' : 'red'}
          deltaPositiveIsGood
        />
        <KPICard
          title="Contas a Receber"
          value={formatCurrencyFull(summary.pendingReceivables)}
          tooltip="Pendente de recebimento por vencimento no periodo"
          subtext={summary.overdueReceivables > 0 ? `${formatCurrencyFull(summary.overdueReceivables)} vencidos` : undefined}
          deltaPct={showComparisons ? execData.comparison.receivable.deltaPct : undefined}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          accent={summary.overdueReceivables > 0 ? 'amber' : 'emerald'}
        />
        <KPICard
          title="Contas a Pagar"
          value={formatCurrencyFull(summary.pendingPayables)}
          tooltip="Pendente de pagamento por vencimento no periodo"
          subtext={summary.overduePayables > 0 ? `${formatCurrencyFull(summary.overduePayables)} vencidos` : undefined}
          deltaPct={showComparisons ? execData.comparison.payable.deltaPct : undefined}
          icon={<Receipt className="h-5 w-5" />}
          accent={summary.overduePayables > 0 ? 'amber' : 'slate'}
        />
        <KPICard
          title="Investimentos"
          value={formatCurrencyFull(financialSummary?.investments ?? 0)}
          tooltip="Total de investimentos no periodo"
          icon={<PiggyBank className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      {/* ── Layer Modules: Financeiro + Operacional ── */}
      {financialSummary || operationalSummary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {financialSummary ? (
            <LayerModule
              title="Camada Financeira"
              subtitle="Caixa canônico: Receita, Despesa e Investimentos"
              accentColor="border-l-emerald-500"
              icon={<Wallet className="h-4 w-4 text-emerald-600" />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniKPI label="Entradas" value={formatCurrencyFull(financialSummary.revenue)} colorClass="text-emerald-600" icon={<TrendingUp className="h-3.5 w-3.5" />} />
                <MiniKPI label="Saídas" value={formatCurrencyFull(financialSummary.expense)} colorClass="text-red-600" icon={<TrendingDown className="h-3.5 w-3.5" />} />
                <MiniKPI label="Investimentos" value={formatCurrencyFull(financialSummary.investments)} colorClass="text-blue-600" icon={<PiggyBank className="h-3.5 w-3.5" />} />
                <MiniKPI
                  label="Saldo após investimentos"
                  value={formatCurrencyFull(financialSummary.netCashAfterInvestments)}
                  colorClass={financialSummary.netCashAfterInvestments >= 0 ? 'text-emerald-600' : 'text-red-600'}
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  highlight
                />
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                {financialSummary.entryCount} lançamentos no período
              </div>
            </LayerModule>
          ) : null}
          {operationalSummary ? (
            <LayerModule
              title="Camada Operacional"
              subtitle="Cobrança e custos da frota (OperationalSnapshot)"
              accentColor="border-l-amber-500"
              icon={<Truck className="h-4 w-4 text-amber-600" />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniKPI label="Receita operacional" value={formatCurrencyFull(operationalSummary.revenueReceived)} colorClass="text-emerald-600" icon={<TrendingUp className="h-3.5 w-3.5" />} />
                <MiniKPI label="Custo operacional" value={formatCurrencyFull(operationalSummary.operationalCost)} colorClass="text-amber-600" icon={<TrendingDown className="h-3.5 w-3.5" />} />
                <MiniKPI label="Valor a cobrar" value={formatCurrencyFull(operationalSummary.amountToCharge)} colorClass="text-foreground" icon={<Target className="h-3.5 w-3.5" />} />
                <MiniKPI
                  label="Resultado operacional"
                  value={formatCurrencyFull(operationalSummary.netOperational)}
                  colorClass={operationalSummary.netOperational >= 0 ? 'text-emerald-600' : 'text-red-600'}
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  highlight
                  subtext={operationalSummary.pendingReceivables > 0 ? `${formatCurrencyFull(operationalSummary.pendingReceivables)} em aberto` : undefined}
                />
              </div>
              {/* Fleet & Quality Summary */}
              <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{operationalSummary.snapshotCount} snapshots</span>
                {operationalSummary.fleetStates.length > 0 ? (
                  operationalSummary.fleetStates.slice(0, 3).map((fs) => (
                    <span key={fs.status} className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">{fs.status}: {fs.count}</span>
                  ))
                ) : null}
              </div>
            </LayerModule>
          ) : null}
        </div>
      ) : null}

      {/* ── Quality Alerts (if applicable) ── */}
      {operationalSummary && hasQualityAlerts(operationalSummary.qualitySummary) ? (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-foreground">Alertas de Qualidade</h4>
          </div>
          <div className="flex flex-wrap gap-3">
            {operationalSummary.qualitySummary.REVIEW_REQUIRED > 0 && (
              <QualityBadge label="Revisão necessária" count={operationalSummary.qualitySummary.REVIEW_REQUIRED} variant="error" />
            )}
            {operationalSummary.qualitySummary.WARNING > 0 && (
              <QualityBadge label="Alertas" count={operationalSummary.qualitySummary.WARNING} variant="warning" />
            )}
            {operationalSummary.qualitySummary.UNKNOWN > 0 && (
              <QualityBadge label="Desconhecido" count={operationalSummary.qualitySummary.UNKNOWN} variant="neutral" />
            )}
            {operationalSummary.qualitySummary.OK > 0 && (
              <QualityBadge label="OK" count={operationalSummary.qualitySummary.OK} variant="success" />
            )}
          </div>
        </div>
      ) : null}

      {/* ── Charts Row 1: Revenue vs Expense + Profit Evolution ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Receita vs Despesa" subtitle={`Por ${bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mes'}`}>
          {execData.series.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={execData.series} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'incomeReceived' ? 'Receita' : 'Despesa']}
                    labelFormatter={(label) => label}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend formatter={(value) => (value === 'incomeReceived' ? 'Receita' : 'Despesa')} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="incomeReceived" name="incomeReceived" fill={CHART_COLORS.revenue} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expensePaid" name="expensePaid" fill={CHART_COLORS.expenses} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState heightClass="h-[300px]" message={isEmptyState ? 'Nenhum dado importado ainda para compor este grafico.' : 'Nenhum dado no periodo selecionado'} actionHref={emptyState?.actionHref} actionLabel={emptyState?.actionLabel} />
          )}
        </ChartCard>

        <ChartCard title="Evolucao do Lucro" subtitle={`Lucro (Caixa) por ${bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mes'}`}>
          {execData.series.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={execData.series} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="bucketLabel" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), 'Lucro']}
                    labelFormatter={(label) => label}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend formatter={() => 'Lucro (Caixa)'} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="profitCash" name="profitCash" stroke={CHART_COLORS.accent} strokeWidth={2.5} fill="url(#profitGradient)" dot={{ fill: CHART_COLORS.accent, strokeWidth: 2, r: 3 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState heightClass="h-[300px]" message={isEmptyState ? 'Nenhum dado importado ainda para acompanhar a evolucao do lucro.' : 'Nenhum dado no periodo selecionado'} actionHref={emptyState?.actionHref} actionLabel={emptyState?.actionLabel} />
          )}
        </ChartCard>
      </div>

      {/* ── Drivers: Por que mudou? ── */}
      <ChartCard title="Por que mudou?" subtitle="Top 5 categorias de despesa vs período anterior" icon={<HelpCircle className="h-4 w-4 text-muted-foreground" />}>
        {execData.drivers.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-5">
            {execData.drivers.map((driver, index) => (
              <div key={driver.categoryId ?? driver.categoryName} className="rounded-lg border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                  <span className="truncate text-xs font-medium text-muted-foreground" title={driver.categoryName}>{driver.categoryName}</span>
                </div>
                <p className="text-lg font-bold text-foreground tracking-tight">{formatCurrency(driver.totalPaid)}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <DeltaIndicator value={driver.deltaValue} pct={driver.deltaPct} positiveIsGood={false} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelState compact message={isEmptyState ? 'As categorias de despesa aparecerao aqui assim que os arquivos forem importados.' : 'Nenhuma variacao relevante no periodo selecionado'} actionHref={emptyState?.actionHref} actionLabel={emptyState?.actionLabel} />
        )}
      </ChartCard>

      {/* ── Charts Row 2: Fluxo de Caixa + Top Categorias ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ChartCard title="Fluxo de Caixa Diario" subtitle="Evolucao de receitas, despesas e saldo">
            {cashflow.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflow} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => formatCurrencyFull(value)}
                      labelFormatter={(label) => formatDateDisplay(label)}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="revenue" name="Receitas" stroke={CHART_COLORS.revenue} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Despesas" stroke={CHART_COLORS.expenses} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="balance" name="Saldo" stroke={CHART_COLORS.accent} strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanelState heightClass="h-[320px]" message={isEmptyState ? 'O fluxo de caixa diario ficara disponivel depois da primeira importacao.' : 'Nenhum dado no periodo selecionado'} actionHref={emptyState?.actionHref} actionLabel={emptyState?.actionLabel} />
            )}
          </ChartCard>
        </div>

        <div className="lg:col-span-3">
          <ChartCard title="Top Categorias" subtitle="Maiores gastos por categoria">
            {topCategories.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategories} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={55} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => formatCurrencyFull(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Bar dataKey="total" name="Total Gasto" radius={[0, 6, 6, 0]}>
                      {topCategories.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanelState heightClass="h-[320px]" message={isEmptyState ? 'As maiores categorias de gasto aparecerao aqui apos a importacao dos arquivos.' : 'Nenhum dado no periodo selecionado'} actionHref={emptyState?.actionHref} actionLabel={emptyState?.actionLabel} />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function DashboardEmptyBanner({ emptyState }: { emptyState: DashboardEmptyState }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-5">
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
          className="inline-flex items-center justify-center rounded-md bg-[#022D44] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#011f30]"
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
    <div
      className={`flex items-center justify-center rounded-md bg-muted/20 text-muted-foreground ${
        compact ? 'min-h-[120px]' : heightClass ?? 'h-[280px]'
      }`}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-4 text-center">
        <Info className="h-5 w-5 text-[#022D44]" />
        <p className="text-sm">{message}</p>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="text-sm font-medium text-[#022D44] underline underline-offset-4">
            {actionLabel}
          </Link>
        ) : null}
      </div>
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

const ACCENT_MAP: Record<string, { bg: string; text: string; valueTxt: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', valueTxt: 'text-emerald-600' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-600',     valueTxt: 'text-red-600' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600',    valueTxt: 'text-blue-600' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600',   valueTxt: 'text-amber-600' },
  slate:   { bg: 'bg-[#022D44]/10',   text: 'text-[#022D44]',   valueTxt: '' },
};

function KPICard({
  title,
  value,
  icon,
  subtext,
  tooltip,
  deltaPct,
  deltaValue,
  deltaPP,
  deltaPositiveIsGood = true,
  accent = 'slate',
  featured = false,
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
  subtext?: string;
  tooltip?: string;
  deltaPct?: number | null;
  deltaValue?: number | null;
  deltaPP?: number | null;
  deltaPositiveIsGood?: boolean;
  accent?: string;
  featured?: boolean;
}) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.slate;

  const getDeltaColor = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined) return 'text-muted-foreground';
    if (deltaPositiveIsGood) {
      return delta >= 0 ? 'text-emerald-600' : 'text-red-600';
    }
    return delta >= 0 ? 'text-red-600' : 'text-emerald-600';
  };

  const renderDelta = () => {
    if (deltaPP !== undefined) {
      return (
        <p className={`mt-1.5 text-xs ${getDeltaColor(deltaPP)}`}>
          {formatDeltaPP(deltaPP)} vs periodo anterior
        </p>
      );
    }

    if (deltaPct !== undefined) {
      return (
        <p className={`mt-1.5 text-xs ${getDeltaColor(deltaPct)}`}>
          {deltaValue !== undefined && deltaValue !== null ? <span className="mr-1">{formatDeltaValue(deltaValue)}</span> : null}
          <span>({formatDeltaPct(deltaPct)}) vs ant.</span>
        </p>
      );
    }

    return null;
  };

  return (
    <div className={`group rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-all hover:shadow-md ${featured ? 'ring-1 ring-border/60 md:col-span-1' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {tooltip ? (
              <div className="group/tip relative">
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/50" />
                <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border bg-popover px-3 py-1.5 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-lg transition-all group-hover/tip:visible group-hover/tip:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${a.valueTxt}`}>{value}</p>
          {renderDelta()}
          {subtext ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {subtext}
            </p>
          ) : null}
        </div>
        <div className={`rounded-lg p-2.5 ${a.bg} ${a.text} transition-transform group-hover:scale-105`}>{icon}</div>
      </div>
    </div>
  );
}

/* ── Layer Module card ── */
function LayerModule({
  title,
  subtitle,
  accentColor,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  accentColor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border-l-4 ${accentColor} border bg-card p-5 shadow-sm`}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Mini KPI for layer modules ── */
function MiniKPI({
  label,
  value,
  colorClass,
  icon,
  highlight = false,
  subtext,
}: {
  label: string;
  value: string;
  colorClass: string;
  icon: React.ReactNode;
  highlight?: boolean;
  subtext?: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-muted/30 ring-1 ring-border/40' : 'bg-muted/10'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colorClass}>{icon}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-base font-bold tracking-tight ${colorClass}`}>{value}</p>
      {subtext ? <p className="mt-0.5 text-[10px] text-amber-600">{subtext}</p> : null}
    </div>
  );
}

/* ── Chart card wrapper ── */
function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Quality badge ── */
function QualityBadge({ label, count, variant }: { label: string; count: number; variant: 'error' | 'warning' | 'neutral' | 'success' }) {
  const styles: Record<string, string> = {
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-muted text-muted-foreground border-border',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${styles[variant]}`}>
      {label}
      <span className="font-semibold">{count}</span>
    </span>
  );
}

/* ── Delta indicator for drivers ── */
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

/* ── Quality alert check ── */
function hasQualityAlerts(qs: { REVIEW_REQUIRED: number; WARNING: number; UNKNOWN: number; OK: number }): boolean {
  return qs.REVIEW_REQUIRED > 0 || qs.WARNING > 0 || qs.UNKNOWN > 0;
}
