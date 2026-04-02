import { Suspense } from 'react';
import { PortalVehicleDetail } from '@/components/portal/PortalVehicleDetail';

interface Props {
  params: { placa: string };
}

export function generateMetadata({ params }: Props) {
  return { title: `${decodeURIComponent(params.placa)} — Portal` };
}

export default function PortalVehicleDetailPage({ params }: Props) {
  const plate = decodeURIComponent(params.placa);
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center text-slate-400">Carregando…</div>}>
      <PortalVehicleDetail plate={plate} />
    </Suspense>
  );
}
