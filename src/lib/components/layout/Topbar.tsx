'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { WorkspaceTopbar } from '@/components/shell/WorkspaceTopbar';
import { GlobalDateRangePicker } from '@/components/ui/GlobalDateRangePicker';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/ui/UserMenu';

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Visao Geral', subtitle: 'Painel executivo' },
  '/receitas': { title: 'Receitas', subtitle: 'Entradas e faturamento' },
  '/despesas': { title: 'Despesas', subtitle: 'Saidas e custos operacionais' },
  '/multas': { title: 'Multas', subtitle: 'Infracoes e veiculos' },
  '/investidores': { title: 'Investidores', subtitle: 'Portfolio e retorno' },
  '/relatorios': { title: 'Relatorios', subtitle: 'Importacoes e qualidade' },
  '/importacoes': { title: 'Centro de Importacoes', subtitle: 'Lotes, auditoria e publicacao' },
  '/configuracoes': { title: 'Configuracoes', subtitle: 'Importacao e sistema' },
  '/categorias': { title: 'Categorias', subtitle: 'Normalizacao e ranking' },
  '/frota': { title: 'Frota / Operacao', subtitle: 'Veiculos e controle operacional' },
};

export function Topbar() {
  const pathname = usePathname();
  const info = pageInfo[pathname]
    || (pathname.startsWith('/frota/') ? { title: 'Detalhe do Veiculo', subtitle: 'Historico operacional' } : null)
    || (pathname.startsWith('/importacoes/') ? { title: 'Detalhe da Importacao', subtitle: 'Auditoria por lote' } : null)
    || { title: 'ClikFinance', subtitle: 'Gestao financeira' };

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
