'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Clock, Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { MetricsSummaryWithComparison } from '@/lib/analytics/metricsSummary';

interface MetricsCardsProps {
  scope: 'income' | 'expense';
  data: MetricsSummaryWithComparison;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function MetricsSummaryCards({ scope, data }: MetricsCardsProps) {
  const isIncome = scope === 'income';
  const incomeMetrics = data.current.income;
  const expenseMetrics = data.current.expense;
  const delta = data.delta;

  const realized = isIncome ? incomeMetrics.received : expenseMetrics.paid;
  const pending = isIncome ? incomeMetrics.receivable : expenseMetrics.payable;
  const overdue = isIncome ? incomeMetrics.overdue : expenseMetrics.overdue;
  const overdueCount = isIncome ? incomeMetrics.overdueCount : expenseMetrics.overdueCount;
  const totalPlanned = realized + pending;

  const realizedDeltaPct = isIncome ? delta.receivedDeltaPct : delta.paidDeltaPct;
  const pendingDeltaPct = isIncome ? delta.receivableDeltaPct : delta.payableDeltaPct;

  const realizedLabel = isIncome ? 'Recebido no período' : 'Pago no período';
  const pendingLabel = isIncome ? 'A receber no período' : 'A pagar no período';
  const primaryColorClass = isIncome ? 'value-income' : 'value-expense';

  return (
    <div className="space-y-4">
      <div className="kpi-auto-grid">
        <MetricCard
          title={realizedLabel}
          value={formatCurrencyFull(realized)}
          tooltip={isIncome ? 'Valor recebido por data de recebimento.' : 'Valor pago por data de pagamento.'}
          deltaPct={realizedDeltaPct}
          deltaPositiveIsGood={isIncome}
          icon={isIncome ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          iconTone={isIncome ? 'emerald' : 'red'}
          valueClass={primaryColorClass}
        />

        <MetricCard
          title={pendingLabel}
          value={formatCurrencyFull(pending)}
          tooltip={isIncome ? 'Pendente de recebimento por vencimento.' : 'Pendente de pagamento por vencimento.'}
          deltaPct={pendingDeltaPct}
          icon={<Clock className="h-5 w-5" />}
          iconTone="amber"
        />

        <MetricCard
          title="Vencidos"
          value={formatCurrencyFull(overdue)}
          tooltip="Pendentes com vencimento anterior a hoje."
          count={overdueCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconTone={overdue > 0 ? 'red' : 'slate'}
          valueClass={overdue > 0 ? 'value-expense' : ''}
        />

        <MetricCard
          title="Total previsto"
          value={formatCurrencyFull(totalPlanned)}
          tooltip={`${realizedLabel} + ${pendingLabel}`}
          icon={<span className="text-lg font-bold">S</span>}
          iconTone="blue"
        />
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-slate-700">
        <span>{isIncome ? 'Recebido' : 'Pago'}: <strong>{formatCurrencyFull(realized)}</strong></span>
        <span className="text-slate-300">+</span>
        <span>{isIncome ? 'A receber' : 'A pagar'}: <strong>{formatCurrencyFull(pending)}</strong></span>
        <span className="text-slate-300">=</span>
        <span>Total: <strong>{formatCurrencyFull(totalPlanned)}</strong></span>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tooltip,
  deltaPct,
  deltaPositiveIsGood = true,
  count,
  icon,
  iconTone = 'slate',
  valueClass = '',
}: {
  title: string;
  value: string;
  tooltip?: string;
  deltaPct?: number | null;
  deltaPositiveIsGood?: boolean;
  count?: number;
  icon?: ReactNode;
  iconTone?: 'emerald' | 'red' | 'amber' | 'blue' | 'slate';
  valueClass?: string;
}) {
  const toneClass = {
    emerald: 'bg-emerald-500/12 text-emerald-700',
    red: 'bg-red-500/12 text-red-700',
    amber: 'bg-amber-500/12 text-amber-700',
    blue: 'bg-[#022D44]/10 text-[#022D44]',
    slate: 'bg-slate-200/70 text-slate-600',
  }[iconTone];

  const deltaColor =
    deltaPct === null || deltaPct === undefined
      ? 'text-slate-400'
      : deltaPositiveIsGood
        ? deltaPct >= 0 ? 'delta-positive' : 'delta-negative'
        : deltaPct >= 0 ? 'delta-negative' : 'delta-positive';

  return (
    <div className="card-premium bg-gradient-to-br from-white via-white to-slate-50/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
            {tooltip ? (
              <div className="group/tip relative">
                <Info className="h-3.5 w-3.5 cursor-help text-slate-300" />
                <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 opacity-0 shadow-xl transition-all group-hover/tip:visible group-hover/tip:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          <p className={`metric-value-fluid mt-3 text-slate-900 ${valueClass}`}>{value}</p>
          {deltaPct !== undefined ? <p className={`mt-2 text-xs font-medium ${deltaColor}`}>{formatDeltaPct(deltaPct)} vs anterior</p> : null}
          {count !== undefined && count > 0 ? <p className="mt-1 text-xs text-slate-500">{count} {count === 1 ? 'item' : 'itens'}</p> : null}
        </div>
        <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
