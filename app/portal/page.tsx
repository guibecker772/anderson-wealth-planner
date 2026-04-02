import { Suspense } from 'react';
import { PortalDashboard } from '@/components/portal/PortalDashboard';

export const metadata = {
  title: 'Portal do Investidor',
};

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center text-slate-400">Carregando…</div>}>
      <PortalDashboard />
    </Suspense>
  );
}
