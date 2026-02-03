import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/lib/components/layout/ui/placeholder-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { Badge } from "@/lib/components/layout/ui/badge";
import { AlertCircle, ArrowRight, Info, Calendar, Tags, FileX } from "lucide-react";
import { parseDateRangeFromSearchParams, dateRangeToDbFilter, formatDateDisplay } from "@/lib/dateRange";

async function getCategoryData(searchParams: { from?: string; to?: string }) {
  // Fallback para modo sem DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return { ranking: [], isMock: true, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }

  try {
    const { db } = await import("@/lib/db");
    
    // Parse date range from URL params (uses defaults if not provided)
    const dateRange = parseDateRangeFromSearchParams(searchParams);
    const dateFilter = dateRangeToDbFilter(dateRange);

    // Top Categorias de Despesas (SETTLED) no período selecionado
    const ranking = await db.transaction.groupBy({
      by: ['category'],
      _sum: { actualAmount: true, plannedAmount: true },
      _count: { id: true },
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        dueDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        }
      },
      orderBy: {
        _sum: { actualAmount: 'desc' }
      },
      take: 20
    });

    return { ranking, isMock: false, dateRange };
  } catch (error) {
    return { ranking: [], isMock: false, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }
}

export default async function CategoriasPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { ranking, isMock, dateRange } = await getCategoryData(searchParams);

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstração: banco não configurado (DATABASE_URL ausente).</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Categorias</h2>
            <Badge variant="accent" size="lg">
              <Tags className="w-3 h-3 mr-1" />
              {ranking.length}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de gastos por categoria no período
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm px-3 py-2 bg-muted rounded-lg">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{formatDateDisplay(dateRange.from)}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">{formatDateDisplay(dateRange.to)}</span>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Card: Ranking */}
        <div className="md:col-span-1 rounded-xl border bg-card shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-foreground">Ranking de Despesas</h3>
            <p className="text-sm text-muted-foreground mt-1">Para onde foi o dinheiro no período (Pagos)</p>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Categoria</TableHead>
                  <TableHead className="text-right font-semibold">Total Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-sm">
                        {item.category || "Sem Categoria"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      R$ {Number(item._sum.actualAmount || item._sum.plannedAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                {ranking.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FileX className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Nenhum dado encontrado
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Ajuste o período ou verifique a conexão com o banco
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Card: De/Para (Preview) */}
        <div className="md:col-span-1 rounded-xl border border-dashed bg-card/50 shadow-sm">
          <div className="p-6 border-b border-dashed">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Normalização (De/Para)</h3>
              <Badge variant="outline" className="text-xs">Em Breve</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Mapeie nomes do Excel para categorias padrões
            </p>
          </div>
          <div className="p-6 space-y-4 opacity-60">
            <div className="flex items-center gap-2 text-sm border p-3 rounded-lg bg-muted/20">
              <span className="line-through text-red-400">Pgto Energia</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-emerald-600">Energia Elétrica</span>
            </div>
            <div className="flex items-center gap-2 text-sm border p-3 rounded-lg bg-muted/20">
              <span className="line-through text-red-400">Internet VIVO</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-emerald-600">Telecomunicações</span>
            </div>
             
            <div className="flex items-center gap-2 p-4 bg-amber-500/10 rounded-lg text-amber-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>Funcionalidade planejada para versões futuras. Por enquanto, o sistema usa o nome exato do Excel.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}