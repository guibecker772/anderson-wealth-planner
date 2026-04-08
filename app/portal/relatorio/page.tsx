import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Car,
  Clock3,
  FileText,
  Gauge,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PortalReportAnnex } from '@/components/portal/PortalReportAnnex';
import { PortalReportActions } from '@/components/portal/PortalReportActions';
import { getFleetData, type FleetStatusCount } from '@/lib/analytics/fleet-metrics';
import { getSessionUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { resolvePortalDateRange } from '@/lib/portalDateRange';
import { buildPortalInvestorReportData } from '@/lib/portal-report';
import { getVehicleImageMeta } from '@/lib/portalVehicleMedia';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatPeriodLabel(from: string, to: string): string {
  return `${formatDateLabel(from)} até ${formatDateLabel(to)}`;
}

function getQualityLabel(warning: number, reviewRequired: number) {
  const total = warning + reviewRequired;
  if (reviewRequired > 0) return `${total} revisão(ões)`;
  if (warning > 0) return `${total} alerta(s)`;
  return 'OK';
}

function getStatusColor(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('locado') || lower.includes('ativo')) return '#a4d65e';
  if (lower.includes('prepar') || lower.includes('oficina') || lower.includes('manuten')) return '#ffc107';
  if (lower.includes('sinistro') || lower.includes('recolhido') || lower.includes('devolvido')) return '#d32f2f';
  return '#5b7085';
}

function isGenericVehicleMedia(src: string): boolean {
  return src.endsWith('/default.svg');
}

function buildStatusDonut(statuses: FleetStatusCount[]) {
  const total = statuses.reduce((acc, item) => acc + item.count, 0);
  const circumference = 2 * Math.PI * 44;
  let offset = 0;

  return statuses.map((item) => {
    const ratio = total > 0 ? item.count / total : 0;
    const length = circumference * ratio;
    const segment = {
      status: item.status,
      count: item.count,
      color: getStatusColor(item.status),
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
    };
    offset += length;
    return segment;
  });
}

interface Props {
  searchParams?: {
    from?: string;
    to?: string;
    _as?: string;
  };
}

export default async function PortalReportPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const impersonateId = searchParams?._as ?? null;
  const isImpersonating = user.role === 'ADMIN' && Boolean(impersonateId);
  const investorId = user.role === 'INVESTOR' ? user.investorId : impersonateId;

  if (!investorId) redirect('/portal');

  const dateRange = await resolvePortalDateRange(db, {
    investorId,
    from: searchParams?.from ?? null,
    to: searchParams?.to ?? null,
  });

  const fleet = await getFleetData(db, dateRange, investorId);
  const investor = await db.investor.findUnique({
    where: { id: investorId },
    select: { displayName: true },
  });

  const report = buildPortalInvestorReportData(fleet);
  const investorName = investor?.displayName || user.investorName || user.name || 'Investidor';
  const generatedAt = formatDateTimeLabel(new Date());
  const periodLabel = formatPeriodLabel(dateRange.from, dateRange.to);

  const query = new URLSearchParams();
  query.set('from', dateRange.from);
  query.set('to', dateRange.to);
  if (isImpersonating && impersonateId) query.set('_as', impersonateId);
  const backHref = `/portal?${query.toString()}`;
  const pdfHref = `/api/portal/report/pdf?${query.toString()}`;
  const donutSegments = buildStatusDonut(fleet.kpis.statusDistribution);
  const featuredGridClass = report.featuredVehicles.length <= 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-3';

  return (
    <div className="portal-report-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
        <PortalReportActions backHref={backHref} pdfHref={pdfHref} />

        <div className="portal-report-sheet space-y-6">
          <section className="report-page--portrait report-cover overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <div className="report-page-shell flex min-h-[940px] flex-col">
              <div className="report-cover-hero px-10 py-10 text-white">
                <div className="space-y-14">
                  <div className="flex items-start justify-between gap-6">
                    <div className="space-y-5">
                      <Image src="/brand/clikcar-signature.svg" alt="Clik Car" width={184} height={52} className="h-11 w-auto" unoptimized />
                      <div className="inline-flex rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                        ClikFinance
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/12 bg-white/7 px-5 py-4 text-right backdrop-blur-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Relatório gerado em</p>
                      <p className="mt-2 text-sm font-medium text-white/88">{generatedAt}</p>
                    </div>
                  </div>

                  <div className="max-w-3xl space-y-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#a4d65e]">
                      Relatório individual do investidor
                    </p>
                    <h1 className="max-w-2xl text-5xl font-semibold leading-[1.04] tracking-tight">
                      Performance institucional da carteira.
                    </h1>
                    <p className="max-w-2xl text-lg leading-8 text-white/78">
                      Visão executiva da operação da frota, leitura financeira do período e consolidado analítico por veículo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="report-cover-content flex flex-1 flex-col justify-between gap-8 bg-white px-10 py-10 text-slate-900">
                <div className="grid gap-6 rounded-[32px] border border-slate-200/80 bg-white p-8 text-slate-900 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Carteira</p>
                    <h2 className="text-3xl font-semibold tracking-tight">{investorName}</h2>
                    <p className="max-w-xl text-sm leading-7 text-slate-500">
                      Documento preparado para acompanhamento institucional da carteira do investidor, com foco em resultado operacional, saúde da frota e anexo analítico de apoio.
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-6 sm:grid-cols-2">
                    <ReportMetaCard label="Período" value={periodLabel} />
                    <ReportMetaCard label="Gerado em" value={generatedAt} />
                    <ReportMetaCard label="Veículos" value={`${fleet.kpis.totalVehicles} placa(s)`} />
                    <ReportMetaCard label="Snapshots" value={`${fleet.kpis.totalSnapshots} leitura(s)`} />
                  </div>
                </div>

                <ReportFooter brand="ClikFinance / ClikCar" meta="Documento confidencial de acompanhamento da carteira" />
              </div>
            </div>
          </section>

          <section className="report-page--portrait report-executive overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <div className="report-page-shell report-page-shell--executive space-y-8 px-10 py-10">
              <ReportPageHeader title="Painel Executivo" meta={periodLabel} accent="Resultado operacional do período" />

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="report-executive-hero rounded-[32px] border border-[#a4d65e]/30 bg-[linear-gradient(180deg,#13344a_0%,#0f2439_100%)] p-8 text-white shadow-[0_18px_48px_rgba(15,36,57,0.2)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55">Resultado Operacional Líquido</p>
                  <div className="mt-8 flex items-end justify-between gap-6">
                    <div>
                      <p className="text-6xl font-semibold tracking-tight text-[#a4d65e]">{formatCurrency(fleet.kpis.operationalResult)}</p>
                      <p className="mt-4 max-w-md text-sm leading-7 text-white/72">
                        Indicador principal do período, refletindo a diferença entre receita operacional recebida e custos operacionais da carteira.
                      </p>
                    </div>
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/8 text-[#a4d65e]">
                      <Gauge className="h-8 w-8" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ExecutiveMetricCard
                    title="Receita Operacional"
                    value={formatCurrency(fleet.kpis.operationalRevenueReceived)}
                    icon={<TrendingUp className="h-5 w-5" />}
                    tone="green"
                  />
                  <ExecutiveMetricCard
                    title="Custos Operacionais"
                    value={formatCurrency(fleet.kpis.operationalCost)}
                    icon={<TrendingDown className="h-5 w-5" />}
                    tone="red"
                  />
                  <ExecutiveMetricCard title="Veículos" value={String(fleet.kpis.totalVehicles)} icon={<Car className="h-5 w-5" />} tone="slate" />
                  <ExecutiveMetricCard title="Snapshots" value={String(fleet.kpis.totalSnapshots)} icon={<FileText className="h-5 w-5" />} tone="slate" />
                  <div className="md:col-span-2">
                    <ExecutiveMetricCard
                      title="Valores a Cobrar"
                      value={formatCurrency(fleet.kpis.amountToCharge)}
                      icon={<Clock3 className="h-5 w-5" />}
                      tone="amber"
                    />
                  </div>
                </div>
              </div>

              <div className="report-executive-summary grid gap-5 rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura executiva</p>
                  <p className="text-sm leading-7 text-slate-600">
                    A carteira encerra o período com {fleet.kpis.totalVehicles} veículos monitorados e {fleet.kpis.totalSnapshots} snapshots operacionais consolidados. O principal ponto de leitura é a relação entre resultado líquido, pressão de custos e valores ainda em aberto.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ReportMetaCard
                    label="Receita x custos"
                    value={fleet.kpis.operationalRevenueReceived >= fleet.kpis.operationalCost ? 'Receita acima dos custos' : 'Custos pressionando o período'}
                  />
                  <ReportMetaCard
                    label="Cobrança"
                    value={fleet.kpis.amountToCharge > 0 ? 'Há valores pendentes' : 'Sem pendências relevantes'}
                  />
                  <ReportMetaCard
                    label="Qualidade"
                    value={report.alertGroups.some((group) => group.key === 'quality') ? 'Revisões pontuais na base' : 'Leitura estável'}
                  />
                </div>
              </div>

              <ReportFooter brand="Painel executivo" meta={investorName} />
            </div>
          </section>

          <section className="report-page--portrait report-fleet-health overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <div className="report-page-shell report-page-shell--fleet space-y-7 px-10 py-10">
              <ReportPageHeader title="Saúde da Frota e Alertas" meta={periodLabel} accent="Distribuição operacional, alertas e destaques da carteira" />

              <div className="grid gap-6 xl:grid-cols-[0.74fr_1.26fr]">
                <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-7">
                  <div className="mb-6 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-[#0f2439]" />
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Distribuição de status</h3>
                      <p className="text-sm text-slate-500">Leitura consolidada da frota por status relevante.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                    <div className="report-donut relative h-56 w-56 shrink-0">
                      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                        <circle cx="60" cy="60" r="44" fill="none" stroke="#d9e2ea" strokeWidth="16" />
                        {donutSegments.map((segment) => (
                          <circle
                            key={segment.status}
                            cx="60"
                            cy="60"
                            r="44"
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="16"
                            strokeLinecap="butt"
                            strokeDasharray={segment.dasharray}
                            strokeDashoffset={segment.dashoffset}
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Frota</p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{fleet.kpis.totalVehicles}</p>
                        <p className="text-xs text-slate-500">veículo(s)</p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      {donutSegments.map((segment) => (
                        <div key={segment.status} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span className="text-sm font-medium text-slate-700">{segment.status}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{segment.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-7">
                  <div className="mb-6 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-[#0f2439]" />
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Alertas consolidados</h3>
                      <p className="text-sm text-slate-500">Agrupamento executivo dos principais pontos de atenção da carteira.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {report.alertGroups.length > 0 ? (
                      report.alertGroups.map((group) => (
                        <div key={group.key} className="report-alert-group rounded-[22px] border border-slate-200/80 bg-white p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-base font-semibold tracking-tight text-slate-900">{group.title}</p>
                              <p className="text-sm leading-6 text-slate-500">{group.summary}</p>
                            </div>
                            <Badge variant={group.severity === 'warning' ? 'warning' : 'info'} size="sm">
                              {group.totalCount} ocorrência(s)
                            </Badge>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {group.visiblePlates.map((plate) => (
                              <span
                                key={`${group.key}-${plate}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-medium text-slate-700"
                              >
                                {plate}
                              </span>
                            ))}
                            {group.additionalCount > 0 ? (
                              <span className="rounded-full border border-dashed border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
                                + {group.additionalCount} ocorrência(s) adicional(is)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-slate-200/80 bg-white px-5 py-6 text-sm text-slate-500">
                        Nenhum alerta relevante foi identificado para o período selecionado.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <ReportFooter brand="Saúde da frota" meta={investorName} />
            </div>
          </section>

          {report.featuredVehicles.length > 0 ? (
            <section className="report-page--portrait report-featured-page overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
              <div className="report-page-shell report-page-shell--fleet space-y-5 px-10 py-10">
                <ReportPageHeader title="Destaques da Frota" meta={periodLabel} accent="Top performers da carteira no período" />

                <section className="portal-report-section report-featured-section space-y-4">
                  <div className="report-section-heading flex items-center gap-3">
                    <Car className="h-5 w-5 text-[#0f2439]" />
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Destaques da frota</h3>
                      <p className="text-sm text-slate-500">Veículos com melhor leitura operacional e financeira no período.</p>
                    </div>
                  </div>

                  <div className={`report-featured-grid grid gap-4 ${featuredGridClass}`}>
                    {report.featuredVehicles.map((vehicle) => {
                      const media = getVehicleImageMeta(vehicle.model);
                      const qualityLabel = getQualityLabel(vehicle.qualitySummary.WARNING, vehicle.qualitySummary.REVIEW_REQUIRED);
                      const useGraphicFallback = isGenericVehicleMedia(media.src);

                      return (
                        <article key={vehicle.plate} className="portal-report-vehicle-card report-vehicle-card overflow-hidden rounded-[22px] border border-slate-200/80 bg-white">
                          <div className="report-vehicle-media relative flex h-28 items-center justify-center overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(180deg,#eef3f7,#dde8ef)] px-5 py-3">
                            <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                              {media.label}
                            </div>
                            {useGraphicFallback ? (
                              <div className="report-vehicle-fallback flex h-full w-full max-w-[13.5rem] items-center justify-center rounded-[20px] border border-slate-200/70 bg-white/70">
                                <div className="text-center">
                                  <Car className="mx-auto h-7 w-7 text-[#0f2439]/70" />
                                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Veículo da carteira</p>
                                </div>
                              </div>
                            ) : (
                              <Image
                                src={media.src}
                                alt={media.label}
                                width={220}
                                height={96}
                                unoptimized
                                className="h-full w-auto max-w-full object-contain"
                              />
                            )}
                          </div>

                          <div className="report-vehicle-body space-y-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-mono text-lg font-semibold tracking-tight text-slate-900">{vehicle.plate}</p>
                                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{vehicle.model || media.label}</p>
                                <p className="report-vehicle-print-label mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  {media.label}
                                </p>
                              </div>
                              <StatusPill status={vehicle.currentStatus} />
                            </div>

                            <div className="space-y-2 text-sm">
                              <ReportInfoRow label="Locatário" value={vehicle.driver || 'Não identificado no período'} />
                              <ReportInfoRow label="Recebido" value={formatCurrency(vehicle.revenueReceived)} tone="green" />
                              <ReportInfoRow label="Custos" value={formatCurrency(vehicle.operationalCost)} tone="red" />
                              <ReportInfoRow
                                label="Resultado"
                                value={formatCurrency(vehicle.operationalResult)}
                                tone={vehicle.operationalResult >= 0 ? 'green' : 'red'}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{vehicle.snapshotCount} snapshot(s)</span>
                              <QualityPill
                                warning={vehicle.qualitySummary.WARNING}
                                reviewRequired={vehicle.qualitySummary.REVIEW_REQUIRED}
                                label={qualityLabel}
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <ReportFooter brand="Destaques da frota" meta={investorName} />
              </div>
            </section>
          ) : null}

          <PortalReportAnnex vehicles={report.tableVehicles} periodLabel={periodLabel} investorName={investorName} />
        </div>
      </div>
    </div>
  );
}

function ReportPageHeader({
  title,
  meta,
  accent,
  compact = false,
}: {
  title: string;
  meta: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div className={`report-page-header border-b border-slate-200/80 ${compact ? 'pb-4' : 'pb-6'}`}>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <h2 className={`font-semibold tracking-tight text-slate-900 ${compact ? 'text-[1.75rem]' : 'text-3xl'}`}>{accent}</h2>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Período de referência</p>
          <p className="mt-1 font-medium text-slate-800">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function ReportFooter({ brand, meta }: { brand: string; meta: string }) {
  return (
    <div className="report-footer flex items-center justify-between border-t border-slate-200/70 pt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
      <span>{brand}</span>
      <span>{meta}</span>
    </div>
  );
}

function ReportMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border border-slate-200 bg-slate-50 font-medium text-slate-700 ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      {status}
    </span>
  );
}

function QualityPill({
  warning,
  reviewRequired,
  label,
  compact = false,
}: {
  warning: number;
  reviewRequired: number;
  label: string;
  compact?: boolean;
}) {
  const toneClass =
    reviewRequired > 0
      ? 'border-red-200 bg-red-50 text-red-700'
      : warning > 0
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <span
      className={`inline-flex rounded-full border font-medium ${toneClass} ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      {label}
    </span>
  );
}

function ExecutiveMetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: 'slate' | 'green' | 'red' | 'amber';
}) {
  const toneClass = {
    slate: 'border-slate-200/80 bg-white text-slate-900',
    green: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900',
    red: 'border-red-200/80 bg-red-50/70 text-red-900',
    amber: 'border-amber-200/80 bg-amber-50/70 text-amber-900',
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ReportInfoRow({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'green' | 'red';
}) {
  const toneClass = {
    slate: 'text-slate-700',
    green: 'text-emerald-700',
    red: 'text-red-700',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}
