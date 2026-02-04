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
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { 
  AlertTriangle, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Car,
  Receipt,
  Hash,
} from 'lucide-react';
import { parseDateRangeFromParams, formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// TYPES
// ============================================================================

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
  aitCode: string | null;
  amount: number;
  status: string;
  paidBy: string;
  description: string | null;
  counterparty: string | null;
  category: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const CHART_COLORS = {
  fines: '#f59e0b',
};

const VEHICLE_COLORS = [
  '#022D44', '#A8CF4C', '#3b82f6', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#ef4444', '#22c55e'
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

function formatPct(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getPaidByLabel(paidBy: string): string {
  switch (paidBy) {
    case 'COMPANY': return 'Empresa';
    case 'LESSOR': return 'Locador';
    case 'UNKNOWN': return 'Indefinido';
    default: return paidBy;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MultasContent() {
  const searchParams = useSearchParams();
  const dateRange = parseDateRangeFromParams(searchParams);
  
  const [paidByFilter, setPaidByFilter] = useState<'ALL' | 'COMPANY' | 'LESSOR'>('ALL');
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
        const baseParams = new URLSearchParams({
          from: dateRange.from,
          to: dateRange.to,
          paidBy: paidByFilter,
        });

        const [summaryRes, seriesRes, vehiclesRes, finesRes] = await Promise.all([
          fetch(`/api/multas/summary?${baseParams.toString()}`),
          fetch(`/api/multas/series?${baseParams.toString()}`),
          fetch(`/api/multas/vehicles?${baseParams.toString()}&limit=10&sortBy=${sortBy}`),
          fetch(`/api/multas/list?${baseParams.toString()}&page=1&pageSize=10`),
        ]);

        if (!summaryRes.ok || !seriesRes.ok || !vehiclesRes.ok || !finesRes.ok) {
          throw new Error('Falha ao carregar dados');
        }

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
  }, [dateRange.from, dateRange.to, paidByFilter, sortBy]);

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

  const isPositiveDelta = summary?.deltaValue != null && summary.deltaValue >= 0;
  // For fines, increase is negative (more expenses)
  const deltaColor = isPositiveDelta ? 'text-red-600' : 'text-emerald-600';
  const DeltaIcon = isPositiveDelta ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6">
      {/* Filters Row */}
      <div className="flex flex-col md:flex-row gap-3 p-4 bg-card rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-medium text-muted-foreground">Pagador:</span>
          <Select value={paidByFilter} onValueChange={(v) => setPaidByFilter(v as 'ALL' | 'COMPANY' | 'LESSOR')}>
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="COMPANY">Empresa</SelectItem>
              <SelectItem value="LESSOR">Locador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Ordenar por:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'count' | 'value')}>
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Quantidade</SelectItem>
              <SelectItem value="value">Valor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Total em Multas"
          value={formatCurrencyFull(summary?.total || 0)}
          icon={<Receipt className="w-5 h-5" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
        />
        <KPICard
          title="Quantidade de Infrações"
          value={String(summary?.count || 0)}
          icon={<Hash className="w-5 h-5" />}
          iconBg="bg-[#022D44]/10"
          iconColor="text-[#022D44]"
        />
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Variação vs Anterior</p>
              <div className={`flex items-center gap-2 mt-2 ${deltaColor}`}>
                <DeltaIcon className="w-5 h-5" />
                <span className="text-2xl font-bold">{formatPct(summary?.deltaPct ?? null)}</span>
              </div>
              <p className={`text-sm mt-1 ${deltaColor}`}>
                {formatCurrency(summary?.deltaValue || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Evolution Chart */}
        <div className="lg:col-span-4 border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Evolução das Multas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateDisplay(dateRange.from)} até {formatDateDisplay(dateRange.to)}
              </p>
            </div>
          </div>
          {series.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    name="Total"
                    stroke={CHART_COLORS.fines}
                    strokeWidth={2}
                    dot={series.length < 15}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>

        {/* Vehicle Ranking */}
        <div className="lg:col-span-3 border rounded-xl p-6 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-foreground">Veículos com Mais Infrações</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 10 por {sortBy === 'count' ? 'quantidade' : 'valor'}
              </p>
            </div>
            <Car className="w-5 h-5 text-muted-foreground" />
          </div>
          {vehicles.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={vehicles} 
                  layout="vertical" 
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    tickFormatter={(v) => sortBy === 'count' ? String(v) : formatCurrency(v)}
                    className="text-xs"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="plate"
                    className="text-xs"
                    width={55}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      sortBy === 'count' ? `${value} infrações` : formatCurrencyFull(value),
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey={sortBy === 'count' ? 'count' : 'total'} 
                    name={sortBy === 'count' ? 'Infrações' : 'Valor'} 
                    radius={[0, 4, 4, 0]}
                  >
                    {vehicles.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              Nenhum dado no período selecionado
            </div>
          )}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Detalhamento das Multas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mostrando {fines.length} de {totalFines} registros
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">AIT</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pagador</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fines.map((fine) => (
                <tr key={fine.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fine.date ? formatDateDisplay(fine.date) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono">
                    {fine.plate || <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                    {fine.aitCode || <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-amber-600">
                    {formatCurrencyFull(fine.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={fine.status === 'SETTLED' ? 'success' : 'warning'} size="sm">
                      {fine.status === 'SETTLED' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge 
                      variant={fine.paidBy === 'LESSOR' ? 'default' : 'secondary'} 
                      size="sm"
                    >
                      {getPaidByLabel(fine.paidBy)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                    {fine.description || fine.counterparty || '-'}
                  </td>
                </tr>
              ))}
              {fines.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma multa encontrada no período
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
            <p className="text-xs text-muted-foreground mt-2">
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
