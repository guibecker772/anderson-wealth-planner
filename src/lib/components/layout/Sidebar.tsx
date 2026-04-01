'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  FileText, 
  Settings,
  TrendingUp,
  AlertTriangle,
  Users,
  Truck,
  type LucideIcon,
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
      { href: '/frota', label: 'Frota / Operação', icon: Truck, disabled: true, badge: 'Em breve' },
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
    items: [
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Preserve current date range params when navigating
  function buildHref(href: string) {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) return `${href}?from=${from}&to=${to}`;
    return href;
  }

  return (
    <aside className="w-64 h-screen bg-[#022D44] fixed left-0 top-0 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex items-center gap-1.5">
            <div className="flex items-end gap-[3px]">
              <div className="w-[5px] h-[10px] bg-[#A8CF4C] rounded-[2px]" />
              <div className="w-[5px] h-[16px] bg-[#A8CF4C] rounded-[2px]" />
              <div className="w-[5px] h-[22px] bg-[#A8CF4C] rounded-[2px]" />
            </div>
            <TrendingUp className="w-3 h-3 text-white -ml-1 -mt-3" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">Clik</span>
            <span className="text-[#A8CF4C]">Finance</span>
          </span>
        </Link>
      </div>
      
      {/* Grouped Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = !item.disabled && pathname.startsWith(item.href);
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white/25 cursor-not-allowed"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] uppercase tracking-wide bg-white/10 text-white/35 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.href}
                    href={buildHref(item.href)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                      isActive 
                        ? "bg-[#A8CF4C]/15 text-[#A8CF4C] border-l-2 border-[#A8CF4C] -ml-0.5 pl-[calc(0.75rem+2px)]" 
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/40">
          <span className="font-medium text-white/60">ClikFinance</span>
          {' '}v1.0.0
        </div>
      </div>
    </aside>
  );
}