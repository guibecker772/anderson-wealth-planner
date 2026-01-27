import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Badge } from "@/components/ui/badge";

// Reutilizando fetcher interno ou chamando API via URL absoluta se necessário.
// Para Server Components, idealmente chamamos a controller/db direto, mas para manter coerência com Lote 2:
async function getDespesas(searchParams: any) {
  const params = new URLSearchParams(searchParams);
  params.set('type', 'PAYABLE');
  
  // Fallback seguro para URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/transactions?${params.toString()}`, {
        cache: 'no-store'
    });
    if(!res.ok) throw new Error("Falha na API");
    return res.json();
  } catch (error) {
    console.error(error);
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 }};
  }
}

export default async function DespesasPage({ searchParams }: { searchParams: any }) {
  const { data, meta } = await getDespesas(searchParams);

  // Calcula totais simples baseados na página atual (para MVP)
  // O ideal seria um endpoint /metrics separado que aceita os mesmos filtros
  const totalPagina = data.reduce((acc: number, item: any) => acc + Number(item.plannedAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Despesas <Badge variant="destructive" className="text-lg px-2 py-0.5">{meta.total}</Badge>
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas contas a pagar e saídas de caixa.
          </p>
        </div>
        <div className="bg-muted/30 px-4 py-2 rounded-md border text-sm">
           Total nesta página: <span className="font-bold text-red-600">R$ {totalPagina.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      
      <TransactionFilters />

      <TransactionTable 
        data={data} 
        page={Number(meta.page)} 
        totalPages={Number(meta.totalPages)} 
        type="PAYABLE" 
      />
    </div>
  );
}