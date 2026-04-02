import { PortalNav } from '@/components/portal/PortalNav';

export const metadata = {
  title: 'Portal do Investidor',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <PortalNav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
