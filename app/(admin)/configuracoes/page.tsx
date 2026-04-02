import { Suspense } from 'react';
import { LocalImportCard } from '@/components/config/LocalImportCard';
import { PageHero } from '@/components/ui/PageHero';
import { getFolderStatus } from '@/lib/import/localImporter';

async function ImportSection() {
  try {
    const status = await getFolderStatus();
    return <LocalImportCard initialStatus={status} />;
  } catch (error) {
    return (
      <LocalImportCard
        initialStatus={null}
        initialMessage={{
          type: 'error',
          text: error instanceof Error ? error.message : 'Erro ao preparar central de importação',
        }}
      />
    );
  }
}

export default function ConfiguracoesPage() {
  return (
    <div className="page-shell max-w-6xl">
      <PageHero
        eyebrow="Sistema"
        title="Configurações"
        description="A central de importação ganha uma presença mais executiva, com atmosfera de cockpit operacional e um enquadramento visual compatível com a importância do pipeline."
        accent="blue"
        meta={
          <>
            <span className="page-hero-chip">Importação multiaba</span>
            <span className="page-hero-chip">Workflow recorrente</span>
          </>
        }
      />

      <div className="grid gap-6">
        <Suspense fallback={<div className="h-[640px] rounded-[24px] bg-muted/20 animate-pulse" />}>
          <ImportSection />
        </Suspense>

        <div className="card-premium space-y-4 border-red-200/50 p-6">
          <h3 className="text-lg font-semibold text-red-600">Zona de Perigo</h3>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Reprocessar todo o histórico</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use apenas quando houver necessidade operacional clara, porque o fluxo normal agora é incremental por arquivo.
              </p>
            </div>
            <button className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100">
              Executar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
