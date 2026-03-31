import { Suspense } from "react";
import { InvestidoresContent } from "@/components/investidores/InvestidoresContent";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { parseDateRangeFromSearchParams } from "@/lib/dateRange";
import { getInvestorList } from "@/lib/analytics/investor-metrics";

interface InvestidoresPageProps {
  searchParams: { from?: string; to?: string };
}

async function InvestidoresSection({ searchParams }: InvestidoresPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  try {
    const data = await getInvestorList();
    return <InvestidoresContent data={data} dateRange={dateRange} />;
  } catch (error) {
    return (
      <InvestidoresContent
        data={{ investors: [], total: 0 }}
        dateRange={dateRange}
        error={error instanceof Error ? error.message : 'Falha ao carregar investidores'}
      />
    );
  }
}

export default function InvestidoresPage({ searchParams }: InvestidoresPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Investidores</h2>
            <Badge variant="default" size="lg" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              PortfÃ³lio
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize o desempenho dos veÃ­culos por investidor
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-[400px] bg-muted/20 rounded-xl animate-pulse" />}>
        <InvestidoresSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
