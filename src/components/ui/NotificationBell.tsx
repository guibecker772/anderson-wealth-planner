'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface SystemNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
  timestamp: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (mounted) setNotifications(data.notifications ?? []);
      } catch {
        // silent
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const count = notifications.length;
  const hasErrors = notifications.some((n) => n.type === 'error');
  const hasWarnings = notifications.some((n) => n.type === 'warning');

  const iconForType = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />;
      default: return <Info className="w-3.5 h-3.5 text-info flex-shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {!loading && count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
            hasErrors ? 'bg-destructive' : hasWarnings ? 'bg-warning text-black' : 'bg-info'
          }`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border border-border/80 rounded-xl shadow-xl z-50 overflow-hidden animate-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
            <span className="text-sm font-semibold text-foreground">Notificações</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Carregando...</div>
            ) : count === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Tudo certo por aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{iconForType(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{n.title}</p>
                        {n.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">{n.detail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {count > 0 && (
            <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Atualizado automaticamente a cada 5 min
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
