import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Badge } from "@/components/ui/badge";

async function getReceitas(searchParams: any) {
  const params = new URLSearchParams(searchParams);
  params.set('type', 'RECEIVABLE');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/transactions?${params.toString()}`, {
        cache: 'no-store'
    });
    if(!res.ok) throw new Error("Falha na API");
    return res.json();
  } catch (error) {
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 }};
  }
}

export default async function ReceitasPage({ searchParams }: { searchParams: any }) {
  const { data, meta } = await getReceitas(searchParams);
  const totalPagina = data.reduce((acc: number, item: any) => acc + Number(item.plannedAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Receitas <Badge variant="success" className="text-lg px-2 py-0.5">{meta.total}</Badge>
          </h2>
           <p className="text-muted-foreground text-sm mt-1">
            Controle suas entradas e previsões de faturamento.
          </p>
        </div>
        <div className="bg-muted/30 px-4 py-2 rounded-md border text-sm">
           Total nesta página: <span className="font-bold text-green-600">R$ {totalPagina.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      
      <TransactionFilters />
      
      <TransactionTable 
        data={data} 
        page={Number(meta.page)} 
        totalPages={Number(meta.totalPages)} 
        type="RECEIVABLE" 
      />
    </div>
  );
}