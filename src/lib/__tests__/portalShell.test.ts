import {
  buildPortalHref,
  buildPortalNavigationHref,
  getPortalDateRangeFromSearchParams,
} from '@/lib/portalShell';

describe('portalShell', () => {
  it('reads a valid investor date range from the url', () => {
    const searchParams = new URLSearchParams('from=2026-03-01&to=2026-03-31&_as=inv_1');

    expect(getPortalDateRangeFromSearchParams(searchParams)).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });

  it('returns null when the url range is incomplete', () => {
    const searchParams = new URLSearchParams('from=2026-03-01');

    expect(getPortalDateRangeFromSearchParams(searchParams)).toBeNull();
  });

  it('applies a new date range while preserving investor query state', () => {
    const href = buildPortalHref('/portal/receitas', 'status=OPEN&_as=inv_1', {
      dateRange: { from: '2026-04-01', to: '2026-04-30' },
    });

    expect(href).toBe('/portal/receitas?status=OPEN&_as=inv_1&from=2026-04-01&to=2026-04-30');
  });

  it('builds navigation links preserving only the global portal params', () => {
    const href = buildPortalNavigationHref(
      '/portal/multas',
      'from=2026-04-01&to=2026-04-30&_as=inv_1&page=3&q=uno'
    );

    expect(href).toBe('/portal/multas?from=2026-04-01&to=2026-04-30&_as=inv_1');
  });
});
