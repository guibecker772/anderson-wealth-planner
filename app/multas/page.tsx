import { Suspense } from "react";
import { MultasContent } from "@/components/multas/MultasContent";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function MultasPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Multas</h2>
            <Badge variant="warning" size="lg" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Infrações
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie multas de trânsito e infrações por veículo
          </p>
        </div>
      </div>
      
      {/* Content */}
      <Suspense fallback={<div className="h-[400px] bg-muted/20 rounded-xl animate-pulse" />}>
        <MultasContent />
      </Suspense>
    </div>
  );
}
