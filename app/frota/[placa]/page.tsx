import { Suspense } from 'react';
import { Car } from 'lucide-react';
import { VehicleDetailContent } from '@/components/frota/VehicleDetailContent';
import { Badge } from '@/components/ui/badge';
import { PageHero } from '@/components/ui/PageHero';

interface Props {
  params: { placa: string };
}

export default function VehicleDetailPage({ params }: Props) {
  const plate = decodeURIComponent(params.placa);

  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Detalhe do veículo"
        title={plate}
        description="Histórico operacional completo do veículo no período selecionado. Cada linha representa um registro (snapshot) da planilha operacional."
        accent="blue"
        meta={
          <>
            <Badge variant="info" size="lg" className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              Operacional
            </Badge>
            <span className="page-hero-chip">OperationalSnapshot</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[420px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <VehicleDetailContent plate={plate} />
      </Suspense>
    </div>
  );
}
