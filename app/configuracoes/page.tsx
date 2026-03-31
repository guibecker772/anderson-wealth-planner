import { Suspense } from 'react';
import { LocalImportCard } from '@/components/config/LocalImportCard';
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Central de importação do sistema web principal. Os arquivos entram aqui e os dados consolidados passam a ser servidos pelo banco.
        </p>
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<div className="h-[640px] bg-muted/20 rounded-xl animate-pulse" />}>
          <ImportSection />
        </Suspense>

        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h3 className="font-semibold text-lg text-red-600">Zona de Perigo</h3>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Reprocessar todo o histórico</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use apenas quando houver necessidade operacional clara, porque o fluxo normal agora é incremental por arquivo.
              </p>
            </div>
            <button className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-md text-sm font-medium">
              Executar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
