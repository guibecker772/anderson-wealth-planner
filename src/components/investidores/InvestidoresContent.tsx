'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Users, 
  Loader2, 
  AlertTriangle, 
  ChevronRight,
  Car,
  TrendingUp,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { parseDateRangeFromParams } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';

// ============================================================================
// TYPES
// ============================================================================

interface Investor {
  id: string;
  name: string;
  vehicles: string[];
}

interface InvestorListData {
  investors: Investor[];
  total: number;
}

// ============================================================================
// HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InvestidoresContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateRange = parseDateRangeFromParams(searchParams);
  
  const [data, setData] = useState<InvestorListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/investors');
        
        if (!res.ok) {
          throw new Error('Falha ao carregar investidores');
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
  }, []);

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

  const handleInvestorClick = (investorId: string) => {
    const params = new URLSearchParams({
      from: dateRange.from,
      to: dateRange.to,
    });
    router.push(`/investidores/${investorId}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Configuração Pendente</p>
            <p className="text-xs text-amber-700 mt-1">
              O mapeamento investidor ↔ veículos está usando dados de exemplo. 
              Para configurar os dados reais, edite o arquivo <code className="bg-amber-200/50 px-1 rounded">src/lib/analytics/investor-metrics.ts</code> 
              ou crie um arquivo de configuração <code className="bg-amber-200/50 px-1 rounded">data/investors.json</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">{data?.total || 0} investidores cadastrados</span>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      {/* Investors Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.investors.map((investor) => (
          <div 
            key={investor.id}
            onClick={() => handleInvestorClick(investor.id)}
            className="rounded-xl border bg-card shadow-sm p-5 hover:shadow-md hover:border-[#A8CF4C]/50 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-[#022D44]">
                  {investor.name}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Car className="w-4 h-4" />
                  <span>{investor.vehicles.length} veículo(s)</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {investor.vehicles.slice(0, 3).map((plate) => (
                    <span 
                      key={plate}
                      className="px-2 py-0.5 bg-muted text-xs font-mono rounded"
                    >
                      {plate}
                    </span>
                  ))}
                  {investor.vehicles.length > 3 && (
                    <span className="px-2 py-0.5 bg-muted text-xs rounded">
                      +{investor.vehicles.length - 3}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#A8CF4C] transition-colors" />
            </div>
          </div>
        ))}

        {(!data?.investors || data.investors.length === 0) && (
          <div className="col-span-full flex flex-col items-center justify-center h-[200px] bg-muted/20 rounded-xl">
            <Users className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum investidor cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure o mapeamento de investidores para começar
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <h4 className="font-medium text-sm mb-3">Métricas disponíveis por investidor</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-muted-foreground">Retorno via Locação</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-muted-foreground">Custos de Manutenção</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-muted-foreground">Multas e Infrações</span>
          </div>
        </div>
      </div>
    </div>
  );
}
