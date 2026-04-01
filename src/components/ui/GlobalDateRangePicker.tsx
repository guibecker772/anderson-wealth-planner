'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Globe, X } from 'lucide-react';
import { useDateRange } from '@/lib/components/DateRangeContext';
import { Input } from '@/components/ui/input';
import {
  formatDateDisplay,
  getDateRangeLabel,
  getPresetRange,
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

  useEffect(() => {
    setCustomFrom(dateRange.from);
    setCustomTo(dateRange.to);
  }, [dateRange.from, dateRange.to]);

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex h-10 items-center gap-3 rounded-2xl border border-[#022D44]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,248,251,0.98))] px-3.5 text-sm font-medium text-foreground shadow-[0_14px_34px_-28px_rgba(2,45,68,0.38)] transition-all duration-200 hover:border-[#022D44]/20 hover:bg-white"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#022D44]/8 text-[#022D44]">
          <Globe className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary/90" />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Filtro global</div>
          <span className="block max-w-[170px] truncate text-sm font-semibold text-slate-800">
            {displayLabel}
          </span>
        </div>
        <ChevronDown className={`ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-[360px] overflow-hidden rounded-[24px] border border-white/80 bg-popover/95 shadow-[0_24px_56px_-34px_rgba(2,45,68,0.38)] backdrop-blur-xl animate-in">
          <div className="flex items-center justify-between border-b border-border/50 bg-[linear-gradient(180deg,rgba(2,45,68,0.05),rgba(255,255,255,0.68))] px-5 py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold text-foreground">Período global</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowCustom(false);
              }}
              className="rounded-md p-1 transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-2 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Atalhos rápidos</p>
            <div className="grid grid-cols-3 gap-2">
              {presets.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ${
                    isPresetActive(key)
                      ? 'bg-[linear-gradient(135deg,#022D44,#0a4f73)] text-primary-foreground shadow-lg shadow-[#022D44]/20'
                      : 'bg-muted/45 text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-3">
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`w-full rounded-xl border border-dashed px-3 py-2 text-xs font-medium transition-all duration-150 ${
                showCustom
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
            >
              Personalizado
            </button>
          </div>

          {showCustom && (
            <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] text-muted-foreground">De</label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <span className="mt-4 text-muted-foreground">→</span>
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] text-muted-foreground">Até</label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clear();
                    setIsOpen(false);
                    setShowCustom(false);
                  }}
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Limpar
                </button>
                <button
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="flex-1 rounded-xl bg-[linear-gradient(135deg,#022D44,#0b5a82)] px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-[11px] text-muted-foreground">
                {formatDateDisplay(dateRange.from)} — {formatDateDisplay(dateRange.to)}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">Global</span>
          </div>
        </div>
      )}
    </div>
  );
}
