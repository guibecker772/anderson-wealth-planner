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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Painel Executivo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Visao financeira e operacional sem dupla contagem</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleBucketChange(opt.value)}
                disabled={loading}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  bucket === opt.value
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${loading ? 'opacity-70' : ''}`}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Resultado Financeiro"
          value={formatCurrencyFull(execData.summary.profitCash ?? summary.netProfit)}
          tooltip="Entradas financeiras menos despesas financeiras do periodo"
          deltaPct={showComparisons ? execData.comparison.profitCash.deltaPct : undefined}
          deltaValue={showComparisons ? execData.comparison.profitCash.deltaValue : undefined}
          icon={<Wallet className="h-5 w-5" />}
          iconBg={(execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          iconColor={(execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'text-emerald-600' : 'text-red-600'}
          valueColor={(execData.summary.profitCash ?? summary.netProfit) >= 0 ? 'text-emerald-600' : 'text-red-600'}
          deltaPositiveIsGood
        />
        <KPICard
          title="Margem"
          value={marginValue}
          tooltip="Lucro dividido pela Receita Recebida"
          deltaPP={showComparisons ? execData.comparison.margin.deltaPP : undefined}
          icon={<Percent className="h-5 w-5" />}
          iconBg={(execData.summary.margin ?? 0) >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}
          iconColor={(execData.summary.margin ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}
          valueColor={(execData.summary.margin ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}
          deltaPositiveIsGood
        />
        <KPICard
          title="Receita Financeira"
          value={formatCurrencyFull(summary.totalRevenue)}
          tooltip="Entradas do ledger financeiro (aba Receita)"
          deltaPct={showComparisons ? execData.comparison.incomeReceived.deltaPct : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
          deltaPositiveIsGood
        />
        <KPICard
          title="Despesa Financeira"
          value={formatCurrencyFull(summary.totalExpenses)}
          tooltip="Saidas financeiras da aba Despesa"
          deltaPct={showComparisons ? execData.comparison.expensePaid.deltaPct : undefined}
          icon={<TrendingDown className="h-5 w-5" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
          valueColor="text-red-600"
          deltaPositiveIsGood={false}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KPICard
          title="Contas a Receber"
          value={formatCurrencyFull(summary.pendingReceivables)}
          tooltip="Pendente de recebimento por vencimento no periodo"
          subtext={summary.overdueReceivables > 0 ? `${formatCurrencyFull(summary.overdueReceivables)} vencidos` : undefined}
          deltaPct={showComparisons ? execData.comparison.receivable.deltaPct : undefined}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          iconBg={summary.overdueReceivables > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
          iconColor={summary.overdueReceivables > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <KPICard
          title="Contas a Pagar"
          value={formatCurrencyFull(summary.pendingPayables)}
          tooltip="Pendente de pagamento por vencimento no periodo"
          subtext={summary.overduePayables > 0 ? `${formatCurrencyFull(summary.overduePayables)} vencidos` : undefined}
          deltaPct={showComparisons ? execData.comparison.payable.deltaPct : undefined}
          icon={<Receipt className="h-5 w-5" />}
          iconBg={summary.overduePayables > 0 ? 'bg-amber-500/10' : 'bg-[#022D44]/10'}
          iconColor={summary.overduePayables > 0 ? 'text-amber-600' : 'text-[#022D44]'}
        />
      </div>

      {financialSummary || operationalSummary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {financialSummary ? (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Camada Financeira</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Caixa canônico do workbook: Receita, Despesa e Investimentos
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <KPICard title="Entradas" value={formatCurrencyFull(financialSummary.revenue)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-500/10" iconColor="text-emerald-600" valueColor="text-emerald-600" />
                <KPICard title="Saidas" value={formatCurrencyFull(financialSummary.expense)} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-red-500/10" iconColor="text-red-600" valueColor="text-red-600" />
                <KPICard title="Investimentos" value={formatCurrencyFull(financialSummary.investments)} icon={<Receipt className="h-5 w-5" />} iconBg="bg-[#022D44]/10" iconColor="text-[#022D44]" />
                <KPICard title="Saldo apos investimentos" value={formatCurrencyFull(financialSummary.netCashAfterInvestments)} icon={<Wallet className="h-5 w-5" />} iconBg="bg-blue-500/10" iconColor="text-blue-600" valueColor={financialSummary.netCashAfterInvestments >= 0 ? 'text-blue-600' : 'text-red-600'} />
              </div>
            </div>
          ) : null}
          {operationalSummary ? (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Camada Operacional</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cobranca e custos da frota vindos de OperationalSnapshot
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <KPICard title="Receita operacional" value={formatCurrencyFull(operationalSummary.revenueReceived)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-emerald-500/10" iconColor="text-emerald-600" valueColor="text-emerald-600" />
                <KPICard title="Custo operacional" value={formatCurrencyFull(operationalSummary.operationalCost)} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-amber-500/10" iconColor="text-amber-600" valueColor="text-amber-600" />
                <KPICard title="Valor a cobrar" value={formatCurrencyFull(operationalSummary.amountToCharge)} icon={<ArrowDownCircle className="h-5 w-5" />} iconBg="bg-[#022D44]/10" iconColor="text-[#022D44]" />
                <KPICard title="Resultado operacional" value={formatCurrencyFull(operationalSummary.netOperational)} icon={<Wallet className="h-5 w-5" />} iconBg="bg-blue-500/10" iconColor="text-blue-600" valueColor={operationalSummary.netOperational >= 0 ? 'text-blue-600' : 'text-red-600'} subtext={operationalSummary.pendingReceivables > 0 ? `${formatCurrencyFull(operationalSummary.pendingReceivables)} em aberto` : undefined} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Receita vs Despesa</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Por {bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mes'}
              </p>
            </div>
          </div>
          {execData.series.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={execData.series} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bucketLabel" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrencyFull(value),
                      name === 'incomeReceived' ? 'Receita' : 'Despesa',
                    ]}
                    labelFormatter={(label) => label}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend formatter={(value) => (value === 'incomeReceived' ? 'Receita' : 'Despesa')} />
                  <Bar dataKey="incomeReceived" name="incomeReceived" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expensePaid" name="expensePaid" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState
              heightClass="h-[280px]"
              message={
                isEmptyState
                  ? 'Nenhum dado importado ainda para compor este grafico.'
                  : 'Nenhum dado no periodo selecionado'
              }
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Evolucao do Lucro</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lucro (Caixa) por {bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mes'}
              </p>
            </div>
          </div>
          {execData.series.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={execData.series} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bucketLabel" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                  <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), 'Lucro']}
                    labelFormatter={(label) => label}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend formatter={() => 'Lucro (Caixa)'} />
                  <Line
                    type="monotone"
                    dataKey="profitCash"
                    name="profitCash"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2.5}
                    dot={{ fill: CHART_COLORS.accent, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState
              heightClass="h-[280px]"
              message={
                isEmptyState
                  ? 'Nenhum dado importado ainda para acompanhar a evolucao do lucro.'
                  : 'Nenhum dado no periodo selecionado'
              }
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Por que mudou?</h3>
          <span className="text-xs text-muted-foreground">Top 5 categorias de despesa vs periodo anterior</span>
        </div>
        {execData.drivers.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-5">
            {execData.drivers.map((driver, index) => (
              <div key={driver.categoryId ?? driver.categoryName} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <span className="truncate text-sm font-medium text-foreground" title={driver.categoryName}>
                    {driver.categoryName}
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(driver.totalPaid)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      (driver.deltaValue ?? 0) > 0
                        ? 'text-red-600'
                        : (driver.deltaValue ?? 0) < 0
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {(driver.deltaValue ?? 0) > 0 ? '+' : ''}
                    {formatCurrency(driver.deltaValue ?? 0)}
                  </span>
                  {driver.deltaPct !== null ? (
                    <span
                      className={`text-xs ${
                        driver.deltaPct > 0
                          ? 'text-red-500'
                          : driver.deltaPct < 0
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                      }`}
                    >
                      ({driver.deltaPct > 0 ? '+' : ''}
                      {driver.deltaPct.toFixed(1)}%)
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanelState
            compact
            message={
              isEmptyState
                ? 'As categorias de despesa aparecerao aqui assim que os arquivos forem importados.'
                : 'Nenhuma variacao relevante no periodo selecionado'
            }
            actionHref={emptyState?.actionHref}
            actionLabel={emptyState?.actionLabel}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Fluxo de Caixa Diario</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Evolucao de receitas, despesas e saldo</p>
            </div>
          </div>
          {cashflow.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflow} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    labelFormatter={(label) => formatDateDisplay(label)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Receitas" stroke={CHART_COLORS.revenue} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Despesas" stroke={CHART_COLORS.expenses} strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Saldo"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState
              heightClass="h-[300px]"
              message={
                isEmptyState
                  ? 'O fluxo de caixa diario ficara disponivel depois da primeira importacao.'
                  : 'Nenhum dado no periodo selecionado'
              }
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Top Categorias</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Maiores gastos por categoria</p>
            </div>
          </div>
          {topCategories.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                  <YAxis type="category" dataKey="category" className="text-xs" width={75} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyFull(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total" name="Total Gasto" radius={[0, 4, 4, 0]}>
                    {topCategories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanelState
              heightClass="h-[300px]"
              message={
                isEmptyState
                  ? 'As maiores categorias de gasto aparecerao aqui apos a importacao dos arquivos.'
                  : 'Nenhum dado no periodo selecionado'
              }
              actionHref={emptyState?.actionHref}
              actionLabel={emptyState?.actionLabel}
            />
          )}
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
  iconBg = 'bg-muted',
  iconColor = 'text-foreground',
  valueColor = '',
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
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}) {
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
        <p className={`mt-1 text-xs ${getDeltaColor(deltaPP)}`}>
          {formatDeltaPP(deltaPP)} vs periodo anterior
        </p>
      );
    }

    if (deltaPct !== undefined) {
      return (
        <p className={`mt-1 text-xs ${getDeltaColor(deltaPct)}`}>
          {deltaValue !== undefined && deltaValue !== null ? <span className="mr-1">{formatDeltaValue(deltaValue)}</span> : null}
          <span>({formatDeltaPct(deltaPct)}) vs ant.</span>
        </p>
      );
    }

    return null;
  };

  return (
    <div className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {tooltip ? (
              <div className="group relative">
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
          {renderDelta()}
          {subtext ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {subtext}
            </p>
          ) : null}
        </div>
        <div className={`rounded-lg p-2.5 ${iconBg} ${iconColor}`}>{icon}</div>
      </div>
    </div>
  );
}
