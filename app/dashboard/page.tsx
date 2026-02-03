import { Suspense } from 'react';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardCharts />
    </Suspense>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}