'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Car, LayoutDashboard, LogOut, KeyRound, User } from 'lucide-react';

export function PortalNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const investorName = session?.user?.investorName || session?.user?.name || '';
  const isFirstLogin = session?.user?.firstLogin === true;

  const links = isFirstLogin
    ? []
    : [
        { href: '/portal', label: 'Painel', icon: LayoutDashboard },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand + nav */}
        <div className="flex items-center gap-8">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#022D44] text-white">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900">ClikFinance</span>
              <span className="ml-1 text-[10px] font-medium text-slate-400">Portal</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#022D44]/10 text-[#022D44]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span className="font-medium">{investorName}</span>
          </div>
          {!isFirstLogin && (
            <Link
              href="/portal/trocar-senha"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Alterar senha"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
