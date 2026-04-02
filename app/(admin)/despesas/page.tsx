import { Suspense } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionAnalyticsPanel } from "@/components/analytics/TransactionAnalyticsPanel";
import { MetricsSummaryCards } from "@/components/metrics/MetricsSummaryCards";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/ui/PageHero";
import { parseDateRangeFromSearchParams } from "@/lib/dateRange";
import { getMetricsSummaryWithComparison } from "@/lib/analytics/metricsSummary";
import { getTransactionAnalyticsBundle } from "@/lib/analytics/transaction-metrics";
import { listFinancialTableRows } from "@/lib/analytics/workbook-metrics";
import { db } from "@/lib/db";
import { endOfMonth, format, startOfMonth } from "date-fns";

type SearchParams = Record<string, string | undefined>;

async function resolveDespesasDateRange(searchParams: SearchParams) {
  const explicitDateRange = parseDateRangeFromSearchParams(searchParams);
  if (searchParams.from && searchParams.to) {
    return explicitDateRange;
  }

  if (!process.env.DATABASE_URL) {
    return explicitDateRange;
  }

  const latestEntry = await db.financialEntry.aggregate({
    where: { domain: 'EXPENSE' },
    _max: { entryDate: true },
  });

  if (!latestEntry._max.entryDate) {
    return explicitDateRange;
  }

  return {
    from: format(startOfMonth(latestEntry._max.entryDate), 'yyyy-MM-dd'),
    to: format(endOfMonth(latestEntry._max.entryDate), 'yyyy-MM-dd'),
  };
}

function getEmptyMetrics(dateRange: { from: string; to: string }) {
  return {
    current: {
      income: {
        received: 0,
        receivable: 0,
        overdue: 0,
        receivedCount: 0,
        receivableCount: 0,
        overdueCount: 0,
      },
      expense: {
        paid: 0,
        payable: 0,
        overdue: 0,
        paidCount: 0,
        payableCount: 0,
        overdueCount: 0,
      },
      netCash: 0,
      dateRange,
    },
    previous: {
      income: {
        received: 0,
        receivable: 0,
        overdue: 0,
        receivedCount: 0,
        receivableCount: 0,
        overdueCount: 0,
      },
      expense: {
        paid: 0,
        payable: 0,
        overdue: 0,
        paidCount: 0,
        payableCount: 0,
        overdueCount: 0,
      },
      netCash: 0,
      dateRange,
    },
    delta: {
      receivedDelta: 0,
      receivedDeltaPct: null,
      paidDelta: 0,
      paidDeltaPct: null,
      netCashDelta: 0,
      netCashDeltaPct: null,
      receivableDelta: 0,
      receivableDeltaPct: null,
      payableDelta: 0,
      payableDeltaPct: null,
    },
  };
}

function getEmptyAnalytics(dateRange: { from: string; to: string }) {
  return {
    summary: {
      total: 0,
      count: 0,
      prevTotal: 0,
      prevCount: 0,
      deltaValue: 0,
      deltaPct: null,
      dateRange,
      previousRange: dateRange,
    },
    series: {
      data: [],
      granularity: 'day' as const,
      dateRange,
    },
    top: {
      data: [],
      limit: 5,
      dateRange,
    },
  };
}

async function getDespesas(searchParams: SearchParams) {
  const page = Math.max(1, parseInt(searchParams.page || '1'));
  const pageSize = 20;
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  if (!process.env.DATABASE_URL) {
    return { data: [], meta: { page, totalPages: 1, total: 0 } };
  }

  try {
    let data = await listFinancialTableRows(db, dateRange, 'expense');

    if (searchParams.status && searchParams.status !== 'ALL') {
      data = data.filter((row) => row.status === searchParams.status);
    }
    if (searchParams.category) {
      data = data.filter((row) => row.category?.includes(searchParams.category as string));
    }
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase();
      data = data.filter((row) =>
        `${row.counterparty || ''} ${row.category || ''}`.toLowerCase().includes(q)
      );
    }

    const count = data.length;
    data = data.slice((page - 1) * pageSize, page * pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize) || 1,
      },
    };
  } catch (error) {
    console.error('[despesas] Erro ao buscar dados:', error);
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
  }
}

async function DespesasMetricsSection({ dateRange }: { dateRange: { from: string; to: string } }) {
  if (!process.env.DATABASE_URL) {
    return <MetricsSummaryCards scope="expense" data={getEmptyMetrics(dateRange)} />;
  }

  const metrics = await getMetricsSummaryWithComparison(db, dateRange);
  return <MetricsSummaryCards scope="expense" data={metrics} />;
}

async function DespesasAnalyticsSection({ dateRange }: { dateRange: { from: string; to: string } }) {
  if (!process.env.DATABASE_URL) {
    return <TransactionAnalyticsPanel scope="expense" dateRange={dateRange} data={getEmptyAnalytics(dateRange)} />;
  }

  const analytics = await getTransactionAnalyticsBundle(db, {
    from: dateRange.from,
    to: dateRange.to,
    scope: 'expense',
    limit: 5,
  });

  return <TransactionAnalyticsPanel scope="expense" dateRange={dateRange} data={analytics} />;
}

export default async function DespesasPage({ searchParams }: { searchParams: SearchParams }) {
  const dateRange = await resolveDespesasDateRange(searchParams);
  const { data, meta } = await getDespesas({ ...searchParams, from: dateRange.from, to: dateRange.to });

  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Ledger Financeiro"
        title="Despesas"
        description="Saídas financeiras com presença visual mais forte, leitura por classe e uma distinção mais nobre entre custo do ledger e contexto operacional."
        accent="amber"
        meta={
          <>
            <span className="page-hero-chip">Aba principal • Despesa</span>
            <Badge variant="warning" size="lg">{meta.total}</Badge>
            <span className="page-hero-chip">Saídas financeiras</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[120px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <DespesasMetricsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[340px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <DespesasAnalyticsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[84px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <TransactionFilters />
      </Suspense>

      <div className="data-table-shell">
        <TransactionTable
          data={data}
          page={Number(meta.page)}
          totalPages={Number(meta.totalPages)}
          type="PAYABLE"
        />
      </div>
    </div>
  );
}
