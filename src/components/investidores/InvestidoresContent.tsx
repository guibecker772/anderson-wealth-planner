'use client';

import { useRouter } from 'next/navigation';
import {
  Users,
  AlertTriangle,
  ChevronRight,
  Car,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import type { InvestorListResponse } from '@/lib/analytics/investor-metrics';

interface InvestidoresContentProps {
  data: InvestorListResponse;
  dateRange: { from: string; to: string };
  error?: string | null;
}

export function InvestidoresContent({ data, dateRange, error }: InvestidoresContentProps) {
  const router = useRouter();

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
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">{data.total} investidores identificados</span>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.investors.map((investor) => (
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
                  <span>{investor.vehicles.length} veiculo(s)</span>
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

        {data.investors.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center h-[200px] bg-muted/20 rounded-xl">
            <Users className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum investidor encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              A base operacional ainda nao trouxe proprietarios normalizados suficientes
            </p>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <h4 className="font-medium text-sm mb-3">Indicadores operacionais por investidor</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-muted-foreground">Receita recebida por veiculo</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-muted-foreground">Custos operacionais derivados</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-md bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-muted-foreground">Multas e alertas de qualidade</span>
          </div>
        </div>
      </div>
    </div>
  );
}
