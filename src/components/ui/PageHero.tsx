'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  accent?: 'blue' | 'green' | 'amber';
  className?: string;
}

const accentMap = {
  blue: 'from-[#022D44] via-[#0b4868] to-[#8dc2d8]',
  green: 'from-[#0f5132] via-[#247553] to-[#a8cf4c]',
  amber: 'from-[#7b4210] via-[#b36818] to-[#f2b84c]',
};

export function PageHero({
  eyebrow,
  title,
  description,
  meta,
  actions,
  children,
  accent = 'blue',
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'page-hero relative overflow-hidden rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-elevated backdrop-blur-xl md:p-7',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-[28px]">
        <div className={cn('h-full w-full bg-gradient-to-r', accentMap[accent])} />
      </div>
      <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-[#A8CF4C]/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-16 h-28 w-28 rounded-full bg-[#022D44]/8 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? (
            <div className="inline-flex items-center rounded-full border border-[#022D44]/10 bg-[#022D44]/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#022D44]/70">
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#08283c] md:text-[2.5rem]">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
              {description}
            </p>
          </div>
          {meta ? (
            <div className="flex flex-wrap items-center gap-2">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>

      {children ? (
        <div className="relative mt-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}
