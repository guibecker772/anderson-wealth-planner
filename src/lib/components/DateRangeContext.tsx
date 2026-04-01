'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getDefaultDateRange, getPresetRange, type DatePreset, type DateRangeStrings } from '@/lib/dateRange';

const STORAGE_KEY = 'clikfinance-date-range';

interface DateRangeContextType {
  dateRange: DateRangeStrings;
  setDateRange: (range: DateRangeStrings) => void;
  applyPreset: (preset: DatePreset) => void;
  clear: () => void;
}

const DateRangeContext = createContext<DateRangeContextType | null>(null);

function loadFromStorage(): DateRangeStrings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.from && parsed.to) return parsed as DateRangeStrings;
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(range: DateRangeStrings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  } catch { /* ignore */ }
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL params or default — never localStorage here
  // (localStorage reads differ between SSR and hydration, causing mismatch)
  const [dateRange, setDateRangeState] = useState<DateRangeStrings>(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    if (fromParam && toParam) return { from: fromParam, to: toParam };
    return getDefaultDateRange();
  });

  // On mount / route change: if URL lacks date params, restore from localStorage or use default
  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    if (!fromParam || !toParam) {
      const stored = loadFromStorage();
      const range = stored ?? getDefaultDateRange();

      setDateRangeState(range);

      const params = new URLSearchParams(searchParams.toString());
      params.set('from', range.from);
      params.set('to', range.to);
      router.replace(`${pathname}?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Sync URL → context when URL params change (e.g. browser back/forward)
  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    if (fromParam && toParam && (fromParam !== dateRange.from || toParam !== dateRange.to)) {
      setDateRangeState({ from: fromParam, to: toParam });
      saveToStorage({ from: fromParam, to: toParam });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setDateRange = useCallback((range: DateRangeStrings) => {
    setDateRangeState(range);
    saveToStorage(range);
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', range.from);
    params.set('to', range.to);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const applyPreset = useCallback((preset: DatePreset) => {
    const range = getPresetRange(preset);
    setDateRange(range);
  }, [setDateRange]);

  const clear = useCallback(() => {
    const range = getDefaultDateRange();
    setDateRange(range);
  }, [setDateRange]);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, applyPreset, clear }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextType {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
