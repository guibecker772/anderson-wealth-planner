'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Truck,
  type LucideIcon,
  Users,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Gestão',
    items: [
      { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
      { href: '/investidores', label: 'Investidores', icon: Users },
      { href: '/multas', label: 'Multas', icon: AlertTriangle },
      { href: '/frota', label: 'Frota / Operação', icon: Truck },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/receitas', label: 'Receitas', icon: ArrowUpCircle },
      { href: '/despesas', label: 'Despesas', icon: ArrowDownCircle },
      { href: '/relatorios', label: 'Relatórios', icon: FileText },
    ],
  },
  {
    label: 'Sistema',
    items: [{ href: '/configuracoes', label: 'Configurações', icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(href: string) {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) return `${href}?from=${from}&to=${to}`;
    return href;
  }

  return (
    <aside className="fixed left-4 top-4 z-30 flex h-[calc(100vh-2rem)] w-64 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#07283a_0%,#0a3348_26%,#08283a_100%)] shadow-[0_24px_54px_-36px_rgba(2,45,68,0.58)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,207,76,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%)]" />

      <div className="relative flex h-24 items-center px-6">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inner shadow-white/5">
              <div className="flex items-end gap-[3px]">
                <div className="h-[11px] w-[5px] rounded-[2px] bg-[#A8CF4C] transition-all group-hover:h-[13px]" />
                <div className="h-[18px] w-[5px] rounded-[2px] bg-[#A8CF4C] transition-all group-hover:h-[20px]" />
                <div className="h-[24px] w-[5px] rounded-[2px] bg-[#A8CF4C] transition-all group-hover:h-[26px]" />
              </div>
            </div>
            <TrendingUp className="-ml-2 -mt-4 h-3.5 w-3.5 text-white/80 transition-colors group-hover:text-white" />
          </div>
          <div>
            <span className="text-xl font-semibold tracking-[-0.04em]">
              <span className="text-white">Clik</span>
              <span className="text-[#A8CF4C]">Finance</span>
            </span>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#A8CF4C]/90">Control Center</p>
          </div>
        </Link>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 pb-4 pt-2 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#A8CF4C]">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = !item.disabled && pathname.startsWith(item.href);
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white/90"
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0 text-white/90" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-white/[0.14] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={buildHref(item.href)}
                    className={cn(
                      'relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium transition-all duration-200',
                      isActive
                        ? 'border border-[#A8CF4C]/16 bg-[linear-gradient(135deg,rgba(168,207,76,0.14),rgba(168,207,76,0.04))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'border border-transparent text-white/80 hover:border-white/[0.05] hover:bg-white/[0.05] hover:text-white'
                    )}
                  >
                    {isActive ? <div className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#A8CF4C]" /> : null}
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        isActive ? 'text-[#A8CF4C]' : 'text-white/70'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isActive ? <span className="h-2 w-2 rounded-full bg-[#A8CF4C]" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/[0.06] px-4 py-4">
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
      </div>
    </aside>
  );
}
