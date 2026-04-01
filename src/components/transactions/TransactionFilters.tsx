'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseDateRangeFromParams } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { transactionStatusOptions } from '@/lib/i18n/statusLabels';

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const currentStatus = searchParams.get('status') || 'ALL';
  const currentPage = Number(searchParams.get('page') || '1');
  const dateRange = parseDateRangeFromParams(searchParams);

  const showClearButton = useMemo(() => {
    return Boolean(searchParams.get('q') || searchParams.get('status') || currentPage > 1);
  }, [searchParams, currentPage]);

  const pushParams = (params: URLSearchParams) => {
    const qs = params.toString();
    router.push(qs ? `?${qs}` : pathname);
  };

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value.trim().length > 0) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    pushParams(params);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get('q') || '';
      if (query !== current) updateParam('q', query);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clearAll = () => {
    const params = new URLSearchParams();
    params.set('from', dateRange.from);
    params.set('to', dateRange.to);
    router.push(`${pathname}?${params.toString()}`);
    setQuery('');
  };

  return (
    <div className="glass-panel p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Filtros da tabela</p>
            <p className="text-sm text-slate-600">Busca, status e período global integrados em um único bloco.</p>
          </div>
        </div>
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição, fornecedor ou categoria..."
            className="h-12 rounded-2xl border-white/70 bg-white/85 pl-10 shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Select value={currentStatus} onValueChange={(val) => updateParam('status', val === 'ALL' ? null : val)}>
          <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/85 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {transactionStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showClearButton ? (
          <Button
            variant="ghost"
            onClick={clearAll}
            title="Limpar filtros"
            className="h-12 rounded-2xl border border-white/70 bg-white/80 px-4 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
          >
            <X className="mr-2 h-4 w-4" />
            Limpar
          </Button>
        ) : (
          <div className="hidden xl:block" />
        )}
      </div>
    </div>
  );
}
