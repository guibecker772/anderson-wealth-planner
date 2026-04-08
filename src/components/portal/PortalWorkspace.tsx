'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Car,
  CircleDollarSign,
  DollarSign,
  Eye,
  Gauge,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Badge } from '@/components/ui/badge';
import type { FleetVehicleRow } from '@/lib/analytics/fleet-metrics';
import { getVehicleImageMeta } from '@/lib/portalVehicleMedia';
import { usePortalFleetData } from './usePortalFleetData';

type PortalSection = 'overview' | 'fleet' | 'revenue' | 'expenses' | 'fines';

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

function humanDriverLabel(value: string | null) {
  if (!value || value.trim() === '') return 'Não identificado no período';
  return value;
}

function getStatusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'secondary' {
  const lower = status.toLowerCase();
  if (lower.includes('locado') || lower.includes('ativo')) return 'success';
  if (lower.includes('oficina') || lower.includes('manuten')) return 'warning';
  if (lower.includes('recolhido') || lower.includes('devolvido')) return 'error';
  if (
    lower.includes('preparação') ||
    lower.includes('preparacao') ||
    lower.includes('prepara') ||
    lower.includes('chapeca') ||
    lower.includes('disponível') ||
    lower.includes('disponivel')
  ) {
    return 'info';
  }
  return 'secondary';
}

function getSectionCopy(section: PortalSection) {
  const map = {
    overview: {
      eyebrow: 'Portal do Investidor',
      title: 'Visão Geral da sua carteira',
      description:
        'Leitura rápida da frota, do resultado operacional e dos principais sinais que merecem atenção no período.',
      accent: 'blue' as const,
    },
    fleet: {
      eyebrow: 'Frota / Operações',
      title: 'Frota e operação por veículo',
      description:
        'Acompanhe a carteira com foco em status atual, locatário, qualidade da base e resultado operacional.',
      accent: 'blue' as const,
    },
    revenue: {
      eyebrow: 'Receitas',
      title: 'Receita operacional do período',
      description:
        'Visão simplificada do recebido, do valor a cobrar e dos veículos que mais contribuíram no período.',
      accent: 'green' as const,
    },
    expenses: {
      eyebrow: 'Despesas',
      title: 'Custos operacionais da carteira',
      description:
        'Leitura objetiva dos custos por veículo, com separação entre manutenção, multa/atraso e desconto.',
      accent: 'amber' as const,
    },
    fines: {
      eyebrow: 'Multas',
      title: 'Multas e atrasos operacionais',
      description:
        'Ocorrências do período com foco em veículos impactados e valor total de multa ou atraso na operação.',
      accent: 'amber' as const,
    },
  };

  return map[section];
}

function SummaryCard({
  title,
  value,
  icon,
  description,
  tone = 'slate',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    slate: 'border-slate-200/70 bg-white',
    blue: 'border-[#022D44]/10 bg-[#022D44]/5',
    green: 'border-emerald-200/60 bg-emerald-50/70',
    amber: 'border-amber-200/60 bg-amber-50/70',
    red: 'border-red-200/60 bg-red-50/70',
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#022D44] shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function VehicleTile({ vehicle, href }: { vehicle: FleetVehicleRow; href: string }) {
  const alertCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
  const media = getVehicleImageMeta(vehicle.model);

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[26px] border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]"
    >
      <div className="relative h-44 overflow-hidden bg-[linear-gradient(180deg,#eef6fb,#d8e7ef)]">
        <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(2,45,68,0.14),transparent)]" />
        <div className="absolute left-4 top-4 z-10 rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm">
          {media.label}
        </div>
        <Image src={media.src} alt={media.label} fill className="object-contain px-5 py-5 transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xl font-semibold tracking-tight text-slate-900">{vehicle.plate}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{vehicle.model || media.label}</p>
          </div>
          <Badge variant={getStatusVariant(vehicle.currentStatus)} size="sm">{vehicle.currentStatus}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Locatário</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 leading-5">{humanDriverLabel(vehicle.driver)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recebido</p>
            <p className="mt-1.5 text-sm font-semibold text-emerald-700">{formatCurrency(vehicle.revenueReceived)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Custos</p>
            <p className="mt-1.5 text-sm font-semibold text-red-700">{formatCurrency(vehicle.operationalCost)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resultado</p>
            <p className={`mt-1.5 text-sm font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(vehicle.operationalResult)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{vehicle.snapshotCount} snapshot(s)</span>
          {alertCount > 0 ? <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge> : <Badge variant="success" size="sm">Base OK</Badge>}
        </div>
      </div>
    </Link>
  );
}

function SectionTable({
  title,
  description,
  rows,
  columns,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: FleetVehicleRow[];
  columns: Array<{ key: string; label: string; align?: 'left' | 'right'; render: (row: FleetVehicleRow) => React.ReactNode }>;
  emptyMessage: string;
}) {
  const searchParams = useSearchParams();
  const suffix = searchParams.toString();

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
      <div className="border-b border-slate-200/70 px-6 py-5">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-slate-500">Veículo</th>
              {columns.map((column) => (
                <th key={column.key} className={`px-6 py-4 font-semibold text-slate-500 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.plate} className="border-t border-slate-200/70 transition-colors hover:bg-slate-50/70">
                <td className="px-6 py-4">
                  <Link href={`/portal/veiculos/${encodeURIComponent(row.plate)}${suffix ? `?${suffix}` : ''}`} className="inline-flex flex-col">
                    <span className="font-mono font-semibold text-[#022D44]">{row.plate}</span>
                    <span className="max-w-[220px] truncate text-xs text-slate-500">{row.model || 'Modelo não identificado'}</span>
                  </Link>
                </td>
                {columns.map((column) => (
                  <td key={`${row.plate}-${column.key}`} className={`px-6 py-4 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortalWorkspace({ section }: { section: PortalSection }) {
  const searchParams = useSearchParams();
  const { data, loading, error, dateRange, investorName, isImpersonating } = usePortalFleetData();
  const copy = getSectionCopy(section);

  if (loading) {
    return <div className="flex h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  if (error || !data || !dateRange) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <p className="text-base font-medium text-slate-700">{error || 'Falha ao carregar o portal'}</p>
      </div>
    );
  }

  const { kpis } = data;
  const vehicles = [...data.vehicles];
  const suffix = searchParams.toString();
  const featuredVehicles = [...vehicles].sort((a, b) => b.operationalResult - a.operationalResult).slice(0, 3);
  const vehiclesWithAlerts = [...vehicles]
    .filter((vehicle) => vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED > 0 || vehicle.openAmount > 0)
    .sort((a, b) => (b.qualitySummary.WARNING + b.qualitySummary.REVIEW_REQUIRED + b.openAmount) - (a.qualitySummary.WARNING + a.qualitySummary.REVIEW_REQUIRED + a.openAmount))
    .slice(0, 4);
  const revenueRows = [...vehicles].sort((a, b) => b.revenueReceived - a.revenueReceived);
  const expenseRows = [...vehicles].sort((a, b) => b.operationalCost - a.operationalCost);
  const fineRows = [...vehicles].filter((a) => a.lateFeeCost > 0).sort((a, b) => b.lateFeeCost - a.lateFeeCost);

  const heroMeta = (
    <>
      <Badge variant="info" size="sm">{investorName}</Badge>
      <Badge variant="secondary" size="sm">{kpis.totalVehicles} veículos</Badge>
      <Badge variant="secondary" size="sm">{kpis.totalSnapshots} snapshots</Badge>
    </>
  );

  return (
    <div className="space-y-6">
      {isImpersonating ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <Eye className="h-4 w-4" />
            Visualização como investidor em contexto administrativo
          </div>
          <Link href="/configuracoes/usuarios" className="text-xs font-medium text-amber-700 underline hover:text-amber-900">
            Voltar à Gestão de Acessos
          </Link>
        </div>
      ) : null}

      <PageHero eyebrow={copy.eyebrow} title={copy.title} description={copy.description} accent={copy.accent} meta={heroMeta} />

      {section === 'overview' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Receita operacional" value={formatCurrency(kpis.operationalRevenueReceived)} description="Receita recebida no período da carteira." icon={<TrendingUp className="h-5 w-5" />} tone="green" />
            <SummaryCard title="Custo operacional" value={formatCurrency(kpis.operationalCost)} description="Manutenção, multa/atraso e descontos apurados na operação." icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <SummaryCard title="Valores a cobrar" value={formatCurrency(kpis.amountToCharge)} description="Valor operacional previsto para cobrança no período." icon={<CircleDollarSign className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Resultado operacional" value={formatCurrency(kpis.operationalResult)} description="Resultado do período considerando receita e custos operacionais." icon={<Gauge className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'blue' : 'red'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="border-b border-slate-200/70 px-6 py-5">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Veículos em destaque</h3>
                <p className="mt-1 text-sm text-slate-500">Leitura rápida da carteira com foco em status, resultado e cobertura visual por modelo.</p>
              </div>
              <div className="grid gap-4 p-5 lg:grid-cols-3">
                {featuredVehicles.map((vehicle) => (
                  <VehicleTile key={vehicle.plate} vehicle={vehicle} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#022D44]" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Resumo da frota</h3>
                    <p className="text-sm text-slate-500">Distribuição atual dos veículos no período selecionado.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {kpis.statusDistribution.map((item) => (
                    <div key={item.status} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-4 py-2 text-sm font-medium text-slate-700">
                      <span>{item.status}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Alertas relevantes</h3>
                    <p className="text-sm text-slate-500">Veículos com sinalização de qualidade ou valores em aberto.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {vehiclesWithAlerts.length > 0 ? vehiclesWithAlerts.map((vehicle) => {
                    const alertCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
                    return (
                      <Link key={vehicle.plate} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 transition-colors hover:bg-slate-100/70">
                        <div>
                          <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                          <p className="text-xs text-slate-500">{vehicle.currentStatus}</p>
                        </div>
                        <div className="text-right">
                          {alertCount > 0 ? <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge> : null}
                          {vehicle.openAmount > 0 ? <p className="mt-1 text-xs font-medium text-amber-700">Em aberto: {formatCurrency(vehicle.openAmount)}</p> : null}
                        </div>
                      </Link>
                    );
                  }) : <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">Nenhum alerta relevante para o período.</div>}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {section === 'fleet' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Veículos" value={String(kpis.totalVehicles)} description="Quantidade de placas com leitura operacional no período." icon={<Car className="h-5 w-5" />} tone="blue" />
            <SummaryCard title="Snapshots" value={String(kpis.totalSnapshots)} description="Base operacional consolidada para a carteira." icon={<Gauge className="h-5 w-5" />} tone="slate" />
            <SummaryCard title="A cobrar" value={formatCurrency(kpis.amountToCharge)} description="Valor previsto de cobrança no período." icon={<DollarSign className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Resultado" value={formatCurrency(kpis.operationalResult)} description="Resultado operacional agregado da carteira." icon={<TrendingUp className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'green' : 'red'} />
          </div>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleTile key={vehicle.plate} vehicle={vehicle} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} />
            ))}
          </div>
        </>
      ) : null}

      {section === 'revenue' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Recebido" value={formatCurrency(kpis.operationalRevenueReceived)} description="Receita recebida na operação do período." icon={<TrendingUp className="h-5 w-5" />} tone="green" />
            <SummaryCard title="A cobrar" value={formatCurrency(kpis.amountToCharge)} description="Valor ainda previsto para cobrança operacional." icon={<CircleDollarSign className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Em aberto" value={formatCurrency(kpis.openAmount)} description="Montante que permanece em aberto na leitura operacional." icon={<DollarSign className="h-5 w-5" />} tone="blue" />
            <SummaryCard title="Resultado" value={formatCurrency(kpis.operationalResult)} description="Resultado operacional após os custos do período." icon={<Gauge className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'green' : 'red'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Veículos com maior receita</h3>
              <p className="mt-1 text-sm text-slate-500">Leitura visual dos veículos que mais receberam no período.</p>
              <div className="mt-5 space-y-4">
                {revenueRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">{vehicle.model || 'Modelo não identificado'}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">{formatCurrencyFull(vehicle.revenueReceived)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#0f766e,#34d399)]" style={{ width: `${Math.max(10, (vehicle.revenueReceived / Math.max(revenueRows[0]?.revenueReceived || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SectionTable
              title="Receita por veículo"
              description="Tabela simplificada com foco no recebido, valor a cobrar e resultado operacional."
              rows={revenueRows}
              emptyMessage="Nenhuma receita operacional encontrada no período."
              columns={[
                { key: 'status', label: 'Status', render: (row) => <Badge variant={getStatusVariant(row.currentStatus)} size="sm">{row.currentStatus}</Badge> },
                { key: 'received', label: 'Recebido', align: 'right', render: (row) => <span className="font-medium text-emerald-700">{formatCurrencyFull(row.revenueReceived)}</span> },
                { key: 'charge', label: 'A cobrar', align: 'right', render: (row) => <span className="font-medium text-amber-700">{formatCurrencyFull(row.amountToCharge)}</span> },
                { key: 'result', label: 'Resultado', align: 'right', render: (row) => <span className={row.operationalResult >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{formatCurrencyFull(row.operationalResult)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}

      {section === 'expenses' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Custos totais" value={formatCurrency(kpis.operationalCost)} description="Custo operacional agregado da carteira." icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <SummaryCard title="Manutenção" value={formatCurrency(kpis.maintenanceCost)} description="Custo operacional de manutenção por motorista." icon={<Wrench className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Multa / atraso" value={formatCurrency(kpis.lateFeeCost)} description="Impacto de multas e atrasos na operação." icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Descontos" value={formatCurrency(kpis.discountCost)} description="Descontos aplicados no período operacional." icon={<DollarSign className="h-5 w-5" />} tone="blue" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Despesas mais relevantes</h3>
              <p className="mt-1 text-sm text-slate-500">Veículos com maior peso de custo no período.</p>
              <div className="mt-5 space-y-4">
                {expenseRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">Manutenção {formatCurrency(vehicle.maintenanceCost)} • Multa {formatCurrency(vehicle.lateFeeCost)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{formatCurrencyFull(vehicle.operationalCost)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#ef4444,#fb923c)]" style={{ width: `${Math.max(10, (vehicle.operationalCost / Math.max(expenseRows[0]?.operationalCost || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SectionTable
              title="Custos por veículo"
              description="Visão objetiva dos componentes de custo operacional do período."
              rows={expenseRows}
              emptyMessage="Nenhum custo operacional encontrado no período."
              columns={[
                { key: 'maintenance', label: 'Manutenção', align: 'right', render: (row) => <span className="text-slate-700">{formatCurrencyFull(row.maintenanceCost)}</span> },
                { key: 'latefee', label: 'Multa / atraso', align: 'right', render: (row) => <span className="text-red-700">{formatCurrencyFull(row.lateFeeCost)}</span> },
                { key: 'discount', label: 'Desconto', align: 'right', render: (row) => <span className="text-slate-700">{formatCurrencyFull(row.discountCost)}</span> },
                { key: 'total', label: 'Custo total', align: 'right', render: (row) => <span className="font-medium text-red-700">{formatCurrencyFull(row.operationalCost)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}

      {section === 'fines' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Multas / atrasos" value={formatCurrency(kpis.lateFeeCost)} description="Impacto total de multa ou atraso na operação do período." icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Veículos impactados" value={String(fineRows.length)} description="Quantidade de placas com multa ou atraso operacional." icon={<Car className="h-5 w-5" />} tone="blue" />
            <SummaryCard title="Snapshots impactados" value={String(fineRows.reduce((acc, vehicle) => acc + vehicle.snapshotCount, 0))} description="Volume de snapshots associados às placas impactadas." icon={<ShieldAlert className="h-5 w-5" />} tone="slate" />
            <SummaryCard title="Peso no custo" value={kpis.operationalCost > 0 ? `${Math.round((kpis.lateFeeCost / kpis.operationalCost) * 100)}%` : '0%'} description="Participação das multas e atrasos no custo operacional." icon={<Gauge className="h-5 w-5" />} tone="red" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Ocorrências por veículo</h3>
              <p className="mt-1 text-sm text-slate-500">Veículos mais impactados por multa ou atraso operacional.</p>
              <div className="mt-5 space-y-4">
                {fineRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">{humanDriverLabel(vehicle.driver)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{formatCurrencyFull(vehicle.lateFeeCost)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#d97706,#f59e0b)]" style={{ width: `${Math.max(10, (vehicle.lateFeeCost / Math.max(fineRows[0]?.lateFeeCost || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SectionTable
              title="Multas e atrasos"
              description="Tabela simples para leitura rápida por placa, status atual e impacto financeiro."
              rows={fineRows}
              emptyMessage="Nenhuma multa ou atraso operacional encontrado no período."
              columns={[
                { key: 'driver', label: 'Locatário', render: (row) => <span className="text-slate-700">{humanDriverLabel(row.driver)}</span> },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={getStatusVariant(row.currentStatus)} size="sm">{row.currentStatus}</Badge> },
                { key: 'alerts', label: 'Qualidade', render: (row) => { const count = row.qualitySummary.WARNING + row.qualitySummary.REVIEW_REQUIRED; return count > 0 ? <Badge variant="warning" size="sm">{count} alerta(s)</Badge> : <Badge variant="success" size="sm">OK</Badge>; } },
                { key: 'fine', label: 'Valor', align: 'right', render: (row) => <span className="font-medium text-red-700">{formatCurrencyFull(row.lateFeeCost)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
