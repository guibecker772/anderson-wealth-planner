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
    subtitle: 'Leitura consolidada da carteira, da frota e do periodo selecionado.',
  },
  '/portal/frota': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Frota / Operações',
    subtitle: 'Acompanhamento operacional da carteira com foco em veiculos e status atuais.',
  },
  '/portal/receitas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Receitas',
    subtitle: 'Entradas operacionais da carteira dentro do periodo global selecionado.',
  },
  '/portal/despesas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Despesas',
    subtitle: 'Custos operacionais consolidados da carteira no mesmo recorte global.',
  },
  '/portal/multas': {
    workspaceLabel: 'Portal do Investidor',
    title: 'Multas',
    subtitle: 'Ocorrencias financeiras de multa e atraso restritas a sua carteira.',
  },
  '/portal/trocar-senha': {
    workspaceLabel: 'Area Privada',
    title: 'Segurança da Conta',
    subtitle: 'Atualize sua senha para manter o acesso protegido ao portal privado.',
  },
};

export function getPortalPageMeta(pathname: string): ShellPageMeta {
  if (pathname.startsWith('/portal/veiculos/')) {
    return {
      workspaceLabel: 'Portal do Investidor',
      title: 'Detalhe do Veículo',
      subtitle: 'Historico operacional e leitura consolidada do veiculo selecionado.',
    };
  }

  return pageInfo[pathname] ?? {
    workspaceLabel: 'Portal do Investidor',
    title: 'ClikFinance',
    subtitle: 'Cockpit privado da sua carteira.',
  };
}
