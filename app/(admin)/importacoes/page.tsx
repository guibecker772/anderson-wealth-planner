import { Inbox } from 'lucide-react';

import { ImportMonitoringTable } from '@/components/admin/ImportMonitoringTable';
import { PageHero } from '@/components/ui/PageHero';
import { listImportBatches, parseImportMonitoringFilters } from '@/lib/import/monitoring';

export default async function ImportacoesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string; kind?: string; q?: string };
}) {
  const filters = parseImportMonitoringFilters(searchParams);
  const data = await listImportBatches(filters);

  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Operacao"
        title="Centro de Importacoes"
        description="Acompanhamento administrativo do pipeline: lotes, arquivos, validacao, publicacao e trilha de auditoria por linha."
        accent="blue"
        meta={
          <>
            <span className="page-hero-chip">Lotes: {data.totals.batches}</span>
            <span className="page-hero-chip">Rejeitadas: {data.totals.rejectedRows}</span>
            <span className="page-hero-chip">Publicadas: {data.totals.publishedRows}</span>
          </>
        }
      >
        <div className="hero-metrics-grid">
          <div className="hero-metric-card bg-gradient-to-br from-[#022D44]/12 to-white text-[#022D44]">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Inbox className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Arquivos</p>
            <p className="metric-value-fluid mt-2">{data.totals.files}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-emerald-500/12 to-white text-emerald-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Inbox className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Validadas</p>
            <p className="metric-value-fluid mt-2">{data.totals.validatedRows}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-amber-500/12 to-white text-amber-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Inbox className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Warnings</p>
            <p className="metric-value-fluid mt-2">{data.totals.warnings}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-red-500/12 to-white text-red-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Inbox className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Erros</p>
            <p className="metric-value-fluid mt-2">{data.totals.errors}</p>
          </div>
        </div>
      </PageHero>

      <ImportMonitoringTable data={data} />
    </div>
  );
}
