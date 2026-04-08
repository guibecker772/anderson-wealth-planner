'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DateRangeStrings } from '@/lib/dateRange';
import { buildPortalHref, getPortalDateRangeFromSearchParams } from '@/lib/portalShell';

interface PortalDateRangeContextValue {
  dateRange: DateRangeStrings | null;
  setDateRange: (range: DateRangeStrings) => void;
  clear: () => void;
  syncResolvedDateRange: (range: DateRangeStrings) => void;
}

const PortalDateRangeContext = createContext<PortalDateRangeContextValue | null>(null);

export function PortalDateRangeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const explicitRange = useMemo(
    () => getPortalDateRangeFromSearchParams(searchParams),
    [searchParams]
  );
  const [dateRange, setDateRangeState] = useState<DateRangeStrings | null>(explicitRange);

  useEffect(() => {
    setDateRangeState(explicitRange);
  }, [explicitRange?.from, explicitRange?.to]);

  const setDateRange = useCallback((range: DateRangeStrings) => {
    setDateRangeState(range);
    router.push(buildPortalHref(pathname, searchParamsKey, { dateRange: range }));
  }, [pathname, router, searchParamsKey]);

  const clear = useCallback(() => {
    setDateRangeState(null);
    router.push(buildPortalHref(pathname, searchParamsKey, { clearDateRange: true }));
  }, [pathname, router, searchParamsKey]);

  const syncResolvedDateRange = useCallback((range: DateRangeStrings) => {
    if (explicitRange) return;

    setDateRangeState((current) => {
      if (current?.from === range.from && current?.to === range.to) return current;
      return range;
    });
    router.replace(buildPortalHref(pathname, searchParamsKey, { dateRange: range }));
  }, [explicitRange, pathname, router, searchParamsKey]);

  return (
    <PortalDateRangeContext.Provider value={{ dateRange, setDateRange, clear, syncResolvedDateRange }}>
      {children}
    </PortalDateRangeContext.Provider>
  );
}

export function usePortalDateRange() {
  const context = useContext(PortalDateRangeContext);

  if (!context) {
    throw new Error('usePortalDateRange must be used within PortalDateRangeProvider');
  }

  return context;
}
