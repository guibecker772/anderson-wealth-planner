'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Tags, 
  FileText, 
  Settings 
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
    <aside className="w-64 border-r h-screen bg-card fixed left-0 top-0 flex flex-col z-20">
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-xl tracking-tight text-primary">
          Anderson<span className="text-foreground">Fin</span>
        </span>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t text-xs text-muted-foreground">
        v0.1.0 (Alpha)
      </div>
    </aside>
  );
}