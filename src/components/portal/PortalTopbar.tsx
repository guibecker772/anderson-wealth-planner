'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookOpen, FileOutput, KeyRound, LogOut, ShieldCheck, User2 } from 'lucide-react';
import { WorkspaceTopbar } from '@/components/shell/WorkspaceTopbar';
import { Badge } from '@/components/ui/badge';
import { PortalGlobalDateRangePicker } from '@/components/portal/PortalGlobalDateRangePicker';
import { getPortalPageMeta } from '@/components/portal/portal-shell-config';
import { buildPortalNavigationHref } from '@/lib/portalShell';

function TopbarActions({
  reportHref,
  investorName,
  isFirstLogin,
  showGuideAction,
  onOpenGuide,
}: {
  reportHref: string;
  investorName: string;
  isFirstLogin: boolean;
  showGuideAction: boolean;
  onOpenGuide?: () => void;
}) {
  return (
    <>
      <PortalGlobalDateRangePicker />
      {showGuideAction ? (
        <button
          type="button"
          onClick={onOpenGuide}
          data-portal-tour="guide-action"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden xl:inline">Como usar o portal</span>
        </button>
      ) : null}
      <Link
        href={reportHref}
        target="_blank"
        rel="noopener noreferrer"
        data-portal-tour="report-action"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <FileOutput className="h-4 w-4" />
        <span className="hidden xl:inline">Gerar relatório</span>
      </Link>

      {!isFirstLogin ? (
        <Link
          href="/portal/trocar-senha"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <KeyRound className="h-4 w-4" />
          <span className="hidden xl:inline">Alterar senha</span>
        </Link>
      ) : null}

      <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm 2xl:inline-flex">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#022D44]/8 text-[#022D44]">
          <User2 className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{investorName}</p>
          <p className="text-xs text-slate-500">Acesso privado do investidor</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden xl:inline">Sair</span>
      </button>
    </>
  );
}

export function PortalTopbar({ onOpenGuide }: { onOpenGuide?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const pageMeta = getPortalPageMeta(pathname);
  const investorName = session?.user?.investorName || session?.user?.name || 'Investidor';
  const isFirstLogin = session?.user?.firstLogin === true;
  const isImpersonating = Boolean(searchParams.get('_as')) && session?.user?.role === 'ADMIN';
  const showGuideAction = session?.user?.role === 'INVESTOR' && !isFirstLogin;
  const reportHref = buildPortalNavigationHref('/portal/relatorio', searchParams);

  const actions = (
    <TopbarActions
      reportHref={reportHref}
      investorName={investorName}
      isFirstLogin={isFirstLogin}
      showGuideAction={showGuideAction}
      onOpenGuide={onOpenGuide}
    />
  );

  return (
    <>
      <div className="sticky-shell-top fixed left-[18rem] right-6 z-40 hidden lg:block" data-portal-tour="workspace-header">
        <WorkspaceTopbar
          workspaceLabel={pageMeta.workspaceLabel}
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          leftMeta={isImpersonating ? <Badge variant="warning" size="sm">Visualização administrativa</Badge> : null}
          actions={actions}
        />
      </div>

      <div className="mb-5 space-y-3 lg:hidden" data-portal-tour="workspace-header">
        <WorkspaceTopbar
          workspaceLabel={pageMeta.workspaceLabel}
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          leftMeta={isImpersonating ? <Badge variant="warning" size="sm">Visualização administrativa</Badge> : null}
          actions={actions}
          className="flex-col items-start"
        />
      </div>

      {isFirstLogin ? (
        <div className="mb-5 rounded-[20px] border border-amber-200 bg-amber-50/90 px-5 py-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Primeiro acesso em andamento. Defina sua nova senha para liberar toda a navegação do portal.
          </div>
        </div>
      ) : null}
    </>
  );
}
