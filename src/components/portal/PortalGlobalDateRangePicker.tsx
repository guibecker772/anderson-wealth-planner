'use client';

import { GlobalDateRangeControl } from '@/components/ui/GlobalDateRangeControl';
import { usePortalDateRange } from '@/components/portal/PortalDateRangeContext';

export function PortalGlobalDateRangePicker({ className = '' }: { className?: string }) {
  const { dateRange, setDateRange, clear } = usePortalDateRange();

  return (
    <div data-portal-tour="global-filter">
      <GlobalDateRangeControl
        className={className}
        emptyLabel="Período da carteira"
        emptyDetail="Período definido pela base do investidor"
        controller={{ dateRange, setDateRange, clear }}
      />
    </div>
  );
}
