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
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Loader2, Wallet, Receipt } from 'lucide-react';
import { parseDateRangeFromParams, formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    pendingPayables: number;
    overduePayables: number;
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
  error?: string;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        const res = await fetch(`/api/dashboard?${params.toString()}`);
        
        if (!res.ok) {
          throw new Error('Falha ao carregar dados');
        }
        
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [dateRange.from, dateRange.to]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Visão Geral</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Resumo financeiro do período</p>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="Receita Realizada" 
          value={formatCurrencyFull(summary.totalRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KPICard 
          title="Despesa Paga" 
          value={formatCurrencyFull(summary.totalExpenses)}
          icon={<TrendingDown className="w-5 h-5" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
          valueColor="text-red-600"
        />
        <KPICard 
          title="Resultado do Período" 
          value={formatCurrencyFull(summary.netProfit)}
          icon={<Wallet className="w-5 h-5" />}
          iconBg={summary.netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
          valueColor={summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
        <KPICard 
          title="Contas a Pagar" 
          value={formatCurrencyFull(summary.pendingPayables)}
          subtext={summary.overduePayables > 0 ? `${formatCurrencyFull(summary.overduePayables)} vencidos` : undefined}
          icon={<Receipt className="w-5 h-5" />}
          iconBg={summary.overduePayables > 0 ? "bg-amber-500/10" : "bg-[#022D44]/10"}
          iconColor={summary.overduePayables > 0 ? "text-amber-600" : "text-[#022D44]"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-4 border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Fluxo de Caixa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução de receitas e despesas</p>
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

function KPICard({ 
  title, 
  value, 
  icon, 
  subtext,
  iconBg = 'bg-muted',
  iconColor = 'text-foreground',
  valueColor = ''
}: { 
  title: string; 
  value: string; 
  icon?: React.ReactNode;
  subtext?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-2 ${valueColor}`}>{value}</p>
          {subtext && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
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
