'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Bell, User } from 'lucide-react';

// Map routes to page titles
const pageTitles: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/receitas': 'Receitas',
  '/despesas': 'Despesas',
  '/categorias': 'Categorias',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
};

export function Topbar() {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || 'ClikFinance';

  return (
    <header 
      className="h-16 border-b border-border/50 bg-background/95 backdrop-blur-sm fixed top-0 right-0 left-64 z-40 flex items-center justify-between px-6"
      style={{ '--header-height': '64px' } as React.CSSProperties}
    >
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
        <p className="text-xs text-muted-foreground">Gestão Financeira</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Date Range Filter */}
        <Suspense fallback={<div className="w-[150px] h-[36px] bg-muted rounded-lg animate-pulse" />}>
          <DateRangePicker />
        </Suspense>
        
        {/* Notification Bell */}
        <button 
          className="w-9 h-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Notificações"
        >
          <Bell className="w-4 h-4" />
        </button>
        
        {/* User Avatar */}
        <button 
          className="w-9 h-9 rounded-lg bg-[#022D44] flex items-center justify-center text-white hover:bg-[#022D44]/80 transition-colors"
          title="Perfil"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}