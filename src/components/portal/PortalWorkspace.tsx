'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  Car,
  CircleDollarSign,
  Clock3,
  DollarSign,
  Eye,
  Filter,
  Gauge,
  Inbox,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Badge } from '@/components/ui/badge';
import type { FleetVehicleRow } from '@/lib/analytics/fleet-metrics';
import { resolveVehicleMedia, type VehicleMedia } from '@/lib/portalVehicleMedia';
import { PortalContextStat, PortalEmptyState, PortalInfoTooltip } from './PortalSupport';
import { usePortalFleetData } from './usePortalFleetData';

type PortalSection = 'overview' | 'fleet' | 'revenue' | 'expenses' | 'fines';

type PortalFleetFilters = {
  search: string;
  status: string;
  withAlert: boolean;
  withCharge: boolean;
  withQuality: boolean;
};

const EMPTY_PORTAL_FLEET_FILTERS: PortalFleetFilters = {
  search: '',
  status: '',
  withAlert: false,
  withCharge: false,
  withQuality: false,
};

const PORTAL_FLEET_STATUS_PRIORITY = [
  'locado',
  'oficina',
  'preparacao',
  'sinistro',
  'disponivel locacao',
  'recolhido',
  'pendencia crva',
  'chapeacao',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateRangeLabel(from: string, to: string) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function formatLatestReferenceLabel(value: string | null) {
  return value ? formatDate(value) : null;
}

function humanDriverLabel(value: string | null) {
  if (!value || value.trim() === '') return 'Não identificado no período';
  return value;
}

function getStatusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'secondary' {
  const lower = status.toLowerCase();
  if (lower.includes('locado') || lower.includes('ativo')) return 'success';
  if (lower.includes('oficina') || lower.includes('manuten')) return 'warning';
  if (lower.includes('recolhido') || lower.includes('devolvido')) return 'error';
  if (
    lower.includes('preparação') ||
    lower.includes('preparacao') ||
    lower.includes('prepara') ||
    lower.includes('chapeca') ||
    lower.includes('disponível') ||
    lower.includes('disponivel')
  ) {
    return 'info';
  }
  return 'secondary';
}

function normalizeStatusLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sortPortalFleetStatuses(statuses: Array<{ status: string; count: number }>) {
  return [...statuses].sort((left, right) => {
    const leftKey = normalizeStatusLabel(left.status);
    const rightKey = normalizeStatusLabel(right.status);
    const leftIndex = PORTAL_FLEET_STATUS_PRIORITY.findIndex((item) => leftKey.includes(item));
    const rightIndex = PORTAL_FLEET_STATUS_PRIORITY.findIndex((item) => rightKey.includes(item));

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }

    if (right.count !== left.count) return right.count - left.count;

    return left.status.localeCompare(right.status, 'pt-BR');
  });
}

function hasVehicleQualityPending(vehicle: FleetVehicleRow) {
  return vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED > 0;
}

function hasVehicleAlert(vehicle: FleetVehicleRow) {
  return hasVehicleQualityPending(vehicle) || vehicle.amountToCharge > 0 || vehicle.openAmount > 0;
}

function applyPortalFleetFilters(vehicles: FleetVehicleRow[], filters: PortalFleetFilters) {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    if (filters.status && vehicle.currentStatus !== filters.status) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = `${vehicle.plate} ${vehicle.model || ''}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    if (filters.withAlert && !hasVehicleAlert(vehicle)) {
      return false;
    }

    if (filters.withCharge && vehicle.amountToCharge <= 0) {
      return false;
    }

    if (filters.withQuality && !hasVehicleQualityPending(vehicle)) {
      return false;
    }

    return true;
  });
}

function getSectionCopy(section: PortalSection) {
  const map = {
    overview: {
      eyebrow: 'Portal do Investidor',
      title: 'Visão Geral da sua carteira',
      description:
        'Resumo executivo da carteira para acompanhar frota, recebimentos, custos e os principais sinais do período.',
      accent: 'blue' as const,
    },
    fleet: {
      eyebrow: 'Frota / Operações',
      title: 'Frota e operação por veículo',
      description:
        'Acompanhe cada veículo com foco em status atual, locatário exibido e leitura operacional do período.',
      accent: 'blue' as const,
    },
    revenue: {
      eyebrow: 'Receitas',
      title: 'Receita operacional do período',
      description:
        'Veja o que entrou, o que segue em cobrança e quais placas mais contribuíram no período selecionado.',
      accent: 'green' as const,
    },
    expenses: {
      eyebrow: 'Despesas',
      title: 'Custos operacionais da carteira',
      description:
        'Entenda onde o custo se concentrou, com separação clara entre manutenção, multas e descontos.',
      accent: 'amber' as const,
    },
    fines: {
      eyebrow: 'Multas',
      title: 'Multas e atrasos operacionais',
      description:
        'Acompanhe as ocorrências do período e o impacto financeiro das multas e atrasos na carteira.',
      accent: 'amber' as const,
    },
  };

  return map[section];
}

function SummaryCard({
  title,
  value,
  icon,
  description,
  tooltip,
  tone = 'slate',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  tooltip?: string;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    slate: 'border-slate-200/70 bg-white',
    blue: 'border-[#022D44]/10 bg-[#022D44]/5',
    green: 'border-emerald-200/60 bg-emerald-50/70',
    amber: 'border-amber-200/60 bg-amber-50/70',
    red: 'border-red-200/60 bg-red-50/70',
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
            {tooltip ? <PortalInfoTooltip content={tooltip} /> : null}
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#022D44] shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function VehicleTile({ vehicle, href }: { vehicle: FleetVehicleRow; href: string }) {
  const alertCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
  const media = resolveVehicleMedia(vehicle.model);

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[26px] border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]"
    >
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(2,45,68,0.12),transparent_40%),linear-gradient(180deg,#eef6fb,#d8e7ef)]">
        <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(2,45,68,0.10),transparent)]" />
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <Badge variant={getStatusVariant(vehicle.currentStatus)} size="sm">{vehicle.currentStatus}</Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 top-8">
          <div
            role="img"
            aria-label={media.label}
            className="h-full w-full bg-contain bg-bottom bg-no-repeat drop-shadow-[0_8px_20px_rgba(15,36,57,0.28)] transition-transform duration-300 group-hover:scale-[1.04]"
            style={{ backgroundImage: `url(${media.src})` }}
          />
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="min-w-0">
          <p className="font-mono text-xl font-semibold tracking-tight text-slate-900">{vehicle.plate}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{vehicle.model || media.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Locatário</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 leading-5">{humanDriverLabel(vehicle.driver)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recebido</p>
            <p className="mt-1.5 text-sm font-semibold text-emerald-700">{formatCurrency(vehicle.revenueReceived)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Custos</p>
            <p className="mt-1.5 text-sm font-semibold text-red-700">{formatCurrency(vehicle.operationalCost)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resultado</p>
            <p className={`mt-1.5 text-sm font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(vehicle.operationalResult)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {vehicle.amountToCharge > 0 ? `${formatCurrency(vehicle.amountToCharge)} a cobrar` : 'Sem cobranças pendentes'}
          </span>
          {alertCount > 0 ? <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge> : <Badge variant="success" size="sm">Base OK</Badge>}
        </div>
      </div>
    </Link>
  );
}

function getFleetCardMediaTheme(category: VehicleMedia['category']) {
  switch (category) {
    case 'hatch':
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.2),transparent_42%),linear-gradient(180deg,#eff8ff,#dbeafe)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.7),transparent_68%)]',
        accent: 'from-sky-100/90 via-white/10 to-cyan-100/40',
      };
    case 'sedan':
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.2),transparent_42%),linear-gradient(180deg,#eff6ff,#e2e8f0)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.72),transparent_68%)]',
        accent: 'from-blue-100/90 via-white/10 to-slate-100/50',
      };
    case 'crossover':
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),transparent_40%),linear-gradient(180deg,#ecfeff,#d1fae5)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.72),transparent_68%)]',
        accent: 'from-emerald-100/90 via-white/10 to-cyan-100/45',
      };
    case 'electric':
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),transparent_40%),linear-gradient(180deg,#f5f3ff,#dbeafe)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.76),transparent_70%)]',
        accent: 'from-violet-100/90 via-white/10 to-sky-100/45',
      };
    case 'utility':
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),transparent_40%),linear-gradient(180deg,#fff7ed,#e2e8f0)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.78),transparent_70%)]',
        accent: 'from-amber-100/90 via-white/10 to-slate-100/45',
      };
    default:
      return {
        shell: 'bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.16),transparent_40%),linear-gradient(180deg,#f8fafc,#e2e8f0)]',
        glow: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.78),transparent_70%)]',
        accent: 'from-slate-100/90 via-white/10 to-slate-200/50',
      };
  }
}

function FleetVehicleCard({ vehicle, href }: { vehicle: FleetVehicleRow; href: string }) {
  const alertCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
  const media = resolveVehicleMedia(vehicle.model);
  const theme = getFleetCardMediaTheme(media.category);

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_38px_rgba(15,23,42,0.08)]"
    >
      <div className={`relative h-48 overflow-hidden border-b border-slate-200/60 ${theme.shell}`}>
        <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${theme.accent}`} />
        <div className={`absolute right-[-8%] top-6 h-32 w-32 rounded-full opacity-80 blur-2xl ${theme.glow}`} />
        <div className="absolute left-5 right-5 top-4 z-10 flex items-start justify-between gap-3">
          <Badge variant={getStatusVariant(vehicle.currentStatus)} size="sm">{vehicle.currentStatus}</Badge>
          {media.familyId ? (
            <span className="rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 shadow-sm">
              {media.label}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 top-8">
          <div
            role="img"
            aria-label={media.label}
            className="h-full w-full bg-contain bg-bottom bg-no-repeat drop-shadow-[0_8px_20px_rgba(15,36,57,0.28)] transition-transform duration-300 group-hover:scale-[1.04]"
            style={{ backgroundImage: `url(${media.src})` }}
          />
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="min-w-0">
          <p className="font-mono text-xl font-semibold tracking-tight text-slate-900">{vehicle.plate}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{vehicle.model || media.label}</p>
        </div>

        <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Locatário</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{humanDriverLabel(vehicle.driver)}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">Recebido</p>
            <p className="mt-1.5 text-sm font-semibold text-emerald-700">{formatCurrency(vehicle.revenueReceived)}</p>
          </div>
          <div className="rounded-2xl border border-red-200/60 bg-red-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700/80">Custos</p>
            <p className="mt-1.5 text-sm font-semibold text-red-700">{formatCurrency(vehicle.operationalCost)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resultado</p>
            <p className={`mt-1.5 text-sm font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(vehicle.operationalResult)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {vehicle.amountToCharge > 0 ? (
              <Badge variant="warning" size="sm">{formatCurrency(vehicle.amountToCharge)} a cobrar</Badge>
            ) : (
              <Badge variant="success" size="sm">Sem cobranças pendentes</Badge>
            )}
            {alertCount > 0 ? <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge> : <Badge variant="success" size="sm">Base OK</Badge>}
          </div>
          <span className="text-xs font-medium text-slate-500 transition-colors group-hover:text-[#022D44]">Ver detalhes</span>
        </div>
      </div>
    </Link>
  );
}

function SectionTable({
  title,
  description,
  rows,
  columns,
  emptyMessage,
  titleTooltip,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  rows: FleetVehicleRow[];
  columns: Array<{ key: string; label: string; align?: 'left' | 'right'; render: (row: FleetVehicleRow) => React.ReactNode }>;
  emptyMessage: string;
  titleTooltip?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const searchParams = useSearchParams();
  const suffix = searchParams.toString();

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
      <div className="border-b border-slate-200/70 px-6 py-5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          {titleTooltip ? <PortalInfoTooltip content={titleTooltip} /> : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-slate-500">Veículo</th>
              {columns.map((column) => (
                <th key={column.key} className={`px-6 py-4 font-semibold text-slate-500 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.plate} className="border-t border-slate-200/70 transition-colors hover:bg-slate-50/70">
                <td className="px-6 py-4">
                  <Link href={`/portal/veiculos/${encodeURIComponent(row.plate)}${suffix ? `?${suffix}` : ''}`} className="inline-flex flex-col">
                    <span className="font-mono font-semibold text-[#022D44]">{row.plate}</span>
                    <span className="max-w-[220px] truncate text-xs text-slate-500">{row.model || 'Modelo não identificado'}</span>
                  </Link>
                </td>
                {columns.map((column) => (
                  <td key={`${row.plate}-${column.key}`} className={`px-6 py-4 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-8">
                  <PortalEmptyState
                    compact
                    icon={<Inbox className="h-6 w-6" />}
                    title={emptyTitle || emptyMessage}
                    description={emptyDescription || 'Ajuste o período global para consultar outro recorte da carteira.'}
                    className="border-0 bg-transparent px-0 py-2 shadow-none"
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FleetStatusFilterChip({
  label,
  count,
  active,
  variant = 'secondary',
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  variant?: 'success' | 'warning' | 'info' | 'error' | 'secondary';
  onClick: () => void;
}) {
  const activeClass = {
    success: 'border-emerald-300 bg-emerald-600 text-white',
    warning: 'border-amber-300 bg-amber-500 text-white',
    info: 'border-sky-300 bg-sky-600 text-white',
    error: 'border-red-300 bg-red-600 text-white',
    secondary: 'border-[#022D44]/20 bg-[#022D44] text-white',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? `${activeClass} shadow-sm`
          : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    </button>
  );
}

function FleetQuickFilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-all ${
        active
          ? 'border-[#022D44]/16 bg-[#022D44] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    </button>
  );
}

function PortalFleetSection({
  vehicles,
  kpis,
}: {
  vehicles: FleetVehicleRow[];
    kpis: {
      totalVehicles: number;
      amountToCharge: number;
      operationalResult: number;
      statusDistribution: Array<{ status: string; count: number }>;
    };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [searchInput, setSearchInput] = useState(searchParams.get('fleetSearch') || '');

  const filters = useMemo<PortalFleetFilters>(() => ({
    search: searchParams.get('fleetSearch') || '',
    status: searchParams.get('fleetStatus') || '',
    withAlert: searchParams.get('fleetAlert') === '1',
    withCharge: searchParams.get('fleetCharge') === '1',
    withQuality: searchParams.get('fleetQuality') === '1',
  }), [searchParams]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const updateFleetFilters = useCallback((nextFilters: PortalFleetFilters) => {
    const nextParams = new URLSearchParams(searchParamsKey);

    if (nextFilters.search) nextParams.set('fleetSearch', nextFilters.search);
    else nextParams.delete('fleetSearch');

    if (nextFilters.status) nextParams.set('fleetStatus', nextFilters.status);
    else nextParams.delete('fleetStatus');

    if (nextFilters.withAlert) nextParams.set('fleetAlert', '1');
    else nextParams.delete('fleetAlert');

    if (nextFilters.withCharge) nextParams.set('fleetCharge', '1');
    else nextParams.delete('fleetCharge');

    if (nextFilters.withQuality) nextParams.set('fleetQuality', '1');
    else nextParams.delete('fleetQuality');

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParamsKey]);

  const filteredVehicles = useMemo(() => applyPortalFleetFilters(vehicles, filters), [vehicles, filters]);
  const sortedStatuses = useMemo(() => sortPortalFleetStatuses(kpis.statusDistribution), [kpis.statusDistribution]);
  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.withAlert || filters.withCharge || filters.withQuality,
  );
  const vehiclesWithAlerts = useMemo(() => vehicles.filter((vehicle) => hasVehicleAlert(vehicle)).length, [vehicles]);
  const vehiclesWithCharge = useMemo(() => vehicles.filter((vehicle) => vehicle.amountToCharge > 0).length, [vehicles]);
  const vehiclesWithQualityPending = useMemo(() => vehicles.filter((vehicle) => hasVehicleQualityPending(vehicle)).length, [vehicles]);
  const selectedStatusLabel = filters.status || 'Todos os status';
  const suffix = searchParams.toString();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Veículos" value={String(kpis.totalVehicles)} description="Quantidade de placas com leitura operacional no período." icon={<Car className="h-5 w-5" />} tone="blue" />
        <SummaryCard title="A cobrar" value={formatCurrency(kpis.amountToCharge)} description="Montante operacional em cobrança no período selecionado." tooltip="Valor operacional ainda previsto para cobrança no recorte atual." icon={<DollarSign className="h-5 w-5" />} tone="amber" />
        <SummaryCard title="Resultado" value={formatCurrency(kpis.operationalResult)} description="Resultado agregado da frota no período global." tooltip="Diferença entre a receita recebida e os custos operacionais do período." icon={<TrendingUp className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'green' : 'red'} />
      </div>

      <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Leitura por status</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Resumo clicável da frota</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Selecione um status para enxergar apenas os veículos daquela faixa operacional, sempre respeitando o período global do portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" size="sm">{selectedStatusLabel}</Badge>
            <Badge variant="secondary" size="sm">{filteredVehicles.length} de {vehicles.length} veículos</Badge>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <FleetStatusFilterChip label="Todos" count={vehicles.length} active={!filters.status} onClick={() => updateFleetFilters({ ...filters, status: '' })} />
          {sortedStatuses.map((item) => (
            <FleetStatusFilterChip
              key={item.status}
              label={item.status}
              count={item.count}
              active={filters.status === item.status}
              variant={getStatusVariant(item.status)}
              onClick={() => updateFleetFilters({ ...filters, status: filters.status === item.status ? '' : item.status })}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Filtros rápidos</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Combine busca, status e sinais operacionais para encontrar rapidamente as placas que pedem atenção.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" size="sm">{filteredVehicles.length} resultado(s)</Badge>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateFleetFilters(EMPTY_PORTAL_FLEET_FILTERS);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative xl:max-w-sm xl:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onBlur={() => updateFleetFilters({ ...filters, search: searchInput.trim() })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    updateFleetFilters({ ...filters, search: searchInput.trim() });
                  }
                }}
                placeholder="Buscar por placa ou modelo"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#022D44]/25 focus:ring-2 focus:ring-[#022D44]/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                <Filter className="h-3.5 w-3.5" />
                Período global aplicado
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <FleetQuickFilterChip label="Com alerta" count={vehiclesWithAlerts} active={filters.withAlert} onClick={() => updateFleetFilters({ ...filters, withAlert: !filters.withAlert })} />
            <FleetQuickFilterChip label="Com valor a cobrar" count={vehiclesWithCharge} active={filters.withCharge} onClick={() => updateFleetFilters({ ...filters, withCharge: !filters.withCharge })} />
            <FleetQuickFilterChip label="Pendência de qualidade" count={vehiclesWithQualityPending} active={filters.withQuality} onClick={() => updateFleetFilters({ ...filters, withQuality: !filters.withQuality })} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              Leitura do período
              <PortalInfoTooltip content="Registro operacional associado ao veículo dentro do recorte global selecionado." />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Pendência de qualidade
              <PortalInfoTooltip content="Veículos com registros em alerta ou revisão pendente dentro do período consultado." />
            </span>
            <span className="inline-flex items-center gap-1.5">
              A cobrar
              <PortalInfoTooltip content="Valor operacional previsto para cobrança e ainda não refletido como recebido." />
            </span>
          </div>
        </div>
      </div>

      {filteredVehicles.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <FleetVehicleCard key={vehicle.plate} vehicle={vehicle} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} />
          ))}
        </div>
      ) : (
        <PortalEmptyState
          icon={<Car className="h-6 w-6" />}
          title="Nenhum veículo encontrado"
          description="Os filtros atuais não retornaram veículos para a carteira neste período. Ajuste a busca, escolha outro status ou limpe os filtros para voltar à visão completa."
          action={hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                updateFleetFilters(EMPTY_PORTAL_FLEET_FILTERS);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          ) : null}
        />
      )}
    </div>
  );
}

export function PortalWorkspace({ section }: { section: PortalSection }) {
  const searchParams = useSearchParams();
  const { data, loading, error, dateRange, investorName, isImpersonating } = usePortalFleetData();
  const copy = getSectionCopy(section);

  if (loading) {
    return <div className="flex h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  if (error || !data || !dateRange) {
    return (
      <PortalEmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Não foi possível carregar o portal"
        description={error || 'Tente atualizar a página em alguns instantes para consultar a carteira novamente.'}
      />
    );
  }

  const { kpis } = data;
  const vehicles = [...data.vehicles];
  const suffix = searchParams.toString();
  const featuredVehicles = [...vehicles].sort((a, b) => b.operationalResult - a.operationalResult).slice(0, 3);
  const vehiclesWithAlerts = [...vehicles]
    .filter((vehicle) => vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED > 0 || vehicle.openAmount > 0)
    .sort((a, b) => (b.qualitySummary.WARNING + b.qualitySummary.REVIEW_REQUIRED + b.openAmount) - (a.qualitySummary.WARNING + a.qualitySummary.REVIEW_REQUIRED + a.openAmount))
    .slice(0, 4);
  const revenueRows = [...vehicles].sort((a, b) => b.revenueReceived - a.revenueReceived);
  const expenseRows = [...vehicles].sort((a, b) => b.operationalCost - a.operationalCost);
  const fineRows = [...vehicles].filter((a) => a.lateFeeCost > 0).sort((a, b) => b.lateFeeCost - a.lateFeeCost);
  const latestReferenceDateLabel = formatLatestReferenceLabel(data.latestReferenceDate);

  const heroMeta = (
    <>
      <Badge variant="info" size="sm">{investorName}</Badge>
      <Badge variant="secondary" size="sm">{kpis.totalVehicles} veículos</Badge>
    </>
  );

  const heroContext = (
    <div className="grid gap-3 md:grid-cols-2">
      {latestReferenceDateLabel ? (
        <PortalContextStat
          label="Última leitura disponível"
          value={latestReferenceDateLabel}
          description="Data mais recente encontrada na base para a carteira dentro do recorte consultado."
          icon={<Clock3 className="h-4 w-4" />}
        />
      ) : null}
      <PortalContextStat
        label="Período aplicado"
        value={formatDateRangeLabel(dateRange.from, dateRange.to)}
        description="Todas as métricas, listas e filtros desta página seguem esse mesmo recorte global."
        icon={<CalendarDays className="h-4 w-4" />}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {isImpersonating ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <Eye className="h-4 w-4" />
            Visualização como investidor em contexto administrativo
          </div>
          <Link href="/configuracoes/usuarios" className="text-xs font-medium text-amber-700 underline hover:text-amber-900">
            Voltar à Gestão de Acessos
          </Link>
        </div>
      ) : null}

      <PageHero eyebrow={copy.eyebrow} title={copy.title} description={copy.description} accent={copy.accent} meta={heroMeta}>
        {heroContext}
      </PageHero>

      {section === 'overview' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Receita operacional" value={formatCurrency(kpis.operationalRevenueReceived)} description="Receita recebida no período da carteira." icon={<TrendingUp className="h-5 w-5" />} tone="green" />
            <SummaryCard title="Custo operacional" value={formatCurrency(kpis.operationalCost)} description="Manutenção, multa/atraso e descontos apurados na operação." icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <SummaryCard title="Valores a cobrar" value={formatCurrency(kpis.amountToCharge)} description="Valor operacional previsto para cobrança no período." tooltip="Valor operacional ainda previsto para cobrança e não refletido como recebido." icon={<CircleDollarSign className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Resultado operacional" value={formatCurrency(kpis.operationalResult)} description="Resultado do período considerando receita e custos operacionais." tooltip="Diferença entre a receita recebida e os custos operacionais do período." icon={<Gauge className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'blue' : 'red'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="border-b border-slate-200/70 px-6 py-5">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Veículos em destaque</h3>
                <p className="mt-1 text-sm text-slate-500">Leitura rápida da carteira com foco em status, resultado e cobertura visual por modelo.</p>
              </div>
              <div className="p-5">
                {featuredVehicles.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {featuredVehicles.map((vehicle) => (
                      <VehicleTile key={vehicle.plate} vehicle={vehicle} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} />
                    ))}
                  </div>
                ) : (
                  <PortalEmptyState
                    compact
                    icon={<Car className="h-6 w-6" />}
                    title="Ainda não há veículos em destaque"
                    description="Quando houver leitura operacional no período selecionado, os principais veículos da carteira aparecerão aqui."
                    className="border-0 bg-transparent px-0 py-4 shadow-none"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#022D44]" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Resumo da frota</h3>
                    <p className="text-sm text-slate-500">Distribuição atual dos veículos no período selecionado.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {kpis.statusDistribution.length > 0 ? kpis.statusDistribution.map((item) => (
                    <div key={item.status} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-4 py-2 text-sm font-medium text-slate-700">
                      <span>{item.status}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{item.count}</span>
                    </div>
                  )) : (
                    <PortalEmptyState
                      compact
                      icon={<Car className="h-6 w-6" />}
                      title="Sem distribuição de status neste período"
                      description="Quando houver leitura operacional no recorte selecionado, os status atuais da frota aparecerão aqui."
                      className="w-full border-0 bg-transparent px-0 py-4 text-left shadow-none"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Alertas relevantes</h3>
                    <p className="text-sm text-slate-500">Veículos com sinalização de qualidade ou valores em aberto.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {vehiclesWithAlerts.length > 0 ? vehiclesWithAlerts.map((vehicle) => {
                    const alertCount = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
                    return (
                      <Link key={vehicle.plate} href={`/portal/veiculos/${encodeURIComponent(vehicle.plate)}${suffix ? `?${suffix}` : ''}`} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 transition-colors hover:bg-slate-100/70">
                        <div>
                          <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                          <p className="text-xs text-slate-500">{vehicle.currentStatus}</p>
                        </div>
                        <div className="text-right">
                          {alertCount > 0 ? <Badge variant="warning" size="sm">{alertCount} alerta(s)</Badge> : null}
                          {vehicle.openAmount > 0 ? <p className="mt-1 text-xs font-medium text-amber-700">Em aberto: {formatCurrency(vehicle.openAmount)}</p> : null}
                        </div>
                      </Link>
                    );
                  }) : (
                    <PortalEmptyState
                      compact
                      icon={<ShieldCheck className="h-6 w-6" />}
                      title="Nenhum alerta relevante neste recorte"
                      description="A carteira não trouxe sinais críticos de qualidade ou valores em aberto no período selecionado."
                      className="border-0 bg-transparent px-0 py-4 shadow-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {section === 'fleet' ? (
        <PortalFleetSection
          vehicles={vehicles}
          kpis={{
            totalVehicles: kpis.totalVehicles,
            amountToCharge: kpis.amountToCharge,
            operationalResult: kpis.operationalResult,
            statusDistribution: kpis.statusDistribution,
          }}
        />
      ) : null}

      {section === 'revenue' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Recebido" value={formatCurrency(kpis.operationalRevenueReceived)} description="Receita recebida na operação do período." icon={<TrendingUp className="h-5 w-5" />} tone="green" />
            <SummaryCard title="A cobrar" value={formatCurrency(kpis.amountToCharge)} description="Valor ainda previsto para cobrança operacional." tooltip="Valor operacional previsto para cobrança e ainda não refletido como recebido." icon={<CircleDollarSign className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Em aberto" value={formatCurrency(kpis.openAmount)} description="Montante que permanece em aberto na leitura operacional." icon={<DollarSign className="h-5 w-5" />} tone="blue" />
            <SummaryCard title="Resultado" value={formatCurrency(kpis.operationalResult)} description="Resultado operacional após os custos do período." tooltip="Diferença entre a receita recebida e os custos operacionais do período." icon={<Gauge className="h-5 w-5" />} tone={kpis.operationalResult >= 0 ? 'green' : 'red'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Veículos com maior receita</h3>
              <p className="mt-1 text-sm text-slate-500">Leitura visual dos veículos que mais receberam no período.</p>
              <div className="mt-5 space-y-4">
                {revenueRows.length > 0 ? revenueRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">{vehicle.model || 'Modelo não identificado'}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">{formatCurrencyFull(vehicle.revenueReceived)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#0f766e,#34d399)]" style={{ width: `${Math.max(10, (vehicle.revenueReceived / Math.max(revenueRows[0]?.revenueReceived || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                )) : (
                  <PortalEmptyState
                    compact
                    icon={<TrendingUp className="h-6 w-6" />}
                    title="Sem receitas operacionais neste período"
                    description="Quando houver recebimentos no recorte selecionado, as placas com melhor desempenho aparecerão aqui."
                    className="border-0 bg-transparent px-0 py-4 shadow-none"
                  />
                )}
              </div>
            </div>

            <SectionTable
              title="Receita por veículo"
              description="Tabela simplificada com foco no recebido, valor a cobrar e resultado operacional."
              rows={revenueRows}
              emptyMessage="Nenhuma receita operacional encontrada no período."
              titleTooltip="Reúne o valor recebido, o que ainda está em cobrança e o resultado operacional por placa."
              emptyTitle="Nenhuma receita operacional encontrada"
              emptyDescription="Não houve recebimentos operacionais no recorte atual. Ajuste o período global para consultar outro momento da carteira."
              columns={[
                { key: 'status', label: 'Status', render: (row) => <Badge variant={getStatusVariant(row.currentStatus)} size="sm">{row.currentStatus}</Badge> },
                { key: 'received', label: 'Recebido', align: 'right', render: (row) => <span className="font-medium text-emerald-700">{formatCurrencyFull(row.revenueReceived)}</span> },
                { key: 'charge', label: 'A cobrar', align: 'right', render: (row) => <span className="font-medium text-amber-700">{formatCurrencyFull(row.amountToCharge)}</span> },
                { key: 'result', label: 'Resultado', align: 'right', render: (row) => <span className={row.operationalResult >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{formatCurrencyFull(row.operationalResult)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}

      {section === 'expenses' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Custos totais" value={formatCurrency(kpis.operationalCost)} description="Custo operacional agregado da carteira." icon={<TrendingDown className="h-5 w-5" />} tone="red" />
            <SummaryCard title="Manutenção" value={formatCurrency(kpis.maintenanceCost)} description="Custo operacional de manutenção por motorista." icon={<Wrench className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Multa / atraso" value={formatCurrency(kpis.lateFeeCost)} description="Impacto de multas e atrasos na operação." icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Descontos" value={formatCurrency(kpis.discountCost)} description="Descontos aplicados no período operacional." icon={<DollarSign className="h-5 w-5" />} tone="blue" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Despesas mais relevantes</h3>
              <p className="mt-1 text-sm text-slate-500">Veículos com maior peso de custo no período.</p>
              <div className="mt-5 space-y-4">
                {expenseRows.length > 0 ? expenseRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">Manutenção {formatCurrency(vehicle.maintenanceCost)} • Multa {formatCurrency(vehicle.lateFeeCost)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{formatCurrencyFull(vehicle.operationalCost)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#ef4444,#fb923c)]" style={{ width: `${Math.max(10, (vehicle.operationalCost / Math.max(expenseRows[0]?.operationalCost || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                )) : (
                  <PortalEmptyState
                    compact
                    icon={<TrendingDown className="h-6 w-6" />}
                    title="Sem custos operacionais neste período"
                    description="Quando houver custos registrados no recorte selecionado, eles aparecerão aqui com a composição por placa."
                    className="border-0 bg-transparent px-0 py-4 shadow-none"
                  />
                )}
              </div>
            </div>

            <SectionTable
              title="Custos por veículo"
              description="Visão objetiva dos componentes de custo operacional do período."
              rows={expenseRows}
              emptyMessage="Nenhum custo operacional encontrado no período."
              titleTooltip="Detalha manutenção, multas e descontos para facilitar a leitura do custo total por placa."
              emptyTitle="Nenhum custo operacional encontrado"
              emptyDescription="Não houve custos operacionais para a carteira no recorte atual. Ajuste o período global para consultar outro momento."
              columns={[
                { key: 'maintenance', label: 'Manutenção', align: 'right', render: (row) => <span className="text-slate-700">{formatCurrencyFull(row.maintenanceCost)}</span> },
                { key: 'latefee', label: 'Multa / atraso', align: 'right', render: (row) => <span className="text-red-700">{formatCurrencyFull(row.lateFeeCost)}</span> },
                { key: 'discount', label: 'Desconto', align: 'right', render: (row) => <span className="text-slate-700">{formatCurrencyFull(row.discountCost)}</span> },
                { key: 'total', label: 'Custo total', align: 'right', render: (row) => <span className="font-medium text-red-700">{formatCurrencyFull(row.operationalCost)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}

      {section === 'fines' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard title="Multas / atrasos" value={formatCurrency(kpis.lateFeeCost)} description="Impacto total de multa ou atraso na operação do período." icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
            <SummaryCard title="Veículos impactados" value={String(fineRows.length)} description="Quantidade de placas com multa ou atraso operacional." icon={<Car className="h-5 w-5" />} tone="blue" />
            <SummaryCard title="Peso no custo" value={kpis.operationalCost > 0 ? `${Math.round((kpis.lateFeeCost / kpis.operationalCost) * 100)}%` : '0%'} description="Participação das multas e atrasos no custo operacional." icon={<Gauge className="h-5 w-5" />} tone="red" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Ocorrências por veículo</h3>
              <p className="mt-1 text-sm text-slate-500">Veículos mais impactados por multa ou atraso operacional.</p>
              <div className="mt-5 space-y-4">
                {fineRows.length > 0 ? fineRows.slice(0, 6).map((vehicle) => (
                  <div key={vehicle.plate}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#022D44]">{vehicle.plate}</p>
                        <p className="text-xs text-slate-500">{humanDriverLabel(vehicle.driver)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{formatCurrencyFull(vehicle.lateFeeCost)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#d97706,#f59e0b)]" style={{ width: `${Math.max(10, (vehicle.lateFeeCost / Math.max(fineRows[0]?.lateFeeCost || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                )) : (
                  <PortalEmptyState
                    compact
                    icon={<AlertTriangle className="h-6 w-6" />}
                    title="Sem multas ou atrasos neste período"
                    description="Nenhuma ocorrência financeira foi identificada para a carteira no recorte selecionado."
                    className="border-0 bg-transparent px-0 py-4 shadow-none"
                  />
                )}
              </div>
            </div>

            <SectionTable
              title="Multas e atrasos"
              description="Tabela simples para leitura rápida por placa, status atual e impacto financeiro."
              rows={fineRows}
              emptyMessage="Nenhuma multa ou atraso operacional encontrado no período."
              titleTooltip="Ocorrências reúnem placas com multa ou atraso operacional identificados no período."
              emptyTitle="Nenhuma ocorrência financeira encontrada"
              emptyDescription="A carteira não teve multas nem atrasos operacionais no recorte atual."
              columns={[
                { key: 'driver', label: 'Locatário', render: (row) => <span className="text-slate-700">{humanDriverLabel(row.driver)}</span> },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={getStatusVariant(row.currentStatus)} size="sm">{row.currentStatus}</Badge> },
                { key: 'alerts', label: 'Qualidade', render: (row) => { const count = row.qualitySummary.WARNING + row.qualitySummary.REVIEW_REQUIRED; return count > 0 ? <Badge variant="warning" size="sm">{count} alerta(s)</Badge> : <Badge variant="success" size="sm">OK</Badge>; } },
                { key: 'fine', label: 'Valor', align: 'right', render: (row) => <span className="font-medium text-red-700">{formatCurrencyFull(row.lateFeeCost)}</span> },
              ]}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
