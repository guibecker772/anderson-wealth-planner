'use client';

import { cn } from '@/lib/utils';

interface WorkspaceTopbarProps {
  workspaceLabel?: string;
  title: string;
  subtitle: string;
  leftMeta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function WorkspaceTopbar({
  workspaceLabel = 'Workspace',
  title,
  subtitle,
  leftMeta,
  actions,
  className,
}: WorkspaceTopbarProps) {
  return (
    <header
      className={cn(
        'sticky-shell-top flex min-h-[72px] items-center justify-between gap-4 rounded-[28px] border border-white/82 bg-white/94 px-5 py-3',
        className
      )}
      style={{ boxShadow: '0 14px 28px -26px rgba(2,45,68,0.16), inset 0 1px 0 rgba(255,255,255,0.78)' }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#022D44,#0b4e70)] text-white shadow-lg shadow-[#022D44]/12">
          <div className="h-2.5 w-2.5 rounded-full bg-[#A8CF4C]" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#022D44]/50">{workspaceLabel}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
              {title}
            </h1>
            {leftMeta}
          </div>
          <p className="truncate text-[12px] text-slate-600">{subtitle}</p>
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
