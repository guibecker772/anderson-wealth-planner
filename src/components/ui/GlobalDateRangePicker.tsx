'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Globe } from 'lucide-react';
import { useDateRange } from '@/lib/components/DateRangeContext';
import { Input } from '@/components/ui/input';
import {
  getPresetRange,
  getDateRangeLabel,
  formatDateDisplay,
  type DatePreset,
} from '@/lib/dateRange';

const presets: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'last7days', label: '7 dias' },
  { key: 'last30days', label: '30 dias' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: 'thisYear', label: 'Este ano' },
];

export function GlobalDateRangePicker({ className = '' }: { className?: string }) {
  const { dateRange, setDateRange, clear } = useDateRange();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateRange.from);
  const [customTo, setCustomTo] = useState(dateRange.to);
  const panelRef = useRef<HTMLDivElement>(null);

  const displayLabel = getDateRangeLabel(dateRange);

  // Sync custom fields when dateRange changes
  useEffect(() => {
    setCustomFrom(dateRange.from);
    setCustomTo(dateRange.to);
  }, [dateRange.from, dateRange.to]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const handlePreset = (preset: DatePreset) => {
    const range = getPresetRange(preset);
    setDateRange(range);
    setIsOpen(false);
    setShowCustom(false);
  };

  const handleCustomApply = () => {
    const fromValid = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom);
    const toValid = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo);
    if (fromValid && toValid && customFrom <= customTo) {
      setDateRange({ from: customFrom, to: customTo });
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  const isPresetActive = (preset: DatePreset) => {
    const range = getPresetRange(preset);
    return dateRange.from === range.from && dateRange.to === range.to;
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Trigger Chip */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium
          bg-primary/5 border border-primary/15 text-foreground
          hover:bg-primary/10 hover:border-primary/25
          transition-all duration-200 cursor-pointer group"
      >
        <Globe className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary/80" />
        <span className="max-w-[180px] truncate">{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] bg-popover border border-border/80 rounded-xl shadow-xl z-50 overflow-hidden animate-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary/70" />
              <span className="text-sm font-semibold text-foreground">Período Global</span>
            </div>
            <button
              onClick={() => { setIsOpen(false); setShowCustom(false); }}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Quick Presets */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Atalhos rápidos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {presets.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                    isPresetActive(key)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Toggle */}
          <div className="px-4 pb-3">
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 border border-dashed ${
                showCustom
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Custom Date Inputs */}
          {showCustom && (
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">De</label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <span className="text-muted-foreground mt-4">→</span>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Até</label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { clear(); setIsOpen(false); setShowCustom(false); }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          {/* Footer: Current Period */}
          <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] text-muted-foreground">
                {formatDateDisplay(dateRange.from)} — {formatDateDisplay(dateRange.to)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Global</span>
          </div>
        </div>
      )}
    </div>
  );
}
