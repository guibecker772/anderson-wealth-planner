'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CircleDollarSign, ShieldCheck } from 'lucide-react';
import { WorkspaceSidebar } from '@/components/shell/WorkspaceSidebar';
import { portalNavGroups } from '@/components/portal/portal-shell-config';
import { buildPortalNavigationHref } from '@/lib/portalShell';

export function PortalNav({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isFirstLogin = session?.user?.firstLogin === true;
  const investorName = session?.user?.investorName || session?.user?.name || 'Investidor';

  return (
    <WorkspaceSidebar
      compact={compact}
      brand={{
        href: '/portal',
        title: 'ClikFinance',
        subtitle: 'Control Center',
        icon: (
          <div className="rounded-2xl border border-white/15 bg-white/8 p-2 backdrop-blur-sm">
            <Image
              src="/brand/clikfinance-icon.svg"
              alt="ClikFinance"
              width={34}
              height={34}
              className="h-8 w-8"
            />
          </div>
        ),
      }}
      groups={portalNavGroups}
      buildHref={(href) => {
        if (isFirstLogin && href !== '/portal') return '/portal';
        return buildPortalNavigationHref(href, searchParams);
      }}
      footer={(
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Investidor</p>
            <p className="mt-1 text-sm font-medium text-white/92">{investorName}</p>
            <p className="mt-2 text-[11px] leading-5 text-white/72">
              Cockpit privado para acompanhar receita, custos, multas e desempenho operacional da sua carteira.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
            <div className="flex items-center gap-2 text-white/90">
              <CircleDollarSign className="h-4 w-4 text-[#A8CF4C]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Carteira protegida</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-white/72">
              Ambiente exclusivo com leitura sincronizada do período global e acesso restrito ao seu portfólio.
            </p>
            {isFirstLogin ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Primeiro acesso
              </div>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
