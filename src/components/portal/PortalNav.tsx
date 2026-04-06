'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Car,
  CircleDollarSign,
  LayoutDashboard,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/portal', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/portal/frota', label: 'Frota / Operações', icon: Car },
  { href: '/portal/receitas', label: 'Receitas', icon: TrendingUp },
  { href: '/portal/despesas', label: 'Despesas', icon: TrendingDown },
  { href: '/portal/multas', label: 'Multas', icon: AlertTriangle },
];

export function PortalNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isFirstLogin = session?.user?.firstLogin === true;
  const investorName = session?.user?.investorName || session?.user?.name || 'Investidor';
  const suffix = searchParams.toString();

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[linear-gradient(180deg,#082c40_0%,#0b3a53_46%,#0d4864_100%)] text-white',
        compact ? 'min-h-0 rounded-[24px]' : 'min-h-screen border-r border-white/10',
      )}
    >
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/15 bg-white/8 p-2 backdrop-blur-sm">
            <Image
              src="/brand/clikfinance-icon.svg"
              alt="ClikFinance"
              width={34}
              height={34}
              className="h-8 w-8"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Portal privado
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-white">ClikFinance</h2>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/48">
            Investidor
          </p>
          <p className="mt-1 text-sm font-medium text-white/92">{investorName}</p>
          <p className="mt-2 text-xs leading-5 text-white/58">
            Acompanhe carteira, frota, receitas, custos e eventos operacionais em um ambiente exclusivo.
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
          Navegação
        </div>
        <nav className="space-y-1.5">
          {links.map((link) => {
            const active = pathname === link.href;
            const disabled = isFirstLogin && link.href !== '/portal';
            const href = suffix ? `${link.href}?${suffix}` : link.href;

            return (
              <Link
                key={link.href}
                href={disabled ? '/portal' : href}
                aria-disabled={disabled}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all',
                  active
                    ? 'bg-white text-[#082c40] shadow-[0_16px_28px_rgba(0,0,0,0.18)]'
                    : 'text-white/78 hover:bg-white/10 hover:text-white',
                  disabled && 'pointer-events-none opacity-45',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                    active
                      ? 'bg-[#022D44]/8 text-[#022D44]'
                      : 'bg-white/8 text-white/70 group-hover:bg-white/12 group-hover:text-white',
                  )}
                >
                  <link.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 px-5 py-5">
        <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-white/80">
            <CircleDollarSign className="h-4 w-4 text-[#a8cf4c]" />
            <p className="text-sm font-medium">Cockpit do investidor</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/58">
            Leitura operacional da frota, receitas, custos e multas restrita à sua carteira.
          </p>
          {isFirstLogin ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Primeiro acesso
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
