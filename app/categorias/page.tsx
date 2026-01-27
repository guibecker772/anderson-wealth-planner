import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/lib/components/layout/ui/placeholder-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { Badge } from "@/lib/components/layout/ui/badge";
import { AlertCircle, ArrowRight, Info } from "lucide-react";

async function getCategoryData() {
  // Fallback para modo sem DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return { ranking: [], isMock: true };
  }

  try {
    const { db } = await import("@/lib/db");
    
    // Top Categorias de Despesas (SETTLED) - Últimos 90 dias
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 90);

    const ranking = await db.transaction.groupBy({
      by: ['category'],
      _sum: { actualAmount: true },
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        actualDate: { gte: dateLimit }
      },
      orderBy: {
        _sum: { actualAmount: 'desc' }
      },
      take: 20
    });

    return { ranking, isMock: false };
  } catch (error) {
    return { ranking: [], isMock: false };
  }
}

export default async function CategoriasPage() {
  const { ranking, isMock } = await getCategoryData();

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstração: banco não configurado (DATABASE_URL ausente).</span>
        </div>
      )}

      <h2 className="text-3xl font-bold tracking-tight">Gestão de Categorias</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Card: Ranking */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Ranking de Despesas</CardTitle>
            <CardDescription>Para onde foi o dinheiro nos últimos 90 dias (Pago)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria (Excel)</TableHead>
                  <TableHead className="text-right">Total Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.category || "Sem Categoria"}</TableCell>
                    <TableCell className="text-right">
                      R$ {Number(item._sum.actualAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                {ranking.length === 0 && (
                   <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                       Nenhum dado encontrado ou DB desconectado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card: De/Para (Mock Visual) */}
        <Card className="md:col-span-1 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               Normalização (De/Para)
               <Badge variant="outline" className="text-xs font-normal">Em Breve</Badge>
            </CardTitle>
            <CardDescription>
              Mapeie nomes errados do Excel para categorias padrões.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 opacity-60">
             <div className="flex items-center gap-2 text-sm border p-2 rounded bg-muted/20">
                <span className="line-through text-red-400">Pgto Energia</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-green-600">Energia Elétrica</span>
             </div>
             <div className="flex items-center gap-2 text-sm border p-2 rounded bg-muted/20">
                <span className="line-through text-red-400">Internet VIVO</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-green-600">Telecomunicações</span>
             </div>
             
             <div className="flex items-center gap-2 p-4 bg-amber-50 rounded text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5" />
                <p>Funcionalidade planejada para versões futuras. Por enquanto, o sistema usa o nome exato da aba/coluna do Excel.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}