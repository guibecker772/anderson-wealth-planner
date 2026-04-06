import { Suspense } from 'react';
import { PortalWorkspace } from '@/components/portal/PortalWorkspace';

export const metadata = {
  title: 'Frota | Portal do Investidor',
};

export default function PortalFleetPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center text-slate-400">Carregando...</div>}>
      <PortalWorkspace section="fleet" />
    </Suspense>
  );
}
