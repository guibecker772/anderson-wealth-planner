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

  const isPasswordRoute = pathname === '/portal/trocar-senha';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(168,207,76,0.12),transparent_20%),radial-gradient(circle_at_top_right,rgba(2,45,68,0.08),transparent_18%)]" />

      <div className="fixed left-4 top-4 z-30 hidden lg:block">
        <PortalNav />
      </div>

      <main className="relative z-10 min-h-screen px-4 pb-10 pt-6 sm:px-6 lg:ml-72 lg:px-6 lg:pt-24">
        <div className={`mx-auto w-full max-w-[1600px] animate-in ${isPasswordRoute ? 'max-w-5xl' : ''}`}>
          <PortalTopbar />
          <div className="mb-5 block lg:hidden">
            <div className="overflow-hidden rounded-[24px] border border-white/60 bg-white/90 shadow-sm backdrop-blur-xl">
              <PortalNav compact />
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
