import { LocalImportCard } from "@/components/config/LocalImportCard";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
      
      <div className="grid gap-6">
        {/* Importação Local */}
        <LocalImportCard />
        
        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h3 className="font-semibold text-lg">Integração Google Drive (API)</h3>
          <p className="text-sm text-muted-foreground">
            Configure as credenciais da Service Account para acessar a pasta "Financeiro Anderson".
            <br />
            <span className="text-amber-600">⚠️ Não implementado. Use a Importação Local acima.</span>
          </p>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium">Pasta Raiz (Folder ID)</label>
            <input 
              type="text" 
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Ex: 1A2b3C..."
              disabled
            />
          </div>

          <div className="grid gap-2">
             <label className="text-sm font-medium">Meses para sincronizar (retroativo)</label>
             <input 
              type="number" 
              defaultValue={2}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              disabled
            />
          </div>
          
          <div className="pt-2">
            <button 
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm font-medium w-full opacity-50 cursor-not-allowed"
              disabled
            >
              Testar Conexão (Indisponível)
            </button>
          </div>
        </div>

        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h3 className="font-semibold text-lg text-red-600">Zona de Perigo</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm">Reprocessar todo o histórico</span>
            <button className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-md text-sm font-medium">
              Executar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}