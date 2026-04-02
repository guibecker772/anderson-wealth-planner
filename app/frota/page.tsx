import { Suspense } from 'react';
import { Truck } from 'lucide-react';
import { FleetContent } from '@/components/frota/FleetContent';
import { Badge } from '@/components/ui/badge';
import { PageHero } from '@/components/ui/PageHero';

export default function FrotaPage() {
  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Base operacional"
        title="Frota / Operação"
        description="Visão operacional da frota por veículo. Status, receita, custo e resultado derivados dos snapshots da planilha operacional."
        accent="blue"
        meta={
          <>
            <Badge variant="info" size="lg" className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Operacional
            </Badge>
            <span className="page-hero-chip">OperationalSnapshot</span>
            <span className="page-hero-chip">Sem misturar ledger financeiro</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[420px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <FleetContent />
      </Suspense>
    </div>
  );
}
