import { Layers3 } from 'lucide-react';

import { ImportBatchDetailView } from '@/components/admin/ImportBatchDetailView';
import { PageHero } from '@/components/ui/PageHero';
import { getImportBatchDetail, parseImportBatchRowFilters } from '@/lib/import/monitoring';

export default async function ImportacaoDetalhePage({
  params,
  searchParams,
}: {
  params: { batchId: string };
  searchParams: { rowStatus?: string; recordType?: string; sheet?: string };
}) {
  const detail = await getImportBatchDetail(
    params.batchId,
    parseImportBatchRowFilters(searchParams),
  );

  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Auditoria"
        title={`Lote ${detail.batch.id.slice(0, 12)}`}
        description="Detalhe operacional da importacao, com origem dos arquivos, validacoes por linha e acoes seguras de publicacao ou reprocessamento."
        accent="blue"
        meta={
          <>
            <span className="page-hero-chip">{detail.batch.pipelineStatus}</span>
            <span className="page-hero-chip">Arquivos: {detail.files.length}</span>
            <span className="page-hero-chip">Rejeitadas: {detail.batch.rejectedRowCount}</span>
          </>
        }
      >
        <div className="hero-metrics-grid">
          <div className="hero-metric-card bg-gradient-to-br from-[#022D44]/12 to-white text-[#022D44]">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Layers3 className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Linhas</p>
            <p className="metric-value-fluid mt-2">{detail.batch.rowCount}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-emerald-500/12 to-white text-emerald-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Layers3 className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Publicadas</p>
            <p className="metric-value-fluid mt-2">{detail.batch.publishedRowCount}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-amber-500/12 to-white text-amber-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Layers3 className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Warnings</p>
            <p className="metric-value-fluid mt-2">{detail.summary.warnings}</p>
          </div>
          <div className="hero-metric-card bg-gradient-to-br from-red-500/12 to-white text-red-700">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              <Layers3 className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Erros</p>
            <p className="metric-value-fluid mt-2">{detail.summary.errors}</p>
          </div>
        </div>
      </PageHero>

      <div className="glass-panel grid gap-3 p-4 md:grid-cols-[180px_220px_1fr]">
        <select
          name="rowStatus"
          defaultValue={detail.rowFilters.status}
          form="batch-row-filters"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="ERROR_ONLY">Somente erro</option>
          <option value="ALL">Todos os status</option>
          <option value="VALIDATED">Validated</option>
          <option value="REJECTED">Rejected</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select
          name="recordType"
          defaultValue={detail.rowFilters.recordType}
          form="batch-row-filters"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="ALL">Todos os tipos</option>
          <option value="OPERATIONAL_SNAPSHOT">Operational snapshot</option>
          <option value="FINANCIAL_ENTRY">Financial entry</option>
          <option value="FINE_RECORD">Fine record</option>
          <option value="FINE_RESPONSIBILITY">Fine responsibility</option>
        </select>
        <form id="batch-row-filters" className="flex gap-2" method="GET">
          <input
            name="sheet"
            defaultValue={detail.rowFilters.sheet}
            placeholder="Filtrar por aba..."
            className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />
          <button type="submit" className="rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700">
            Aplicar
          </button>
        </form>
      </div>

      <ImportBatchDetailView detail={detail} />
    </div>
  );
}
