'use client';

import { GlobalDateRangeControl } from '@/components/ui/GlobalDateRangeControl';
import { useDateRange } from '@/lib/components/DateRangeContext';

export function GlobalDateRangePicker({ className = '' }: { className?: string }) {
  const { dateRange, setDateRange, clear } = useDateRange();

  return (
    <GlobalDateRangeControl
      className={className}
      controller={{ dateRange, setDateRange, clear }}
    />
  );
}
