'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { FleetResponse } from '@/lib/analytics/fleet-metrics';
import { usePortalDateRange } from '@/components/portal/PortalDateRangeContext';

export function usePortalFleetData() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const impersonateId = searchParams.get('_as');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const hasExplicitRange = Boolean(from && to);
  const isImpersonating = Boolean(impersonateId) && session?.user?.role === 'ADMIN';
  const investorName = isImpersonating
    ? 'Investidor em visualização administrativa'
    : (session?.user?.investorName || session?.user?.name || 'Investidor');
  const {
    dateRange: globalDateRange,
    syncResolvedDateRange,
  } = usePortalDateRange();

  const [data, setData] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(
    () => globalDateRange ?? data?.dateRange ?? (from && to ? { from, to } : null),
    [data?.dateRange, from, globalDateRange, to],
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from && to) {
          params.set('from', from);
          params.set('to', to);
        }
        if (impersonateId) params.set('_as', impersonateId);

        const res = await fetch(`/api/portal/fleet?${params.toString()}`);
        if (res.status === 401) {
          setError('Sessão expirada. Faça login novamente.');
          return;
        }
        if (res.status === 403) {
          setError('Acesso não autorizado.');
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar dados do portal');

        const json: FleetResponse = await res.json();
        setData(json);

        if (!hasExplicitRange && json.dateRange) {
          syncResolvedDateRange(json.dateRange);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [from, to, impersonateId, hasExplicitRange, pathname, router, searchParamsKey, syncResolvedDateRange]);

  return {
    data,
    loading,
    error,
    dateRange,
    investorName,
    isImpersonating,
    impersonateId,
  };
}
