'use client';

import { usePathname } from 'next/navigation';
import { PortalNav } from '@/components/portal/PortalNav';
import { PortalTopbar } from '@/components/portal/PortalTopbar';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReportRoute = pathname === '/portal/relatorio';

  if (isReportRoute) {
    return <div className="min-h-screen bg-[#f4f7f8]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff4f7_0%,#f8fbfc_100%)]">
      <div className="grid min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <PortalNav />
        </div>
        <div className="min-w-0">
          <PortalTopbar />
          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-5 block lg:hidden">
              <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
                <PortalNav compact />
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
