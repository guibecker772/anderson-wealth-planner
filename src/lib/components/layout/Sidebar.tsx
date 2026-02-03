'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Tags, 
  FileText, 
  Settings,
  TrendingUp
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/receitas', label: 'Receitas', icon: ArrowUpCircle },
  { href: '/despesas', label: 'Despesas', icon: ArrowDownCircle },
  { href: '/categorias', label: 'Categorias', icon: Tags },
  { href: '/relatorios', label: 'Relatórios', icon: FileText },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-[#022D44] fixed left-0 top-0 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          {/* Icon */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-end gap-[3px]">
              <div className="w-[5px] h-[10px] bg-[#A8CF4C] rounded-[2px]" />
              <div className="w-[5px] h-[16px] bg-[#A8CF4C] rounded-[2px]" />
              <div className="w-[5px] h-[22px] bg-[#A8CF4C] rounded-[2px]" />
            </div>
            <TrendingUp className="w-3 h-3 text-white -ml-1 -mt-3" />
          </div>
          {/* Wordmark */}
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">Clik</span>
            <span className="text-[#A8CF4C]">Finance</span>
          </span>
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
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