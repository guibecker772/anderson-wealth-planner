'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceTopbar } from '@/components/shell/WorkspaceTopbar';
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
  '/frota': { title: 'Frota / Operação', subtitle: 'Veículos e controle operacional' },
};

export function Topbar() {
  const pathname = usePathname();
  const info = pageInfo[pathname]
    || (pathname.startsWith('/frota/') ? { title: 'Detalhe do Veículo', subtitle: 'Histórico operacional' } : null)
    || { title: 'ClikFinance', subtitle: 'Gestão financeira' };

  return (
    <div className="sticky-shell-top fixed left-[18rem] right-6 z-40 hidden lg:block">
      <WorkspaceTopbar
        title={info.title}
        subtitle={info.subtitle}
        actions={(
          <>
            <Suspense fallback={<div className="state-shell h-[42px] w-[220px] animate-pulse" />}>
              <GlobalDateRangePicker />
            </Suspense>
            <NotificationBell />
            <UserMenu />
          </>
        )}
      />
    </div>
  );
}
