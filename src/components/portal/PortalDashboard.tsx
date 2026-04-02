'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Car,
  DollarSign,
  Eye,
  Hash,
  Loader2,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FleetResponse } from '@/lib/analytics/fleet-metrics';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getStatusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'secondary' {
  const lower = status.toLowerCase();
  if (lower.includes('locado') || lower.includes('ativo')) return 'success';
  if (lower.includes('oficina') || lower.includes('manuten')) return 'warning';
  if (lower.includes('recolhido') || lower.includes('devolvido')) return 'error';
  if (lower.includes('preparação') || lower.includes('prepara') || lower.includes('chapeca')) return 'info';
  if (lower.includes('disponível') || lower.includes('disponivel')) return 'info';
  return 'secondary';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortalDashboard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get('_as');
  const isImpersonating = !!impersonateId && session?.user?.role === 'ADMIN';
  const investorName = isImpersonating ? 'Investidor (visualização admin)' : (session?.user?.investorName || 'Investidor');

  const [data, setData] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use current month as default range
  const dateRange = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
        if (impersonateId) params.set('_as', impersonateId);
        const res = await fetch(`/api/portal/fleet?${params.toString()}`);
        if (res.status === 401) { setError('Sessão expirada. Faça login novamente.'); return; }
        if (res.status === 403) { setError('Acesso não autorizado.'); return; }
        if (!res.ok) throw new Error('Falha ao carregar dados');
        const json: FleetResponse = await res.json();
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange.from, dateRange.to, impersonateId]);

  if (loading) {
    return <div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }
  if (error) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-base font-medium text-slate-700">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const { kpis, vehicles } = data;
  const isEmpty = kpis.totalVehicles === 0;

  return (
    <div className="space-y-6">
      {/* ── Impersonation banner ── */}
      {isImpersonating && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <Eye className="h-4 w-4" />
            Visualizando como investidor (modo admin)
          </div>
          <Link href="/configuracoes/usuarios" className="text-xs font-medium text-amber-700 underline hover:text-amber-900">
            Voltar à gestão
          </Link>
        </div>
      )}

      {/* ── Welcome header ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Olá, {investorName}
            </h1>
            <p className="text-sm text-slate-500">
              Resumo operacional dos seus veículos — {dateRange.from.split('-').reverse().join('/')} a {dateRange.to.split('-').reverse().join('/')}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-[250px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <Truck className="h-10 w-10 text-slate-300" />
          <p className="text-base font-medium text-slate-700">Nenhum veículo no período</p>
          <p className="text-sm text-slate-500">Não há dados operacionais para este intervalo.</p>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard title="Veículos" value={String(kpis.totalVehicles)} icon={<Car className="h-5 w-5" />} tone="blue" />
            <KPICard title="Snapshots" value={String(kpis.totalSnapshots)} icon={<Hash className="h-5 w-5" />} tone="slate" />
            <KPICard title="Receita" value={formatCurrency(kpis.operationalRevenueReceived)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
            <KPICard title="Custos" value={formatCurrency(kpis.operationalCost)} icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <KPICard title="A cobrar" value={formatCurrency(kpis.amountToCharge)} icon={<DollarSign className="h-5 w-5" />} tone="amber" />
            <KPICard title="Resultado" value={formatCurrency(kpis.operationalResult)} icon={<DollarSign className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'emerald' : 'red'} />
          </div>

          {/* ── Status distribution ── */}
          {kpis.statusDistribution.length > 0 && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status dos veículos</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {kpis.statusDistribution.map((s) => (
                  <StatusChip key={s.status} status={s.status} count={s.count} />
                ))}
              </div>
            </div>
          )}

          {/* ── Vehicles table ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Seus veículos</h2>
                  <p className="text-sm text-slate-500">Detalhamento operacional individual</p>
                </div>
              </div>
              <Badge variant="secondary">{vehicles.length} veículos</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Placa</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Modelo</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Status</th>
                    <th className="px-6 py-4 text-right font-semibold text-slate-500">Snapshots</th>
                    <th className="px-6 py-4 text-right font-semibold text-slate-500">Recebido</th>
                    <th className="px-6 py-4 text-right font-semibold text-slate-500">Custos</th>
                    <th className="px-6 py-4 text-right font-semibold text-slate-500">A cobrar</th>
                    <th className="px-6 py-4 text-right font-semibold text-slate-500">Resultado</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-500">Qualidade</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const alertCount = v.qualitySummary.WARNING + v.qualitySummary.REVIEW_REQUIRED;
                    return (
                      <tr key={v.plate} className="border-t border-slate-200/70 transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <Link
                            href={`/portal/veiculos/${encodeURIComponent(v.plate)}?from=${dateRange.from}&to=${dateRange.to}${impersonateId ? `&_as=${impersonateId}` : ''}`}
                            className="font-mono font-medium text-[#022D44] underline decoration-[#022D44]/25 underline-offset-2 hover:decoration-[#022D44]/60 transition-colors"
                          >
                            {v.plate}
                          </Link>
                        </td>
                        <td className="max-w-[160px] truncate px-6 py-4 text-slate-700" title={v.model ?? undefined}>{v.model || '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(v.currentStatus)} size="sm">{v.currentStatus}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">{v.snapshotCount}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-emerald-700">{formatCurrencyFull(v.revenueReceived)}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-red-700">{formatCurrencyFull(v.operationalCost)}</td>
                        <td className="px-6 py-4 text-right tabular-nums font-medium text-amber-700">{formatCurrencyFull(v.amountToCharge)}</td>
                        <td className={`px-6 py-4 text-right tabular-nums font-medium ${v.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatCurrencyFull(v.operationalResult)}
                        </td>
                        <td className="px-6 py-4">
                          {alertCount > 0 ? (
                            <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge>
                          ) : (
                            <Badge variant="success" size="sm">OK</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({ title, value, icon, tone }: { title: string; value: string; icon: ReactNode; tone: 'emerald' | 'red' | 'amber' | 'blue' | 'slate' }) {
  const toneClass = {
    emerald: 'border-emerald-200/50 bg-emerald-50/50 text-emerald-700',
    red: 'border-red-200/50 bg-red-50/50 text-red-700',
    amber: 'border-amber-200/50 bg-amber-50/50 text-amber-700',
    blue: 'border-[#022D44]/10 bg-[#022D44]/5 text-[#022D44]',
    slate: 'border-slate-200/50 bg-slate-50/50 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{value}</p>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function StatusChip({ status, count }: { status: string; count: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
      <span>{status}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{count}</span>
    </div>
  );
}
