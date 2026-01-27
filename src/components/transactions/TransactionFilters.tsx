'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Calendar } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');

  const currentStatus = searchParams.get('status') || 'ALL';
  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';
  const currentPage = Number(searchParams.get('page') || '1');

  const showClearButton = useMemo(() => {
    return Boolean(
      searchParams.get('q') ||
        searchParams.get('status') ||
        searchParams.get('from') ||
        searchParams.get('to') ||
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

  const handleDatePreset = (preset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const today = new Date();

    const setRange = (from: Date, to: Date) => {
      params.set('from', from.toISOString().split('T')[0]);
      params.set('to', to.toISOString().split('T')[0]);
      params.set('page', '1');
      pushParams(params);
    };

    switch (preset) {
      case 'today': {
        setRange(today, today);
        return;
      }
      case '7days': {
        const from = new Date(today);
        from.setDate(today.getDate() - 7);
        setRange(from, today);
        return;
      }
      case 'thisMonth': {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setRange(from, to);
        return;
      }
      case 'lastMonth': {
        const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const to = new Date(today.getFullYear(), today.getMonth(), 0);
        setRange(from, to);
        return;
      }
      case 'clear': {
        params.delete('from');
        params.delete('to');
        params.set('page', '1');
        pushParams(params);
        return;
      }
      default:
        return;
    }
  };

  const clearAll = () => {
    router.push(pathname);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
      {/* Busca */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar descrição, fornecedor..."
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Status */}
      <div className="w-full md:w-[180px]">
        <Select
          value={currentStatus}
          onValueChange={(val) => updateParam('status', val === 'ALL' ? null : val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="SETTLED">Realizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Datas (Presets) */}
      <div className="w-full md:w-[220px]">
        <Select onValueChange={handleDatePreset}>
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 opacity-50" />
              <span className="truncate">
                {currentFrom ? `${currentFrom} → ${currentTo || currentFrom}` : 'Período'}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7days">Últimos 7 dias</SelectItem>
            <SelectItem value="thisMonth">Este mês</SelectItem>
            <SelectItem value="lastMonth">Mês passado</SelectItem>
            <SelectItem value="clear">Limpar datas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Limpar tudo */}
      {showClearButton && (
        <Button variant="ghost" size="icon" onClick={clearAll} title="Limpar filtros">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
