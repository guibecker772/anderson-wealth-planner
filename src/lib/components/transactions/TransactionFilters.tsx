'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/lib/components/layout/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/layout/ui/select';
import { Button } from '@/lib/components/layout/ui/button';
import { Search, X, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Estado local para input controlado
  const [query, setQuery] = useState(searchParams.get('q') || '');

  // Debounce da busca
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query !== (searchParams.get('q') || '')) {
        updateParam('q', query);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [query]);

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reseta página ao filtrar
    if (key !== 'page') params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const handleDatePreset = (preset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const today = new Date();
    let from, to;

    switch (preset) {
      case 'today':
        from = today;
        to = today;
        break;
      case '7days':
        from = new Date();
        from.setDate(today.getDate() - 7);
        to = today;
        break;
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'clear':
        params.delete('from');
        params.delete('to');
        params.set('page', '1');
        router.push(`?${params.toString()}`);
        return;
    }

    if (from && to) {
      params.set('from', from.toISOString().split('T')[0]);
      params.set('to', to.toISOString().split('T')[0]);
      params.set('page', '1');
      router.push(`?${params.toString()}`);
    }
  };

  const handleClearFilters = () => {
    setQuery('');
    router.push(pathname);
  };

  const currentStatus = searchParams.get('status') || 'ALL';
  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';
  const currentQ = searchParams.get('q') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');

  // Mostrar botão de limpar se existir qualquer filtro ativo
  const hasActiveFilters = currentQ || currentStatus !== 'ALL' || currentFrom || currentTo || currentPage > 1;

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
      
      {/* Busca Textual */}
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
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="SETTLED">Realizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Presets */}
      <div className="w-full md:w-[200px]">
        <Select onValueChange={handleDatePreset}>
          <SelectTrigger>
            <Calendar className="w-4 h-4 mr-2 opacity-50"/>
            <span className="truncate">
                {currentFrom ? `${currentFrom} até ${currentTo}` : 'Período'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7days">Últimos 7 dias</SelectItem>
            <SelectItem value="thisMonth">Este Mês</SelectItem>
            <SelectItem value="lastMonth">Mês Passado</SelectItem>
            <SelectItem value="clear" className="text-red-500">Limpar Datas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Limpar Filtros */}
      {hasActiveFilters && (
         <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClearFilters}
            title="Limpar todos os filtros"
         >
            <X className="h-4 w-4" />
         </Button>
      )}
    </div>
  );
}