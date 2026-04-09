import type { DateRangeStrings } from '@/lib/dateRange';

export const PORTAL_FLEET_FILTER_PARAM_KEYS = [
  'fleetStatus',
  'fleetSearch',
  'fleetAlert',
  'fleetCharge',
  'fleetQuality',
] as const;

function isValidDateRange(from: string | null, to: string | null) {
  return Boolean(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));
}

export function getPortalDateRangeFromSearchParams(searchParams: URLSearchParams): DateRangeStrings | null {
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!isValidDateRange(from, to)) return null;

  return { from: from!, to: to! };
}

export function buildPortalScopedSearchParams(
  currentSearch: string | URLSearchParams,
  options?: {
    dateRange?: DateRangeStrings | null;
    clearDateRange?: boolean;
  }
) {
  const nextParams = new URLSearchParams(
    typeof currentSearch === 'string' ? currentSearch : currentSearch.toString()
  );

  if (options?.clearDateRange) {
    nextParams.delete('from');
    nextParams.delete('to');
    return nextParams;
  }

  if (options?.dateRange) {
    nextParams.set('from', options.dateRange.from);
    nextParams.set('to', options.dateRange.to);
  }

  return nextParams;
}

export function buildPortalHref(
  pathname: string,
  currentSearch: string | URLSearchParams,
  options?: {
    dateRange?: DateRangeStrings | null;
    clearDateRange?: boolean;
  }
) {
  const nextParams = buildPortalScopedSearchParams(currentSearch, options);
  const query = nextParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function getPortalNavigationSearchParams(currentSearch: string | URLSearchParams) {
  const source = new URLSearchParams(
    typeof currentSearch === 'string' ? currentSearch : currentSearch.toString()
  );
  const nextParams = new URLSearchParams();

  for (const key of ['from', 'to', '_as']) {
    const value = source.get(key);
    if (value) nextParams.set(key, value);
  }

  return nextParams;
}

export function hasPortalFleetFilterState(currentSearch: string | URLSearchParams) {
  const source = new URLSearchParams(
    typeof currentSearch === 'string' ? currentSearch : currentSearch.toString()
  );

  return PORTAL_FLEET_FILTER_PARAM_KEYS.some((key) => {
    const value = source.get(key);
    return Boolean(value && value.trim() !== '');
  });
}

export function buildPortalNavigationHref(
  pathname: string,
  currentSearch: string | URLSearchParams,
) {
  const nextParams = getPortalNavigationSearchParams(currentSearch);
  const query = nextParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}
