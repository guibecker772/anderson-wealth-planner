'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Car, Landmark, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import type { InvestorMetrics } from '@/lib/analytics/investor-metrics';

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface InvestorDetailContentProps {
  data: InvestorMetrics | null;
  dateRange: { from: string; to: string };
  error?: string | null;
}

export function InvestorDetailContent({ data, dateRange, error }: InvestorDetailContentProps) {
  if (error || !data) {
    return (
      <div className="premium-empty h-[400px]">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p>{error || 'Investidor nao encontrado'}</p>
        <Link href={`/investidores?from=${dateRange.from}&to=${dateRange.to}`} className="text-sm font-medium text-[#022D44] underline underline-offset-4">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const { investor, totals, vehicles, financialLinks, allocationSummary } = data;
  const isPositiveOperational = totals.operationalResult >= 0;
  const isPositiveExpanded = totals.expandedResult >= 0;

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between">
        <Link href={`/investidores?from=${dateRange.from}&to=${dateRange.to}`} className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm text-slate-600 shadow-sm hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Voltar para lista
        </Link>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="editorial-panel px-7 py-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/72">Ficha do investidor</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">{investor.name}</h1>
            <p className="mt-2 text-sm text-white/82">{investor.vehicles.length} veiculo(s) vinculado(s) na carteira operacional.</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Cobertura de vinculacao</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{allocationSummary.linkageCoverageNote}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Receita operacional" value={formatCurrencyFull(totals.operationalRevenue)} tone="emerald" icon={<TrendingUp className="h-5 w-5" />} />
        <SummaryCard title="Custo operacional" value={formatCurrencyFull(totals.operationalCost)} tone="blue" icon={<Wrench className="h-5 w-5" />} subtext={`Multas op.: ${formatCurrencyFull(totals.operationalFines)} | Desc.: ${formatCurrencyFull(totals.operationalDiscount)}`} />
        <SummaryCard title="Resultado operacional" value={formatCurrencyFull(totals.operationalResult)} tone={isPositiveOperational ? 'emerald' : 'red'} icon={isPositiveOperational ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} />
        <SummaryCard title="Entrada financeira" value={formatCurrencyFull(totals.identifiedFinancialInflow)} tone="emerald" icon={<Landmark className="h-5 w-5" />} />
        <SummaryCard title="Saida financeira" value={formatCurrencyFull(totals.identifiedFinancialOutflow)} tone="amber" icon={<Landmark className="h-5 w-5" />} subtext={`${allocationSummary.linkedEntryCount} vinculo(s) auditaveis`} />
        <SummaryCard title="Resultado expandido" value={formatCurrencyFull(totals.expandedResult)} tone={isPositiveExpanded ? 'emerald' : 'red'} icon={isPositiveExpanded ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} subtext="Operacional + financeiro identificado" />
      </div>

      <div className="data-table-shell">
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-6 py-5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Detalhamento operacional por veiculo</h2>
            <p className="mt-1 text-sm text-slate-500">Recebido, custos, multas e resultado individual da frota do investidor.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Placa</th>
                <th className="px-6 py-4 text-left font-semibold text-slate-500">Situacao</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Recebido</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Custos</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Multas</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-500">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const warningCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
                return (
                  <tr key={vehicle.plate} className="border-t border-slate-200/70">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{vehicle.plate}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" size="sm">{vehicle.status}</Badge>
                        {warningCount > 0 ? <Badge variant="warning" size="sm">{warningCount} alerta(s)</Badge> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right value-income">{formatCurrencyFull(vehicle.rentalIncome)}</td>
                    <td className="px-6 py-4 text-right value-expense">{formatCurrencyFull(vehicle.maintenanceCost)}</td>
                    <td className="px-6 py-4 text-right value-expense">{formatCurrencyFull(vehicle.finesCost)}</td>
                    <td className={`px-6 py-4 text-right font-medium ${vehicle.netResult >= 0 ? 'value-income' : 'value-expense'}`}>{formatCurrencyFull(vehicle.netResult)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="data-table-shell">
          <div className="flex items-center gap-3 border-b border-slate-200/70 px-6 py-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Vinculos financeiros identificados</h2>
              <p className="mt-1 text-sm text-slate-500">Somente lancamentos com nome explicito do investidor em contexto financeiro entram aqui.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500">Data</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500">Grupo</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500">Detalhe</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500">Regra</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-500">Valor</th>
                </tr>
              </thead>
              <tbody>
                {financialLinks.map((link) => (
                  <tr key={link.id} className="border-t border-slate-200/70">
                    <td className="px-6 py-4">{link.entryDate}</td>
                    <td className="px-6 py-4">
                      <div>{link.groupRaw || '-'}</div>
                      <div className="text-xs text-slate-500">{link.categoryRaw || link.accountRaw || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="truncate">{link.detailRaw || '-'}</div>
                      <div className="text-xs text-slate-500">{link.sourceSheetName} | linha {link.sourceRowNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{link.ruleLabel}</div>
                      <div className="text-xs text-slate-500">{link.rationale}</div>
                    </td>
                    <td className={`px-6 py-4 text-right font-medium ${link.direction === 'OUTFLOW' ? 'value-expense' : 'value-income'}`}>
                      {formatCurrencyFull(link.amount)}
                    </td>
                  </tr>
                ))}
                {financialLinks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      Nenhum lancamento financeiro com vinculo confiavel foi identificado para este investidor.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="module-surface module-surface-financial">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/22 bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-white">Notas de leitura</h2>
              <p className="text-white/88">O resultado individual nao tenta fingir completude onde ainda nao existe vinculacao confiavel.</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm leading-7 text-white/92">
            <li>Receita operacional usa Valor Pago (Semana) da base operacional.</li>
            <li>Custo operacional inclui manutencao, desconto e multa/atraso operacional.</li>
            <li>Financeiro identificado so considera vinculo forte e auditavel por nome explicito do investidor.</li>
            <li>Impostos, juros, despesa fixa, nao identificado, repasses ambiguos e multas oficiais sem Quem Pagou seguem fora do resultado individual.</li>
            <li className="text-white/84">{allocationSummary.linkageCoverageNote}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  subtext,
  tone,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  subtext?: string;
  tone: 'emerald' | 'red' | 'amber' | 'blue';
}) {
  const toneClass = {
    emerald: 'from-emerald-500/12 to-white text-emerald-700',
    red: 'from-red-500/12 to-white text-red-700',
    amber: 'from-amber-500/12 to-white text-amber-700',
    blue: 'from-sky-500/12 to-white text-sky-700',
  }[tone];

  return (
    <div className={`card-premium bg-gradient-to-br ${toneClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</p>
          <p className="metric-value-fluid mt-3 text-slate-900">{value}</p>
          {subtext ? <p className="mt-2 text-xs text-slate-500">{subtext}</p> : null}
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}
