import { Card } from "@/lib/components/layout/ui/placeholder-ui";
import { OverviewLineChart, OverviewBarChart } from "@/lib/components/dashboard/OverviewCharts";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { Badge } from "@/lib/components/layout/ui/badge";

// Fetch data logic
async function getDashboardData() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/metrics`, { 
    cache: 'no-store' 
  });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

async function getRecentTransactions() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/transactions?pageSize=5`, { 
    cache: 'no-store' 
  });
  if (!res.ok) return { data: [] };
  return res.json();
}

export default async function DashboardPage() {
  let metrics;
  let recent;
  
  try {
      metrics = await getDashboardData();
      recent = await getRecentTransactions();
  } catch (e) {
      return <div>Erro ao carregar dashboard. Certifique-se que o servidor está rodando.</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Receita Realizada" value={formatCurrency(metrics.kpi.income)} trend="Total acumulado" />
        <KPICard title="Despesa Paga" value={formatCurrency(metrics.kpi.expense)} trend="Total acumulado" />
        <KPICard title="Lucro Líquido" value={formatCurrency(metrics.kpi.balance)} trend="Caixa" />
        <KPICard title="A Pagar (Aberto)" value={formatCurrency(metrics.kpi.openPayables)} trend={`Vencidos: ${formatCurrency(metrics.kpi.overduePayables)}`} isAlert={metrics.kpi.overduePayables > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 h-[400px]">
        <div className="col-span-4 border rounded-xl p-6 bg-card flex flex-col">
          <h3 className="font-semibold mb-4">Fluxo de Caixa (Mensal)</h3>
          <div className="flex-1 min-h-0">
            <OverviewLineChart data={metrics.chart} />
          </div>
        </div>
        <div className="col-span-3 border rounded-xl p-6 bg-card flex flex-col">
          <h3 className="font-semibold mb-4">Top Gastos por Categoria</h3>
          <div className="flex-1 min-h-0">
             <OverviewBarChart data={metrics.categories} />
          </div>
        </div>
      </div>
      
      <div className="border rounded-md bg-card">
          <div className="p-4 border-b">
              <h3 className="font-semibold">Últimos Lançamentos</h3>
          </div>
          <Table>
              <TableHeader>
                  <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {recent.data.map((tx: any) => (
                      <TableRow key={tx.id}>
                          <TableCell>{new Date(tx.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                              <div className="font-medium">{tx.counterparty}</div>
                              <div className="text-xs text-muted-foreground">{tx.category}</div>
                          </TableCell>
                          <TableCell className={tx.type === 'PAYABLE' ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(tx.plannedAmount)}
                          </TableCell>
                          <TableCell>
                              <Badge variant={tx.status === 'SETTLED' ? 'success' : 'secondary'}>
                                  {tx.status === 'SETTLED' ? 'Pago/Recebido' : 'Pendente'}
                              </Badge>
                          </TableCell>
                      </TableRow>
                  ))}
              </TableBody>
          </Table>
      </div>
    </div>
  );
}

function KPICard({ title, value, trend, isAlert }: { title: string, value: string, trend?: string, isAlert?: boolean }) {
  return (
    <Card>
      <div className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className={`text-2xl font-bold mt-2 ${isAlert ? 'text-red-600' : ''}`}>{value}</div>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </div>
    </Card>
  );
}