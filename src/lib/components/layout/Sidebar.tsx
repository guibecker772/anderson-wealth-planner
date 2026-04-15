'use client';

import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  DatabaseZap,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';

import { WorkspaceSidebar } from '@/components/shell/WorkspaceSidebar';
import type { ShellNavGroup } from '@/components/shell/types';

const navGroups: ShellNavGroup[] = [
  {
    label: 'Gestao',
    items: [
      { href: '/dashboard', label: 'Visao Geral', icon: LayoutDashboard },
      { href: '/investidores', label: 'Investidores', icon: Users },
      { href: '/multas', label: 'Multas', icon: AlertTriangle },
      { href: '/frota', label: 'Frota / Operacao', icon: Truck },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/receitas', label: 'Receitas', icon: ArrowUpCircle },
      { href: '/despesas', label: 'Despesas', icon: ArrowDownCircle },
      { href: '/relatorios', label: 'Relatorios', icon: FileText },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/importacoes', label: 'Centro de Importacoes', icon: DatabaseZap },
      { href: '/configuracoes/usuarios', label: 'Gestao de Acessos', icon: ShieldCheck },
      { href: '/configuracoes', label: 'Configuracoes', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const searchParams = useSearchParams();

  function buildHref(href: string) {
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (from && to) return `${href}?from=${from}&to=${to}`;

    return href;
  }

  return (
    <div className="fixed left-4 top-4 z-30 hidden lg:block">
      <WorkspaceSidebar
        brand={{
          href: '/dashboard',
          title: (
            <>
              <span className="text-white">Clik</span>
              <span className="text-[#A8CF4C]">Finance</span>
            </>
          ),
          subtitle: 'Control Center',
          icon: (
            <div className="flex items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inner shadow-white/5">
                <div className="flex items-end gap-[3px]">
                  <div className="h-[11px] w-[5px] rounded-[2px] bg-[#A8CF4C]" />
                  <div className="h-[18px] w-[5px] rounded-[2px] bg-[#A8CF4C]" />
                  <div className="h-[24px] w-[5px] rounded-[2px] bg-[#A8CF4C]" />
                </div>
              </div>
              <TrendingUp className="-ml-2 -mt-4 h-3.5 w-3.5 text-white/80" />
            </div>
          ),
        }}
        groups={navGroups}
        buildHref={buildHref}
        footer={(
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#A8CF4C]" />
              <span className="text-[11px] text-white/90">
                <span className="font-medium text-white">ClikFinance</span> v1.0.0
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-white/90">
              Camadas operacional, financeira e multas sincronizadas no mesmo cockpit.
            </p>
          </div>
        )}
      />
    </div>
  );
}
