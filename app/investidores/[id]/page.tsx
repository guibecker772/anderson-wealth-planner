import { Suspense } from "react";
import { InvestorDetailContent } from "@/components/investidores/InvestorDetailContent";
import { parseDateRangeFromSearchParams } from "@/lib/dateRange";
import { getInvestorMetrics } from "@/lib/analytics/investor-metrics";
import { db } from "@/lib/db";

interface InvestorDetailPageProps {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}

async function InvestorDetailSection({ params, searchParams }: InvestorDetailPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  if (!process.env.DATABASE_URL) {
    return (
      <InvestorDetailContent
        data={null}
        dateRange={dateRange}
        error="Database not configured"
      />
    );
  }

  try {
    const data = await getInvestorMetrics(db, params.id, dateRange);
    return <InvestorDetailContent data={data} dateRange={dateRange} />;
  } catch (error) {
    return (
      <InvestorDetailContent
        data={null}
        dateRange={dateRange}
        error={error instanceof Error ? error.message : 'Falha ao carregar dados do investidor'}
      />
    );
  }
}

export default function InvestorDetailPage(props: InvestorDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-[400px] bg-muted/20 rounded-xl animate-pulse" />}>
      <InvestorDetailSection {...props} />
    </Suspense>
  );
}
