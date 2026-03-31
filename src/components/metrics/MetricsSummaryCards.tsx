'use client';

import { AlertTriangle, TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';
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
  if (value === null || value === undefined) return 'â€”';
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

  const realizedLabel = isIncome ? 'Recebido no PerÃ­odo' : 'Pago no PerÃ­odo';
  const pendingLabel = isIncome ? 'A Receber no PerÃ­odo' : 'A Pagar no PerÃ­odo';
  const realizedTooltip = isIncome
    ? 'Valor recebido (por data de recebimento)'
    : 'Valor pago (por data de pagamento)';
  const pendingTooltip = isIncome
    ? 'Pendente de recebimento (por vencimento)'
    : 'Pendente de pagamento (por vencimento)';

  const primaryColorClass = isIncome ? 'text-emerald-600' : 'text-red-600';
  const bgColorClass = isIncome ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title={realizedLabel}
          value={formatCurrencyFull(realized)}
          tooltip={realizedTooltip}
          deltaPct={realizedDeltaPct}
          deltaPositiveIsGood={isIncome}
          icon={isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          iconBg={bgColorClass}
          iconColor={primaryColorClass}
          valueColor={primaryColorClass}
        />

        <MetricCard
          title={pendingLabel}
          value={formatCurrencyFull(pending)}
          tooltip={pendingTooltip}
          deltaPct={pendingDeltaPct}
          icon={<Clock className="w-5 h-5" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
        />

        <MetricCard
          title="Vencidos"
          value={formatCurrencyFull(overdue)}
          tooltip="Pendentes com vencimento anterior a hoje"
          count={overdueCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg={overdue > 0 ? 'bg-red-500/10' : 'bg-muted'}
          iconColor={overdue > 0 ? 'text-red-600' : 'text-muted-foreground'}
          valueColor={overdue > 0 ? 'text-red-600' : ''}
        />

        <MetricCard
          title="Total Previsto"
          value={formatCurrencyFull(totalPlanned)}
          tooltip={`${realizedLabel} + ${pendingLabel}`}
          icon={<span className="text-lg font-bold">Î£</span>}
          iconBg="bg-[#022D44]/10"
          iconColor="text-[#022D44]"
        />
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-4 px-1">
        <span>
          {isIncome ? 'Recebido' : 'Pago'}: {formatCurrencyFull(realized)}
        </span>
        <span>+</span>
        <span>
          {isIncome ? 'A Receber' : 'A Pagar'}: {formatCurrencyFull(pending)}
        </span>
        <span>=</span>
        <span className="font-medium">
          Total: {formatCurrencyFull(totalPlanned)}
        </span>
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
  iconBg = 'bg-muted',
  iconColor = 'text-foreground',
  valueColor = '',
}: {
  title: string;
  value: string;
  tooltip?: string;
  deltaPct?: number | null;
  deltaPositiveIsGood?: boolean;
  count?: number;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}) {
  const getDeltaColor = () => {
    if (deltaPct === null || deltaPct === undefined) return 'text-muted-foreground';
    if (deltaPositiveIsGood) {
      return deltaPct >= 0 ? 'text-emerald-600' : 'text-red-600';
    }
    return deltaPct >= 0 ? 'text-red-600' : 'text-emerald-600';
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            {tooltip && (
              <div className="group relative flex-shrink-0">
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded-md text-xs text-popover-foreground whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                  {tooltip}
                </div>
              </div>
            )}
          </div>
          <p className={`text-xl font-bold mt-1 ${valueColor}`}>{value}</p>
          {deltaPct !== undefined && (
            <p className={`text-xs mt-0.5 ${getDeltaColor()}`}>
              {formatDeltaPct(deltaPct)} vs anterior
            </p>
          )}
          {count !== undefined && count > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {count} {count === 1 ? 'item' : 'itens'}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor} flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
