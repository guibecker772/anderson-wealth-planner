import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardCharts, type DashboardChartsData } from '@/components/dashboard/DashboardCharts';
import { parseDateRangeFromSearchParams } from '@/lib/dateRange';
import { getCashflowSeries, getTopExpenseCategories } from '@/lib/analytics/dashboard';
import {
  getExecDashboardData,
  type BucketGranularity,
  type ExecDashboardResponse,
} from '@/lib/analytics/dashboardExec';

const DEFAULT_BUCKET: BucketGranularity = 'week';

interface DashboardPageProps {
  searchParams: { from?: string; to?: string };
}

function getDashboardEmptyState() {
  return {
    isEmpty: true as const,
    title: 'Nenhum dado importado ainda',
    description:
      'Importe seus arquivos em Configuracoes para preencher os indicadores, graficos e rankings deste painel.',
    actionLabel: 'Ir para Configuracoes',
    actionHref: '/configuracoes',
  };
}

function getEmptyDashboardData(
  dateRange: { from: string; to: string },
  options?: { error?: string; emptyState?: DashboardChartsData['emptyState'] }
): DashboardChartsData {
  return {
    summary: {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      pendingPayables: 0,
      overduePayables: 0,
      pendingReceivables: 0,
      overdueReceivables: 0,
    },
    cashflow: [],
    topCategories: [],
    dateRange,
    error: options?.error,
    emptyState: options?.emptyState,
  };
}

function getEmptyExecDashboardData(
  dateRange: { from: string; to: string },
  bucket: BucketGranularity,
  error?: string
): ExecDashboardResponse {
  return {
    summary: {
      incomeReceived: 0,
      expensePaid: 0,
      profitCash: 0,
      margin: null,
      receivable: 0,
      payable: 0,
      receivableOverdue: 0,
      payableOverdue: 0,
    },
    comparison: {
      incomeReceived: { prev: 0, deltaValue: 0, deltaPct: null },
      expensePaid: { prev: 0, deltaValue: 0, deltaPct: null },
      profitCash: { prev: 0, deltaValue: 0, deltaPct: null },
      receivable: { prev: 0, deltaValue: 0, deltaPct: null },
      payable: { prev: 0, deltaValue: 0, deltaPct: null },
      margin: { prev: null, deltaPP: null },
    },
    series: [],
    drivers: [],
    dateRange,
    previousRange: dateRange,
    bucket,
    qualitySummary: {
      OK: 0,
      WARNING: 0,
      REVIEW_REQUIRED: 0,
      UNKNOWN: 0,
    },
    error,
  };
}

async function getDashboardPageData(dateRange: { from: string; to: string }) {
  if (!process.env.DATABASE_URL) {
    return {
      data: getEmptyDashboardData(dateRange),
      execData: getEmptyExecDashboardData(dateRange, DEFAULT_BUCKET, 'Database not configured'),
    };
  }

  try {
    const { db } = await import('@/lib/db');
    const totalSnapshots = await db.operationalSnapshot.count();

    if (totalSnapshots === 0) {
      return {
        data: getEmptyDashboardData(dateRange, { emptyState: getDashboardEmptyState() }),
        execData: getEmptyExecDashboardData(dateRange, DEFAULT_BUCKET),
      };
    }

    const [cashflow, topCategories, execData] = await Promise.all([
      getCashflowSeries(db, dateRange),
      getTopExpenseCategories(db, dateRange, 8),
      getExecDashboardData(db, dateRange, DEFAULT_BUCKET),
    ]);

    return {
      data: {
        summary: {
          totalRevenue: execData.summary.incomeReceived,
          totalExpenses: execData.summary.expensePaid,
          netProfit: execData.summary.profitCash,
          pendingPayables: execData.summary.payable,
          overduePayables: execData.summary.payableOverdue,
          pendingReceivables: execData.summary.receivable,
          overdueReceivables: execData.summary.receivableOverdue,
        },
        cashflow,
        topCategories,
        dateRange,
      },
      execData,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar dashboard';
    return {
      data: getEmptyDashboardData(dateRange, { error: message }),
      execData: getEmptyExecDashboardData(dateRange, DEFAULT_BUCKET, message),
    };
  }
}

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);
  const { data, execData } = await getDashboardPageData(dateRange);

  return (
    <DashboardCharts
      data={data}
      initialExecData={execData}
      dateRange={dateRange}
      initialBucket={DEFAULT_BUCKET}
    />
  );
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">VisÃ£o Geral</h2>
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
