'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { User, Database, Upload, Activity, X, Server, LogOut } from 'lucide-react';

interface SystemStatus {
  environment: string;
  version: string;
  database: string;
  lastImport: { file: string; date: string | null; status: string } | null;
  totalEntries: number;
  totalFiles: number;
}

export function UserMenu() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/system/status');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (mounted) setStatus(data);
      } catch {
        // silent
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
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

  const envLabel = status?.environment === 'production' ? 'Produção' : 'Desenvolvimento';
  const dbOk = status?.database === 'conectado';

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#022D44,#0b5a82)] text-white shadow-[0_18px_36px_-22px_rgba(2,45,68,0.55)] transition-all hover:brightness-105"
        title="Sistema"
      >
        <User className="w-4 h-4" />
        {/* DB status dot */}
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
          loading ? 'bg-muted-foreground' : dbOk ? 'bg-green-500' : 'bg-destructive'
        }`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-[24px] border border-white/80 bg-popover/95 shadow-[0_28px_70px_-36px_rgba(2,45,68,0.45)] backdrop-blur-xl animate-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 bg-[linear-gradient(180deg,rgba(2,45,68,0.05),rgba(255,255,255,0.68))] px-5 py-4">
            <span className="text-sm font-semibold text-foreground">Sistema</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Carregando...</div>
          ) : status ? (
            <div className="divide-y divide-border/40">
              {/* Environment */}
              <div className="px-4 py-3 flex items-center gap-3">
                <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Ambiente</p>
                  <p className="text-sm font-medium">{envLabel} <span className="text-xs text-muted-foreground">v{status.version}</span></p>
                </div>
              </div>

              {/* Database */}
              <div className="px-4 py-3 flex items-center gap-3">
                <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Banco de dados</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dbOk ? 'bg-green-500' : 'bg-destructive'}`} />
                    <p className="text-sm font-medium capitalize">{status.database}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-4 py-3 flex items-center gap-3">
                <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Dados</p>
                  <p className="text-sm font-medium">
                    {status.totalEntries.toLocaleString('pt-BR')} lançamentos · {status.totalFiles} arquivo(s)
                  </p>
                </div>
              </div>

              {/* Last Import */}
              <div className="px-4 py-3 flex items-center gap-3">
                <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Última importação</p>
                  {status.lastImport ? (
                    <>
                      <p className="text-sm font-medium truncate">{status.lastImport.file}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(status.lastImport.date)} · {status.lastImport.status}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma importação</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">Indisponível</div>
          )}

          {/* Auth info */}
          {session?.user && (
            <div className="border-t border-border/40 px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{session.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
