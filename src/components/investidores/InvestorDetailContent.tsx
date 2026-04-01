'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Car,
  Landmark,
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
        <p>{error || 'Investidor nao encontrado'}</p>
        <Link
          href={`/investidores?from=${dateRange.from}&to=${dateRange.to}`}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Voltar para lista
        </Link>
      </div>
    );
  }

  const { investor, totals, vehicles, financialLinks, allocationSummary } = data;
  const isPositiveOperational = totals.operationalResult >= 0;
  const isPositiveExpanded = totals.expandedResult >= 0;

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
            {investor.vehicles.length} veiculo(s) vinculado(s)
          </p>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title="Receita Operacional"
          value={formatCurrencyFull(totals.operationalRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KPICard
          title="Custo Operacional"
          value={formatCurrencyFull(totals.operationalCost)}
          icon={<Wrench className="w-5 h-5" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          valueColor="text-blue-600"
          subtext={`Multas op.: ${formatCurrencyFull(totals.operationalFines)} • Desc.: ${formatCurrencyFull(totals.operationalDiscount)}`}
        />
        <KPICard
          title="Resultado Operacional"
          value={formatCurrencyFull(totals.operationalResult)}
          icon={isPositiveOperational ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          iconBg={isPositiveOperational ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={isPositiveOperational ? "text-emerald-600" : "text-red-600"}
          valueColor={isPositiveOperational ? "text-emerald-600" : "text-red-600"}
        />
        <KPICard
          title="Entrada Financeira"
          value={formatCurrencyFull(totals.identifiedFinancialInflow)}
          icon={<Landmark className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KPICard
          title="Saída Financeira"
          value={formatCurrencyFull(totals.identifiedFinancialOutflow)}
          icon={<Landmark className="w-5 h-5" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
          subtext={`${allocationSummary.linkedEntryCount} vínculo(s) auditáveis`}
        />
        <KPICard
          title="Resultado Expandido"
          value={formatCurrencyFull(totals.expandedResult)}
          icon={isPositiveExpanded ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          iconBg={isPositiveExpanded ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={isPositiveExpanded ? "text-emerald-600" : "text-red-600"}
          valueColor={isPositiveExpanded ? "text-emerald-600" : "text-red-600"}
          subtext="Operacional + financeiro identificado"
        />
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Detalhamento Operacional por Veiculo</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Situacao</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Recebido</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Custos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Multas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((vehicle) => {
                const isPositive = vehicle.netResult >= 0;
                const warningCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
                return (
                  <tr key={vehicle.plate} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-medium">{vehicle.plate}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" size="sm">
                          {vehicle.status}
                        </Badge>
                        {warningCount > 0 && (
                          <Badge variant="warning" size="sm">
                            {warningCount} alerta(s)
                          </Badge>
                        )}
                      </div>
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
                    Nenhum veiculo encontrado para este investidor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Vínculos Financeiros Identificados</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Apenas lançamentos com nome explícito do investidor em contexto financeiro entram aqui.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Grupo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Detalhe</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Regra</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {financialLinks.map((link) => (
                <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{link.entryDate}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <div>{link.groupRaw || '-'}</div>
                      <div className="text-xs text-muted-foreground">{link.categoryRaw || link.accountRaw || '-'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="space-y-0.5">
                      <div className="truncate">{link.detailRaw || '-'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {link.sourceSheetName} • linha {link.sourceRowNumber}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="space-y-0.5">
                      <div>{link.ruleLabel}</div>
                      <div className="text-xs text-muted-foreground truncate">{link.rationale}</div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${link.direction === 'OUTFLOW' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrencyFull(link.amount)}
                  </td>
                </tr>
              ))}
              {financialLinks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum lançamento financeiro com vínculo confiável foi identificado para este investidor
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
          <li>Receita operacional usa `Valor Pago (Semana)` da base operacional.</li>
          <li>Custo operacional inclui manutencao, desconto e `Multa/atraso` operacional.</li>
          <li>Financeiro identificado só considera vínculo forte e auditável por nome explícito do investidor.</li>
          <li>Não entram no resultado individual: impostos, juros, despesa fixa, não identificado, repasses ambíguos e multas oficiais sem `Quem Pagou`.</li>
          <li>{allocationSummary.linkageCoverageNote}</li>
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
