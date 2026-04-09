'use client';

import {
  AlertTriangle,
  Car,
  FileText,
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ShellNavGroup, ShellPageMeta } from '@/components/shell/types';

export const portalNavGroups: ShellNavGroup[] = [
  {
    label: 'Gestão',
    items: [
      { href: '/portal', label: 'Visão Geral', icon: LayoutDashboard },
      { href: '/portal/frota', label: 'Frota / Operações', icon: Car },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/portal/receitas', label: 'Receitas', icon: TrendingUp },
      { href: '/portal/despesas', label: 'Despesas', icon: TrendingDown },
      { href: '/portal/multas', label: 'Multas', icon: AlertTriangle },
      { href: '/portal/relatorio', label: 'Relatórios', icon: FileText },
    ],
  },
];

const pageInfo: Record<string, ShellPageMeta> = {
  '/portal': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Visão Geral',
    subtitle: 'Resumo executivo da carteira com leitura operacional e financeira no período selecionado.',
  },
  '/portal/frota': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Frota / Operações',
    subtitle: 'Acompanhamento da frota com foco em status, locatário exibido e sinais que pedem atenção.',
  },
  '/portal/receitas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Receitas',
    subtitle: 'Entradas operacionais da carteira com leitura clara do recebido e do valor ainda em cobrança.',
  },
  '/portal/despesas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Despesas',
    subtitle: 'Custos operacionais consolidados com leitura simples de manutenção, multas e descontos.',
  },
  '/portal/multas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Multas',
    subtitle: 'Ocorrências de multa e atraso com impacto financeiro restrito à sua carteira.',
  },
  '/portal/trocar-senha': {
    workspaceLabel: 'Área Privada',
    title: 'Segurança da Conta',
    subtitle: 'Atualize sua senha para manter o acesso protegido ao portal privado.',
  },
};

export function getPortalPageMeta(pathname: string): ShellPageMeta {
  if (pathname.startsWith('/portal/veiculos/')) {
    return {
      workspaceLabel: 'Portal do Investidor',
      title: 'Detalhe do Veículo',
      subtitle: 'Histórico operacional do veículo com comparação entre períodos e qualidade da base.',
    };
  }

  return pageInfo[pathname] ?? {
    workspaceLabel: 'Portal do Investidor',
    title: 'ClikFinance',
    subtitle: 'Cockpit privado da sua carteira.',
  };
}
