import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { MultasContent } from "@/components/multas/MultasContent";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/ui/PageHero";

export default function MultasPage() {
  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Multas Oficiais"
        title="Multas"
        description="O domínio oficial de infrações ganha uma presença visual própria, com foco em FineRecord, rastreabilidade e leitura mais premium do risco da frota."
        accent="amber"
        meta={
          <>
            <Badge variant="warning" size="lg" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Infrações
            </Badge>
            <span className="page-hero-chip">FineRecord oficial</span>
            <span className="page-hero-chip">Sem confundir com custo operacional</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[420px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <MultasContent />
      </Suspense>
    </div>
  );
}
