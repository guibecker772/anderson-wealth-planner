'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  getPresetRange, 
  getDateRangeLabel, 
  parseDateRangeFromParams,
  formatDateString,
  formatDateDisplay,
  type DatePreset,
  type DateRangeStrings,
} from '@/lib/dateRange';

interface DateRangePickerProps {
  className?: string;
  showLabel?: boolean;
}

export function DateRangePicker({ className = '', showLabel = true }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  
  // Current date range from URL
  const currentRange = parseDateRangeFromParams(searchParams);
  const displayLabel = getDateRangeLabel(currentRange);
  
  // Sync custom inputs with URL params
  useEffect(() => {
    setCustomFrom(currentRange.from);
    setCustomTo(currentRange.to);
  }, [currentRange.from, currentRange.to]);
  
  const updateDateRange = useCallback((range: DateRangeStrings) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', range.from);
    params.set('to', range.to);
    // Reset page when changing date range
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);
  
  const handlePresetSelect = (preset: string) => {
    if (preset === 'custom') {
      setIsOpen(true);
      return;
    }
    
    const range = getPresetRange(preset as DatePreset);
    updateDateRange(range);
    setIsOpen(false);
  };
  
  const handleCustomApply = () => {
    // Validate dates
    const fromValid = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom);
    const toValid = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo);
    
    if (fromValid && toValid) {
      updateDateRange({ from: customFrom, to: customTo });
      setIsOpen(false);
    }
  };
  
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    params.delete('to');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background text-sm cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="max-w-[200px] truncate">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-80 bg-popover border rounded-lg shadow-lg z-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Selecionar Período</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Presets */}
            <div className="grid grid-cols-2 gap-2">
              {(['today', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'thisYear'] as DatePreset[]).map((preset) => {
                const presetRange = getPresetRange(preset);
                const isActive = currentRange.from === presetRange.from && currentRange.to === presetRange.to;
                
                return (
                  <button
                    key={preset}
                    onClick={() => handlePresetSelect(preset)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'hover:bg-muted border-transparent'
                    }`}
                  >
                    {preset === 'today' && 'Hoje'}
                    {preset === 'last7days' && 'Últimos 7 dias'}
                    {preset === 'last30days' && 'Últimos 30 dias'}
                    {preset === 'thisMonth' && 'Este mês'}
                    {preset === 'lastMonth' && 'Mês passado'}
                    {preset === 'thisYear' && 'Este ano'}
                  </button>
                );
              })}
            </div>
            
            {/* Custom Range */}
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Intervalo personalizado</p>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="De"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="Até"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleClear}
                >
                  Limpar
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo}
                >
                  Aplicar
                </Button>
              </div>
            </div>
            
            {/* Current Selection Display */}
            <div className="text-xs text-center text-muted-foreground border-t pt-3">
              Período atual: {formatDateDisplay(currentRange.from)} até {formatDateDisplay(currentRange.to)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Badge component showing current date range (useful in pages)
 */
export function DateRangeBadge({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded-full">
      <Calendar className="w-3 h-3" />
      {formatDateDisplay(from)} → {formatDateDisplay(to)}
    </span>
  );
}
