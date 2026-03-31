'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Car,
  TrendingUp,
  TrendingDown,
  Wrench,
} from 'lucide-react';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import type { InvestorMetrics } from '@/lib/analytics/investor-metrics';

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface InvestorDetailContentProps {
  data: InvestorMetrics | null;
  dateRange: { from: string; to: string };
  error?: string | null;
}

export function InvestorDetailContent({ data, dateRange, error }: InvestorDetailContentProps) {
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-destructive">
        <AlertTriangle className="w-8 h-8 mb-3" />
        <p>{error || 'Investidor nÃ£o encontrado'}</p>
        <Link
          href={`/investidores?from=${dateRange.from}&to=${dateRange.to}`}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        >
          â† Voltar para lista
        </Link>
      </div>
    );
  }

  const { investor, totals, vehicles } = data;
  const isPositiveResult = totals.netResult >= 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/investidores?from=${dateRange.from}&to=${dateRange.to}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para lista
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {investor.name}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {investor.vehicles.length} veÃ­culo(s) vinculado(s)
          </p>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Retorno LocaÃ§Ã£o"
          value={formatCurrencyFull(totals.rentalIncome)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KPICard
          title="ManutenÃ§Ã£o"
          value={formatCurrencyFull(totals.maintenanceCost)}
          icon={<Wrench className="w-5 h-5" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          valueColor="text-blue-600"
        />
        <KPICard
          title="Multas"
          value={formatCurrencyFull(totals.finesCost)}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
        />
        <KPICard
          title="Resultado LÃ­quido"
          value={formatCurrencyFull(totals.netResult)}
          icon={isPositiveResult ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          iconBg={isPositiveResult ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={isPositiveResult ? "text-emerald-600" : "text-red-600"}
          valueColor={isPositiveResult ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Detalhamento por VeÃ­culo</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SituaÃ§Ã£o</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">LocaÃ§Ã£o</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">ManutenÃ§Ã£o</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Multas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((vehicle) => {
                const isPositive = vehicle.netResult >= 0;
                return (
                  <tr key={vehicle.plate} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-medium">{vehicle.plate}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="secondary" size="sm">
                        {vehicle.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-emerald-600">
                      {formatCurrencyFull(vehicle.rentalIncome)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-blue-600">
                      {formatCurrencyFull(vehicle.maintenanceCost)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-amber-600">
                      {formatCurrencyFull(vehicle.finesCost)}
                    </td>
                    <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrencyFull(vehicle.netResult)}
                    </td>
                  </tr>
                );
              })}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum veÃ­culo encontrado para este investidor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl border p-4">
        <h4 className="font-medium text-sm mb-2">Notas</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>â€¢ <strong>LocaÃ§Ã£o:</strong> Receitas com tipo &quot;LocaÃ§Ã£o&quot; vinculadas ao veÃ­culo</li>
          <li>â€¢ <strong>ManutenÃ§Ã£o:</strong> Despesas das categorias de manutenÃ§Ã£o/reparos</li>
          <li>â€¢ <strong>Multas:</strong> Despesas da categoria Multas-Correios-Detran</li>
          <li>â€¢ <strong>SituaÃ§Ã£o:</strong> Campo placeholder - definiÃ§Ã£o pendente de regra de negÃ³cio</li>
        </ul>
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
