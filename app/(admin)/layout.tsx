import { Sidebar } from '@/lib/components/layout/Sidebar';
import { Topbar } from '@/lib/components/layout/Topbar';
import { DateRangeProvider } from '@/lib/components/DateRangeContext';
import { Suspense } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <DateRangeProvider>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(168,207,76,0.12),transparent_20%),radial-gradient(circle_at_top_right,rgba(2,45,68,0.08),transparent_18%)]" />
          <Sidebar />
          <Topbar />
          <main className="relative z-10 ml-72 min-h-screen px-6 pb-10 pt-28">
            <div className="mx-auto max-w-[1600px] animate-in">
              {children}
            </div>
          </main>
        </div>
      </DateRangeProvider>
    </Suspense>
  );
}
