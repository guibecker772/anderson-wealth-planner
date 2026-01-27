import { Card, CardContent, CardHeader, CardTitle } from "@/lib/components/layout/ui/placeholder-ui";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* KPIs */}
        <KPICard title="Receita Realizada" value="R$ 0,00" trend="+0%" />
        <KPICard title="Despesa Paga" value="R$ 0,00" trend="-0%" />
        <KPICard title="Lucro Líquido" value="R$ 0,00" trend="+0%" />
        <KPICard title="A Pagar (Aberto)" value="R$ 0,00" subtext="Vencidos: R$ 0,00" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 border rounded-xl p-6 bg-card">
          <h3 className="font-semibold mb-4">Fluxo de Caixa (Tendência)</h3>
          <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
            Gráfico de Linha (Recharts) será renderizado aqui
          </div>
        </div>
        <div className="col-span-3 border rounded-xl p-6 bg-card">
          <h3 className="font-semibold mb-4">Top Gastos por Categoria</h3>
          <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
            Gráfico de Barras será renderizado aqui
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, trend, subtext }: { title: string, value: string, trend?: string, subtext?: string }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {(trend || subtext) && (
        <p className="text-xs text-muted-foreground mt-1">
          {trend && <span className={trend.startsWith('+') ? "text-green-600" : "text-red-600"}>{trend} do mês passado</span>}
          {subtext && <span>{subtext}</span>}
        </p>
      )}
    </div>
  );
}