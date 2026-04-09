'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ShellBrandConfig, ShellNavGroup } from './types';

interface WorkspaceSidebarProps {
  brand: ShellBrandConfig;
  groups: ShellNavGroup[];
  footer: React.ReactNode;
  buildHref?: (href: string) => string;
  getGroupProps?: (groupLabel: string) => React.HTMLAttributes<HTMLDivElement> | undefined;
  getItemProps?: (href: string) => React.HTMLAttributes<HTMLAnchorElement> | undefined;
  compact?: boolean;
  className?: string;
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({
  brand,
  groups,
  footer,
  buildHref = (href) => href,
  getGroupProps,
  getItemProps,
  compact = false,
  className,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#07283a_0%,#0a3348_26%,#08283a_100%)] text-white shadow-[0_24px_54px_-36px_rgba(2,45,68,0.58)]',
        compact ? 'min-h-0' : 'h-[calc(100vh-2rem)] w-64',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,207,76,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%)]" />

      <div className="relative flex h-24 items-center px-6">
        <Link href={brand.href} className="group flex items-center gap-3">
          {brand.icon}
          <div>
            <span className="text-xl font-semibold tracking-[-0.04em]">{brand.title}</span>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#A8CF4C]/90">{brand.subtitle}</p>
          </div>
        </Link>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 pb-4 pt-2 scrollbar-none">
        {groups.map((group) => (
          <div key={group.label} {...getGroupProps?.(group.label)}>
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#A8CF4C]">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = !item.disabled && isItemActive(pathname, item.href);
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white/90"
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0 text-white/90" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-white/[0.14] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={buildHref(item.href)}
                    {...getItemProps?.(item.href)}
                    className={cn(
                      'relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium transition-all duration-200',
                      isActive
                        ? 'border border-[#A8CF4C]/16 bg-[linear-gradient(135deg,rgba(168,207,76,0.14),rgba(168,207,76,0.04))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'border border-transparent text-white/80 hover:border-white/[0.05] hover:bg-white/[0.05] hover:text-white'
                    )}
                  >
                    {isActive ? <div className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#A8CF4C]" /> : null}
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        isActive ? 'text-[#A8CF4C]' : 'text-white/70'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-white/[0.12] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/90">
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <span className="h-2 w-2 rounded-full bg-[#A8CF4C]" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/[0.06] px-4 py-4">
        {footer}
      </div>
    </aside>
  );
}
