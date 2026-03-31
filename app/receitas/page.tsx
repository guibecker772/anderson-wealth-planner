import { Suspense } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionAnalyticsPanel } from "@/components/analytics/TransactionAnalyticsPanel";
import { MetricsSummaryCards } from "@/components/metrics/MetricsSummaryCards";
import { Badge } from "@/components/ui/badge";
import { parseDateRangeFromSearchParams } from "@/lib/dateRange";
import { getMetricsSummaryWithComparison } from "@/lib/analytics/metricsSummary";
import { getTransactionAnalyticsBundle } from "@/lib/analytics/transaction-metrics";
import { listFinancialTableRows } from "@/lib/analytics/workbook-metrics";
import { db } from "@/lib/db";

type SearchParams = Record<string, string | undefined>;

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

async function getReceitas(searchParams: SearchParams) {
  const page = Math.max(1, parseInt(searchParams.page || '1'));
  const pageSize = 20;
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  if (!process.env.DATABASE_URL) {
    return { data: [], meta: { page, totalPages: 1, total: 0 } };
  }

  try {
    let data = await listFinancialTableRows(db, dateRange, 'income');

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
    console.error('[receitas] Erro ao buscar dados:', error);
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
  }
}

async function ReceitasMetricsSection({ dateRange }: { dateRange: { from: string; to: string } }) {
  if (!process.env.DATABASE_URL) {
    return <MetricsSummaryCards scope="income" data={getEmptyMetrics(dateRange)} />;
  }

  const metrics = await getMetricsSummaryWithComparison(db, dateRange);
  return <MetricsSummaryCards scope="income" data={metrics} />;
}

async function ReceitasAnalyticsSection({ dateRange }: { dateRange: { from: string; to: string } }) {
  if (!process.env.DATABASE_URL) {
    return <TransactionAnalyticsPanel scope="income" dateRange={dateRange} data={getEmptyAnalytics(dateRange)} />;
  }

  const analytics = await getTransactionAnalyticsBundle(db, {
    from: dateRange.from,
    to: dateRange.to,
    scope: 'income',
    limit: 5,
  });

  return <TransactionAnalyticsPanel scope="income" dateRange={dateRange} data={analytics} />;
}

export default async function ReceitasPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, meta } = await getReceitas(searchParams);
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Receitas</h2>
            <Badge variant="success" size="lg">{meta.total}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Controle suas entradas e previsÃµes de faturamento
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-[100px] bg-muted/20 rounded-xl animate-pulse" />}>
        <ReceitasMetricsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[300px] bg-muted/20 rounded-xl animate-pulse" />}>
        <ReceitasAnalyticsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[60px] bg-muted/20 rounded-xl animate-pulse" />}>
        <TransactionFilters />
      </Suspense>

      <TransactionTable
        data={data}
        page={Number(meta.page)}
        totalPages={Number(meta.totalPages)}
        type="RECEIVABLE"
      />
    </div>
  );
}
