import { Suspense } from "react";
import { Users } from "lucide-react";
import { InvestidoresContent } from "@/components/investidores/InvestidoresContent";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/ui/PageHero";
import { parseDateRangeFromSearchParams } from "@/lib/dateRange";
import { getInvestorList } from "@/lib/analytics/investor-metrics";
import { db } from "@/lib/db";

interface InvestidoresPageProps {
  searchParams: { from?: string; to?: string };
}

async function InvestidoresSection({ searchParams }: InvestidoresPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  try {
    const data = await getInvestorList(db, dateRange);
    return <InvestidoresContent data={data} dateRange={dateRange} />;
  } catch (error) {
    return (
      <InvestidoresContent
        data={{
          investors: [],
          total: 0,
          summary: {
            investorsWithFinancialLinks: 0,
            identifiedFinancialInflow: 0,
            identifiedFinancialOutflow: 0,
            corporateUnallocatedRevenue: 0,
            corporateUnallocatedExpense: 0,
          },
          dateRange,
        }}
        dateRange={dateRange}
        error={error instanceof Error ? error.message : 'Falha ao carregar investidores'}
      />
    );
  }
}

export default function InvestidoresPage({ searchParams }: InvestidoresPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Portfólio"
        title="Investidores"
        description="A nova composição aproxima operação e financeiro identificado sem fingir completude, deixando visível o que é individual, o que é corporativo e o que ainda depende de conciliação."
        accent="blue"
        meta={
          <>
            <Badge variant="accent" size="lg" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Portfólio
            </Badge>
            <span className="page-hero-chip">{dateRange.from} → {dateRange.to}</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[460px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <InvestidoresSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
