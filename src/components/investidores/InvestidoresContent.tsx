'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Car, ChevronRight, Landmark, TrendingUp, Users, Wrench, AlertTriangle } from 'lucide-react';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import type { InvestorListResponse } from '@/lib/analytics/investor-metrics';

interface InvestidoresContentProps {
  data: InvestorListResponse;
  dateRange: { from: string; to: string };
  error?: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function InvestidoresContent({ data, dateRange, error }: InvestidoresContentProps) {
  const router = useRouter();

  if (error) {
    return (
      <div className="premium-empty h-[400px]">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p>{error}</p>
      </div>
    );
  }

  const handleInvestorClick = (investorId: string) => {
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    router.push(`/investidores/${investorId}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="editorial-panel px-6 py-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90">
              <Users className="h-3.5 w-3.5" />
              Carteira operacional
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{data.total} investidores identificados</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/82">
              Visao combinada de performance operacional e vinculos financeiros auditaveis, sem forcar alocacao insegura.
            </p>
          </div>
          <div className="glass-panel flex flex-col gap-3 p-4">
            <DateRangeBadge from={dateRange.from} to={dateRange.to} />
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniHighlight label="Com vinculo financeiro" value={String(data.summary.investorsWithFinancialLinks)} />
              <MiniHighlight label="Saidas identificadas" value={formatCurrency(data.summary.identifiedFinancialOutflow)} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="module-surface module-surface-operational">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2>Camadas por investidor</h2>
              <p>Receita recebida, custo operacional e financeiro identificado aparecem separados.</p>
            </div>
          </div>
          <div className="soft-grid grid gap-3 sm:grid-cols-3">
            <LayerTag icon={<TrendingUp className="h-4 w-4" />} title="Operacional" text="Receita recebida por veiculo e cobranca da frota." />
            <LayerTag icon={<Wrench className="h-4 w-4" />} title="Custos" text="Manutencao, desconto e multa operacional derivados." />
            <LayerTag icon={<Landmark className="h-4 w-4" />} title="Financeiro identificado" text="So entradas e saidas com vinculo forte e auditavel." />
          </div>
        </div>

        <div className="module-surface module-surface-financial">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h2>Leitura de alocacao</h2>
              <p>O que nao puder ser atribuido com seguranca continua corporativo e fora do resultado individual.</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-white/82">
            Nesta versao, a tela privilegia vinculos nominais claros. Repasses ambiguos, impostos e despesas sem beneficiario seguem como nao alocados.
          </p>
        </div>
      </div>

      <div className="soft-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.investors.map((investor) => (
          <button
            key={investor.id}
            type="button"
            onClick={() => handleInvestorClick(investor.id)}
            className="card-premium group bg-gradient-to-br from-white via-white to-slate-50/80 p-5 text-left transition-transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 group-hover:text-[#022D44]">{investor.name}</h3>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <Car className="h-4 w-4" />
                  {investor.vehicles.length} veiculo(s)
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {investor.vehicles.slice(0, 3).map((plate) => (
                    <span key={plate} className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 font-mono text-xs text-slate-600 shadow-sm">
                      {plate}
                    </span>
                  ))}
                  {investor.vehicles.length > 3 ? (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500">
                      +{investor.vehicles.length - 3}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-2">
                  <InfoRow label="Financeiro identificado" value={investor.linkedEntryCount > 0 ? formatCurrency(investor.identifiedFinancialOutflow) : 'Sem vinculo'} />
                  <InfoRow label="Lancamentos auditaveis" value={`${investor.linkedEntryCount}`} />
                </div>
              </div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-[#022D44] group-hover:text-white">
                <ChevronRight className="h-5 w-5" />
              </div>
            </div>
          </button>
        ))}

        {data.investors.length === 0 ? (
          <div className="premium-empty col-span-full h-[220px]">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-base font-medium text-slate-700">Nenhum investidor encontrado</p>
            <p className="text-sm text-slate-500">A base operacional ainda nao trouxe proprietarios normalizados suficientes.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniHighlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-900">{value}</p>
    </div>
  );
}

function LayerTag({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <div className="flex items-center gap-2 text-slate-700">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/85 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
