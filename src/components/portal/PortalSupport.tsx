'use client';

import type { ReactNode } from 'react';
import { Clock3, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PortalInfoTooltip({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      <Info className="h-3.5 w-3.5 cursor-help text-slate-300 transition-colors group-hover/tip:text-slate-500" />
      <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-slate-700 opacity-0 shadow-xl transition-all group-hover/tip:visible group-hover/tip:opacity-100">
        {content}
      </span>
    </span>
  );
}

export function PortalContextStat({
  label,
  value,
  description,
  icon = <Clock3 className="h-4 w-4" />,
  className,
}: {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[22px] border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#022D44]/8 text-[#022D44]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function PortalEmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 text-center',
        compact ? 'px-5 py-8' : 'px-6 py-10',
        className,
      )}
    >
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
