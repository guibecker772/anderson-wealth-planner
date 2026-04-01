'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { GlobalDateRangePicker } from '@/components/ui/GlobalDateRangePicker';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/ui/UserMenu';

// Map routes to page titles and subtitles
const pageInfo: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Visão Geral', subtitle: 'Painel executivo' },
  '/receitas': { title: 'Receitas', subtitle: 'Entradas e faturamento' },
  '/despesas': { title: 'Despesas', subtitle: 'Saídas e custos operacionais' },
  '/multas': { title: 'Multas', subtitle: 'Infrações e veículos' },
  '/investidores': { title: 'Investidores', subtitle: 'Portfólio e retorno' },
  '/relatorios': { title: 'Relatórios', subtitle: 'Importações e qualidade' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Importação e sistema' },
  '/categorias': { title: 'Categorias', subtitle: 'Normalização e ranking' },
};

export function Topbar() {
  const pathname = usePathname();
  const info = pageInfo[pathname] || { title: 'ClikFinance', subtitle: 'Gestão Financeira' };

  return (
    <header 
      className="h-16 border-b border-border/50 bg-background/95 backdrop-blur-sm fixed top-0 right-0 left-64 z-40 flex items-center justify-between px-6"
    >
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground leading-tight">{info.title}</h1>
        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Global Date Range Filter */}
        <Suspense fallback={<div className="w-[150px] h-[36px] bg-muted rounded-full animate-pulse" />}>
          <GlobalDateRangePicker />
        </Suspense>
        
        {/* Notification Bell */}
        <NotificationBell />
        
        {/* User / System Menu */}
        <UserMenu />
      </div>
    </header>
  );
}