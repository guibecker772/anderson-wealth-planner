import { Suspense } from "react";
import { InvestidoresContent } from "@/components/investidores/InvestidoresContent";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function InvestidoresPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Investidores</h2>
            <Badge variant="default" size="lg" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Portfólio
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize o desempenho dos veículos por investidor
          </p>
        </div>
      </div>
      
      {/* Content */}
      <Suspense fallback={<div className="h-[400px] bg-muted/20 rounded-xl animate-pulse" />}>
        <InvestidoresContent />
      </Suspense>
    </div>
  );
}
