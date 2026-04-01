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

async function resolveReceitasDateRange(searchParams: SearchParams) {
  const explicitDateRange = parseDateRangeFromSearchParams(searchParams);
  if (searchParams.from && searchParams.to) {
    return explicitDateRange;
  }

  if (!process.env.DATABASE_URL) {
    return explicitDateRange;
  }

  const latestEntry = await db.financialEntry.aggregate({
    where: { domain: 'REVENUE' },
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
  const dateRange = await resolveReceitasDateRange(searchParams);
  const { data, meta } = await getReceitas({ ...searchParams, from: dateRange.from, to: dateRange.to });

  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Ledger Financeiro"
        title="Receitas"
        description="A linguagem visual passa a tratar a aba Receita como um bloco principal do sistema, com leitura mais editorial, contraste mais forte e contexto claro de período."
        accent="green"
        meta={
          <>
            <span className="page-hero-chip">Aba principal • Receita</span>
            <Badge variant="success" size="lg">{meta.total}</Badge>
            <span className="page-hero-chip">Entradas financeiras</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[120px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <ReceitasMetricsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[340px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <ReceitasAnalyticsSection dateRange={dateRange} />
      </Suspense>

      <Suspense fallback={<div className="h-[84px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <TransactionFilters />
      </Suspense>

      <div className="data-table-shell">
        <TransactionTable
          data={data}
          page={Number(meta.page)}
          totalPages={Number(meta.totalPages)}
          type="RECEIVABLE"
        />
      </div>
    </div>
  );
}
