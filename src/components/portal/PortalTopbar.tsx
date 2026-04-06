'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileOutput, KeyRound, LogOut, ShieldCheck, User2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PortalTopbar() {
  const { data: session } = useSession();
  const investorName = session?.user?.investorName || session?.user?.name || 'Investidor';
  const isFirstLogin = session?.user?.firstLogin === true;
  const searchParams = useSearchParams();
  const isImpersonating = Boolean(searchParams.get('_as')) && session?.user?.role === 'ADMIN';
  const reportHref = `/portal/relatorio${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
      <div className="flex h-[82px] items-center justify-between gap-4 px-5 lg:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Portal do Investidor
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">ClikFinance</h1>
            {isImpersonating ? <Badge variant="warning" size="sm">Visualização administrativa</Badge> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <FileOutput className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar relatório</span>
          </Link>

          {!isFirstLogin ? (
            <Link
              href="/portal/trocar-senha"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Alterar senha</span>
            </Link>
          ) : null}

          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:inline-flex">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#022D44]/8 text-[#022D44]">
              <User2 className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{investorName}</p>
              <p className="text-xs text-slate-500">Área privada e exclusiva</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {isFirstLogin ? (
        <div className="border-t border-amber-200 bg-amber-50/90 px-5 py-2.5 text-xs text-amber-800 lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Primeiro acesso ativo. Troque a senha para liberar toda a navegação do portal.
          </div>
        </div>
      ) : null}
    </header>
  );
}
