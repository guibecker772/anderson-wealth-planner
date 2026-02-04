import { Suspense } from "react";
import { InvestorDetailContent } from "@/components/investidores/InvestorDetailContent";

interface InvestorDetailPageProps {
  params: { id: string };
}

export default function InvestorDetailPage({ params }: InvestorDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-[400px] bg-muted/20 rounded-xl animate-pulse" />}>
      <InvestorDetailContent investorId={params.id} />
    </Suspense>
  );
}
