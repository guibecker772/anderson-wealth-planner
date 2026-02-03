'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X, SlidersHorizontal } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseDateRangeFromParams, formatDateDisplay } from '@/lib/dateRange';
import { DateRangeBadge } from '@/components/ui/DateRangePicker';
import { transactionStatusOptions } from '@/lib/i18n/statusLabels';

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');

  const currentStatus = searchParams.get('status') || 'ALL';
  const currentPage = Number(searchParams.get('page') || '1');
  
  // Get current date range from URL (synced with global DateRangePicker in Topbar)
  const dateRange = parseDateRangeFromParams(searchParams);

  const showClearButton = useMemo(() => {
    return Boolean(
      searchParams.get('q') ||
        searchParams.get('status') ||
        currentPage > 1
    );
  }, [searchParams, currentPage]);

  const pushParams = (params: URLSearchParams) => {
    const qs = params.toString();
    router.push(qs ? `?${qs}` : pathname);
  };

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value.trim().length > 0) params.set(key, value);
    else params.delete(key);

    // sempre reseta paginação quando muda filtro
    if (key !== 'page') params.set('page', '1');

    pushParams(params);
  };

  // Debounce para busca
  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get('q') || '';
      if (query !== current) updateParam('q', query);
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clearAll = () => {
    // Keep date range when clearing, only clear other filters
    const params = new URLSearchParams();
    params.set('from', dateRange.from);
    params.set('to', dateRange.to);
    router.push(`${pathname}?${params.toString()}`);
    setQuery('');
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 p-4 bg-card rounded-xl border shadow-sm">
      {/* Filter Icon */}
      <div className="hidden md:flex items-center text-muted-foreground">
        <SlidersHorizontal className="w-4 h-4" />
      </div>
      
      {/* Busca */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar descrição, fornecedor..."
          className="pl-9 bg-background"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Status - Usando opções traduzidas */}
      <div className="w-full md:w-[180px]">
        <Select
          value={currentStatus}
          onValueChange={(val) => updateParam('status', val === 'ALL' ? null : val)}
        >
          <SelectTrigger className="bg-background">
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
      </div>

      {/* Date Range Badge (shows current global filter) */}
      <div className="flex items-center">
        <DateRangeBadge from={dateRange.from} to={dateRange.to} />
      </div>

      {/* Limpar filtros (exceto datas) */}
      {showClearButton && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={clearAll} 
          title="Limpar filtros"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}