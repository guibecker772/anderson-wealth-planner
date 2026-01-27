import { CalendarIcon } from 'lucide-react';

export function Topbar() {
  return (
    <header className="h-16 border-b bg-card/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6 ml-64">
      <div>
        {/* Breadcrumbs or Page Title Placeholder */}
        <h1 className="text-sm font-medium text-muted-foreground">Financeiro</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Mock de filtro de data - será funcional nos próximos lotes */}
        <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background text-sm cursor-pointer hover:bg-muted/50">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span>Este Mês</span>
        </div>
        
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          A
        </div>
      </div>
    </header>
  );
}