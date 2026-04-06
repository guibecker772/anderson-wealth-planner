import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Car,
  Clock3,
  FileText,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSessionUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { getFleetData } from '@/lib/analytics/fleet-metrics';
import { resolvePortalDateRange } from '@/lib/portalDateRange';
import { getVehicleImageMeta } from '@/lib/portalVehicleMedia';
import { buildPortalInvestorReportData } from '@/lib/portal-report';
import { PortalReportActions } from '@/components/portal/PortalReportActions';

export const dynamic = 'force-dynamic';

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

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(`${value}T12:00:00`));
}

function getQualityLabel(warning: number, reviewRequired: number) {
  const total = warning + reviewRequired;
  if (reviewRequired > 0) return `${total} revisão(ões)`;
  if (warning > 0) return `${total} alerta(s)`;
  return 'OK';
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

  if (!investorId) {
    redirect('/portal');
  }

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
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const query = new URLSearchParams();
  query.set('from', dateRange.from);
  query.set('to', dateRange.to);
  if (isImpersonating && impersonateId) query.set('_as', impersonateId);
  const backHref = `/portal?${query.toString()}`;

  return (
    <div className="portal-report-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
        <PortalReportActions backHref={backHref} />

        <div className="portal-report-sheet overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,#072f44_0%,#114d68_50%,#f6f8ed_100%)] px-8 py-8 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 flex items-center gap-4">
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                    <Image
                      src="/brand/clikcar-signature.svg"
                      alt="Clik Car"
                      width={152}
                      height={44}
                      className="h-8 w-auto"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      Relatório individual do investidor
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">ClikFinance</h1>
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Carteira de {investorName}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-white/80">
                    Visão executiva da carteira com resumo operacional, leitura da frota, destaques por veículo e tabela consolidada do período selecionado.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-[28px] border border-white/15 bg-white/10 p-5 text-sm backdrop-blur-sm sm:grid-cols-2 lg:min-w-[360px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Período</p>
                  <p className="mt-1 font-medium text-white">
                    {formatDateLabel(dateRange.from)} até {formatDateLabel(dateRange.to)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Gerado em</p>
                  <p className="mt-1 font-medium text-white">{generatedAt}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Veículos</p>
                  <p className="mt-1 font-medium text-white">{fleet.kpis.totalVehicles} placa(s)</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Snapshots</p>
                  <p className="mt-1 font-medium text-white">{fleet.kpis.totalSnapshots} leitura(s)</p>
                </div>
              </div>
            </div>

            {isImpersonating ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-100/15 px-4 py-2 text-xs font-medium text-amber-50">
                <AlertTriangle className="h-3.5 w-3.5" />
                Relatório gerado em contexto administrativo, respeitando o escopo do investidor visualizado.
              </div>
            ) : null}
          </div>

          <div className="space-y-8 px-8 py-8 text-slate-900">
            <section className="portal-report-section space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#022D44]" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Resumo executivo</h3>
                  <p className="text-sm text-slate-500">Principais indicadores operacionais da carteira no período.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <ReportMetric label="Veículos" value={String(fleet.kpis.totalVehicles)} tone="slate" />
                <ReportMetric label="Snapshots" value={String(fleet.kpis.totalSnapshots)} tone="slate" />
                <ReportMetric label="Receita operacional" value={formatCurrency(fleet.kpis.operationalRevenueReceived)} tone="green" />
                <ReportMetric label="Custos operacionais" value={formatCurrency(fleet.kpis.operationalCost)} tone="red" />
                <ReportMetric label="Valores a cobrar" value={formatCurrency(fleet.kpis.amountToCharge)} tone="amber" />
                <ReportMetric label="Resultado operacional" value={formatCurrency(fleet.kpis.operationalResult)} tone={fleet.kpis.operationalResult >= 0 ? 'green' : 'red'} />
              </div>
            </section>

            <section className="portal-report-section grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/75 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#022D44]" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">Resumo da frota</h3>
                    <p className="text-sm text-slate-500">Distribuição de status consolidada para leitura rápida.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fleet.kpis.statusDistribution.map((item) => (
                    <div key={item.status} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-700">{item.status}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/75 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-[#022D44]" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">Alertas relevantes</h3>
                    <p className="text-sm text-slate-500">Sinalizações operacionais ou financeiras que merecem acompanhamento.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {report.alerts.length > 0 ? (
                    report.alerts.map((alert) => (
                      <div key={`${alert.plate}-${alert.title}`} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-[#022D44]">{alert.plate}</p>
                            <p className="mt-1 text-sm text-slate-700">{alert.title}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{alert.description}</p>
                          </div>
                          <Badge variant={alert.severity === 'warning' ? 'warning' : 'info'} size="sm">
                            {alert.severity === 'warning' ? 'Atenção' : 'Informativo'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-5 text-sm text-slate-500">
                      Nenhum alerta relevante foi identificado para o período selecionado.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="portal-report-section space-y-4">
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-[#022D44]" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Veículos em destaque</h3>
                  <p className="text-sm text-slate-500">Destaques da carteira com imagem do modelo, status e resultado operacional.</p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {report.featuredVehicles.map((vehicle) => {
                  const media = getVehicleImageMeta(vehicle.model);
                  const qualityLabel = getQualityLabel(
                    vehicle.qualitySummary.WARNING,
                    vehicle.qualitySummary.REVIEW_REQUIRED,
                  );

                  return (
                    <div key={vehicle.plate} className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm">
                      <div className="relative h-36 overflow-hidden bg-[linear-gradient(180deg,#edf5f7,#d9e7ee)]">
                        <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {media.label}
                        </div>
                        <Image src={media.src} alt={media.label} fill className="object-contain px-5 py-4" />
                      </div>
                      <div className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xl font-semibold tracking-tight text-slate-900">{vehicle.plate}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{vehicle.model || media.label}</p>
                          </div>
                          <Badge variant="secondary" size="sm">{vehicle.currentStatus}</Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <ReportInfoRow label="Locatário" value={vehicle.driver || 'Não identificado no período'} />
                          <ReportInfoRow label="Recebido" value={formatCurrency(vehicle.revenueReceived)} tone="green" />
                          <ReportInfoRow label="Custos" value={formatCurrency(vehicle.operationalCost)} tone="red" />
                          <ReportInfoRow label="Resultado" value={formatCurrency(vehicle.operationalResult)} tone={vehicle.operationalResult >= 0 ? 'green' : 'red'} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{vehicle.snapshotCount} snapshot(s)</span>
                          <span>{qualityLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="portal-report-section space-y-4">
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5 text-[#022D44]" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Tabela detalhada da carteira</h3>
                  <p className="text-sm text-slate-500">Consolidado objetivo por veículo para leitura operacional do período.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-slate-200/80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Placa</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Modelo</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500">Recebido</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500">Custos</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500">A cobrar</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500">Resultado</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Qualidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tableVehicles.map((vehicle) => (
                      <tr key={vehicle.plate} className="border-t border-slate-200/80">
                        <td className="px-4 py-3 font-mono font-semibold text-[#022D44]">{vehicle.plate}</td>
                        <td className="px-4 py-3 text-slate-700">{vehicle.model || 'Modelo não identificado'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" size="sm">{vehicle.currentStatus}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrencyFull(vehicle.revenueReceived)}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-700">{formatCurrencyFull(vehicle.operationalCost)}</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">{formatCurrencyFull(vehicle.amountToCharge)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatCurrencyFull(vehicle.operationalResult)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              vehicle.qualitySummary.REVIEW_REQUIRED > 0
                                ? 'error'
                                : vehicle.qualitySummary.WARNING > 0
                                  ? 'warning'
                                  : 'success'
                            }
                            size="sm"
                          >
                            {getQualityLabel(vehicle.qualitySummary.WARNING, vehicle.qualitySummary.REVIEW_REQUIRED)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'green' | 'red' | 'amber';
}) {
  const tones = {
    slate: 'border-slate-200/80 bg-white text-slate-900',
    green: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900',
    red: 'border-red-200/80 bg-red-50/70 text-red-900',
    amber: 'border-amber-200/80 bg-amber-50/70 text-amber-900',
  }[tone];

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${tones}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
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
