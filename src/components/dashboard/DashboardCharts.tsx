'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { TrendingUp, TrendingDown, AlertTriangle, Loader2, Wallet, Receipt, Info, ArrowDownCircle, Percent, HelpCircle } from 'lucide-react';
import { parseDateRangeFromParams, formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';

// Type for bucket granularity
type BucketGranularity = 'day' | 'week' | 'month';

// Types for executive dashboard API response (must match backend response)
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
  };
  comparison: {
    incomeReceived: { prev: number; deltaValue: number; deltaPct: number | null };
    expensePaid: { prev: number; deltaValue: number; deltaPct: number | null };
    profitCash: { prev: number; deltaValue: number; deltaPct: number | null };
    margin: { prev: number | null; deltaPP: number | null };
  };
  series: ExecSeriesPoint[];
  drivers: CategoryDriver[];
  dateRange: { from: string; to: string };
  previousRange: { from: string; to: string };
  bucket: BucketGranularity;
}

// Unified metrics from the new endpoint
interface UnifiedMetrics {
  current: {
    income: {
      received: number;
      receivable: number;
      overdue: number;
      receivedCount: number;
      receivableCount: number;
      overdueCount: number;
    };
    expense: {
      paid: number;
      payable: number;
      overdue: number;
      paidCount: number;
      payableCount: number;
      overdueCount: number;
    };
    netCash: number;
    dateRange: { from: string; to: string };
  };
  previous: {
    income: { received: number; receivable: number; overdue: number };
    expense: { paid: number; payable: number; overdue: number };
    netCash: number;
  };
  delta: {
    receivedDelta: number;
    receivedDeltaPct: number | null;
    paidDelta: number;
    paidDeltaPct: number | null;
    netCashDelta: number;
    netCashDeltaPct: number | null;
    receivableDelta: number;
    receivableDeltaPct: number | null;
    payableDelta: number;
    payableDeltaPct: number | null;
  };
}

interface DashboardData {
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
  delta?: {
    receivedDeltaPct: number | null;
    paidDeltaPct: number | null;
    netCashDeltaPct: number | null;
    receivableDeltaPct: number | null;
    payableDeltaPct: number | null;
  };
  error?: string;
}

// Granularity selector labels
const GRANULARITY_OPTIONS: { value: BucketGranularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

// ClikFinance palette colors for charts
const CHART_COLORS = {
  primary: '#022D44',    // Azul petróleo
  accent: '#A8CF4C',     // Verde ClikCar
  revenue: '#22c55e',    // Verde receitas
  expenses: '#ef4444',   // Vermelho despesas
  balance: '#022D44',    // Azul petróleo para saldo
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
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function DashboardCharts() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [execData, setExecData] = useState<ExecDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketGranularity>('week');

  const dateRange = parseDateRangeFromParams(searchParams);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          from: dateRange.from,
          to: dateRange.to,
        });
        
        const execParams = new URLSearchParams({
          from: dateRange.from,
          to: dateRange.to,
          bucket,
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Dashboard] Fetching with params:', { 
            from: dateRange.from, 
            to: dateRange.to, 
            bucket,
            url: `/api/dashboard/exec?${execParams.toString()}`
          });
        }
        
        // Fetch all endpoints in parallel (no-store to prevent caching when bucket changes)
        const [dashboardRes, unifiedRes, execRes] = await Promise.all([
          fetch(`/api/dashboard?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/metrics/unified?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/dashboard/exec?${execParams.toString()}`, { cache: 'no-store' }),
        ]);
        
        if (!dashboardRes.ok) {
          throw new Error('Falha ao carregar dados');
        }
        
        const dashboardJson = await dashboardRes.json();
        const unifiedJson: UnifiedMetrics = await unifiedRes.json();
        const execJson: ExecDashboardResponse = await execRes.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Dashboard] Exec response:', { 
            bucket: execJson.bucket, 
            seriesLength: execJson.series.length,
            firstBucket: execJson.series[0]?.bucketLabel,
            lastBucket: execJson.series[execJson.series.length - 1]?.bucketLabel,
          });
        }
        
        // Merge unified metrics into dashboard data
        const mergedData: DashboardData = {
          ...dashboardJson,
          summary: {
            // Use unified metrics for consistent calculations
            totalRevenue: unifiedJson.current?.income?.received ?? dashboardJson.summary?.totalRevenue ?? 0,
            totalExpenses: unifiedJson.current?.expense?.paid ?? dashboardJson.summary?.totalExpenses ?? 0,
            netProfit: unifiedJson.current?.netCash ?? dashboardJson.summary?.netProfit ?? 0,
            pendingPayables: unifiedJson.current?.expense?.payable ?? dashboardJson.summary?.pendingPayables ?? 0,
            overduePayables: unifiedJson.current?.expense?.overdue ?? dashboardJson.summary?.overduePayables ?? 0,
            pendingReceivables: unifiedJson.current?.income?.receivable ?? 0,
            overdueReceivables: unifiedJson.current?.income?.overdue ?? 0,
          },
          delta: unifiedJson.delta,
        };
        
        setData(mergedData);
        setExecData(execJson);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [dateRange.from, dateRange.to, bucket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px] text-destructive">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, cashflow, topCategories } = data;

  return (
    <div className="space-y-6">
      {/* Header with Granularity Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Painel Executivo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Visão caixa: Receita Recebida × Despesa Paga</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Granularity Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (process.env.NODE_ENV === 'development') {
                    console.debug('[Dashboard] Bucket changed to:', opt.value);
                  }
                  setBucket(opt.value);
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  bucket === opt.value
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <DateRangeBadge from={dateRange.from} to={dateRange.to} />
        </div>
      </div>

      {/* Executive KPI Cards - Top Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="Lucro (Caixa)" 
          value={formatCurrencyFull(execData?.summary.profitCash ?? summary.netProfit)}
          tooltip="Receita Recebida − Despesa Paga no período"
          deltaPct={execData?.comparison.profitCash.deltaPct ?? data.delta?.netCashDeltaPct}
          deltaValue={execData?.comparison.profitCash.deltaValue}
          icon={<Wallet className="w-5 h-5" />}
          iconBg={(execData?.summary.profitCash ?? summary.netProfit) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={(execData?.summary.profitCash ?? summary.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"}
          valueColor={(execData?.summary.profitCash ?? summary.netProfit) >= 0 ? 'text-emerald-600' : 'text-red-600'}
          deltaPositiveIsGood={true}
        />
        <KPICard 
          title="Margem" 
          value={execData?.summary.margin != null ? `${execData.summary.margin.toFixed(1)}%` : '—'}
          tooltip="Lucro ÷ Receita Recebida"
          deltaPP={execData?.comparison.margin.deltaPP}
          icon={<Percent className="w-5 h-5" />}
          iconBg={(execData?.summary.margin ?? 0) >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}
          iconColor={(execData?.summary.margin ?? 0) >= 0 ? "text-blue-600" : "text-red-600"}
          valueColor={(execData?.summary.margin ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}
          deltaPositiveIsGood={true}
        />
        <KPICard 
          title="Receita Recebida" 
          value={formatCurrencyFull(summary.totalRevenue)}
          tooltip="Valor efetivamente recebido no período"
          deltaPct={execData?.comparison.incomeReceived.deltaPct ?? data.delta?.receivedDeltaPct}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
          deltaPositiveIsGood={true}
        />
        <KPICard 
          title="Despesa Paga" 
          value={formatCurrencyFull(summary.totalExpenses)}
          tooltip="Valor efetivamente pago no período"
          deltaPct={execData?.comparison.expensePaid.deltaPct ?? data.delta?.paidDeltaPct}
          icon={<TrendingDown className="w-5 h-5" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
          valueColor="text-red-600"
          deltaPositiveIsGood={false}
        />
      </div>

      {/* Secondary KPI Cards - Receivables/Payables */}
      <div className="grid gap-4 md:grid-cols-2">
        <KPICard 
          title="Contas a Receber" 
          value={formatCurrencyFull(summary.pendingReceivables)}
          tooltip="Pendente de recebimento (por vencimento no período)"
          subtext={summary.overdueReceivables > 0 ? `${formatCurrencyFull(summary.overdueReceivables)} vencidos` : undefined}
          deltaPct={data.delta?.receivableDeltaPct}
          icon={<ArrowDownCircle className="w-5 h-5" />}
          iconBg={summary.overdueReceivables > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}
          iconColor={summary.overdueReceivables > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <KPICard 
          title="Contas a Pagar" 
          value={formatCurrencyFull(summary.pendingPayables)}
          tooltip="Pendente de pagamento (por vencimento no período)"
          subtext={summary.overduePayables > 0 ? `${formatCurrencyFull(summary.overduePayables)} vencidos` : undefined}
          deltaPct={data.delta?.payableDeltaPct}
          icon={<Receipt className="w-5 h-5" />}
          iconBg={summary.overduePayables > 0 ? "bg-amber-500/10" : "bg-[#022D44]/10"}
          iconColor={summary.overduePayables > 0 ? "text-amber-600" : "text-[#022D44]"}
        />
      </div>

      {/* Executive Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart: Receita vs Despesa by Bucket */}
        <div className="border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Receita vs Despesa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Por {bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mês'}</p>
            </div>
          </div>
          {execData?.series && execData.series.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={execData.series} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="bucketLabel"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrencyFull(value),
                      name === 'incomeReceived' ? 'Receita' : 'Despesa'
                    ]}
                    labelFormatter={(label) => label}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend formatter={(value) => value === 'incomeReceived' ? 'Receita' : 'Despesa'} />
                  <Bar dataKey="incomeReceived" name="incomeReceived" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expensePaid" name="expensePaid" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>

        {/* Line Chart: Lucro Evolution */}
        <div className="border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Evolução do Lucro</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Lucro (Caixa) por {bucket === 'day' ? 'dia' : bucket === 'week' ? 'semana' : 'mês'}</p>
            </div>
          </div>
          {execData?.series && execData.series.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={execData.series} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="bucketLabel"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                  />
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
            <div className="h-[280px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>
      </div>

      {/* Por que mudou? Drivers Block */}
      {execData?.drivers && execData.drivers.length > 0 && (
        <div className="border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Por que mudou?</h3>
            <span className="text-xs text-muted-foreground">Top 5 categorias de despesa vs período anterior</span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {execData.drivers.map((driver, index) => (
              <div 
                key={driver.categoryId ?? driver.categoryName}
                className="p-4 rounded-lg border bg-muted/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-foreground truncate" title={driver.categoryName}>
                    {driver.categoryName}
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(driver.totalPaid)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${
                    (driver.deltaValue ?? 0) > 0 ? 'text-red-600' : (driver.deltaValue ?? 0) < 0 ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}>
                    {(driver.deltaValue ?? 0) > 0 ? '+' : ''}{formatCurrency(driver.deltaValue ?? 0)}
                  </span>
                  {driver.deltaPct !== null && (
                    <span className={`text-xs ${
                      driver.deltaPct > 0 ? 'text-red-500' : driver.deltaPct < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}>
                      ({driver.deltaPct > 0 ? '+' : ''}{driver.deltaPct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Charts Row (Optional - Detailed View) */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-4 border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Fluxo de Caixa Diário</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução de receitas, despesas e saldo</p>
            </div>
          </div>
          {cashflow.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflow} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatShortDate}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                  />
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
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Receitas"
                    stroke={CHART_COLORS.revenue}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expenses" 
                    name="Despesas"
                    stroke={CHART_COLORS.expenses}
                    strokeWidth={2}
                    dot={false}
                  />
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
            <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>

        {/* Top Categories Chart */}
        <div className="lg:col-span-3 border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Top Categorias</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Maiores gastos por categoria</p>
            </div>
          </div>
          {topCategories.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={topCategories} 
                  layout="vertical" 
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="category"
                    className="text-xs"
                    width={75}
                    tick={{ fontSize: 11 }}
                  />
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
            <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
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
  if (value === null || value === undefined) return '—';
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
  valueColor = ''
}: { 
  title: string; 
  value: string; 
  icon?: React.ReactNode;
  subtext?: string;
  tooltip?: string;
  deltaPct?: number | null;
  deltaValue?: number | null;
  deltaPP?: number | null; // percentage points delta
  deltaPositiveIsGood?: boolean;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}) {
  // Determine delta color based on whether positive is good or bad
  const getDeltaColor = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined) return 'text-muted-foreground';
    if (deltaPositiveIsGood) {
      return delta >= 0 ? 'text-emerald-600' : 'text-red-600';
    } else {
      return delta >= 0 ? 'text-red-600' : 'text-emerald-600';
    }
  };

  // Render delta information
  const renderDelta = () => {
    // Percentage points delta (for margin)
    if (deltaPP !== undefined) {
      return (
        <p className={`text-xs mt-1 ${getDeltaColor(deltaPP)}`}>
          {formatDeltaPP(deltaPP)} vs período anterior
        </p>
      );
    }
    // Standard percentage delta with optional absolute value
    if (deltaPct !== undefined) {
      return (
        <p className={`text-xs mt-1 ${getDeltaColor(deltaPct)}`}>
          {deltaValue !== undefined && deltaValue !== null && (
            <span className="mr-1">{formatDeltaValue(deltaValue)}</span>
          )}
          <span>({formatDeltaPct(deltaPct)}) vs ant.</span>
        </p>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {tooltip && (
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded-md text-xs text-popover-foreground whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                  {tooltip}
                </div>
              </div>
            )}
          </div>
          <p className={`text-2xl font-bold mt-2 ${valueColor}`}>{value}</p>
          {renderDelta()}
          {subtext && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {subtext}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

