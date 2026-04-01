'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { GlobalDateRangePicker } from '@/components/ui/GlobalDateRangePicker';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/ui/UserMenu';

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
  const info = pageInfo[pathname] || { title: 'ClikFinance', subtitle: 'Gestão financeira' };

  return (
    <header
      className="sticky-shell-top fixed left-[18rem] right-6 z-40 flex min-h-[72px] items-center justify-between rounded-[28px] border border-white/82 bg-white/94 px-5 py-3"
      style={{ boxShadow: '0 14px 28px -26px rgba(2,45,68,0.16), inset 0 1px 0 rgba(255,255,255,0.78)' }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#022D44,#0b4e70)] text-white shadow-lg shadow-[#022D44]/12">
          <div className="h-2.5 w-2.5 rounded-full bg-[#A8CF4C]" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#022D44]/50">Workspace</p>
          <h1 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
            {info.title}
          </h1>
          <p className="truncate text-[12px] text-slate-600">{info.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Suspense fallback={<div className="state-shell h-[42px] w-[220px] animate-pulse" />}>
          <GlobalDateRangePicker />
        </Suspense>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
