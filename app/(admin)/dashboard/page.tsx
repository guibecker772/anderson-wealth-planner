import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DashboardCharts, type DashboardChartsData } from '@/components/dashboard/DashboardCharts';
import { parseDateRangeFromSearchParams } from '@/lib/dateRange';
import { getDashboardData } from '@/lib/analytics/dashboard';
import {
  getExecDashboardData,
  type BucketGranularity,
  type ExecDashboardResponse,
} from '@/lib/analytics/dashboardExec';

interface DashboardPageProps {
  searchParams: { from?: string; to?: string };
}

function getDefaultBucket(dateRange: { from: string; to: string }): BucketGranularity {
  const totalDays = differenceInCalendarDays(parseISO(dateRange.to), parseISO(dateRange.from)) + 1;
  return totalDays > 120 ? 'month' : 'week';
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
    financialSummary: {
      revenue: 0,
      expense: 0,
      investments: 0,
      netCashAfterInvestments: 0,
      entryCount: 0,
    },
    operationalSummary: {
      revenueReceived: 0,
      amountToCharge: 0,
      operationalCost: 0,
      netOperational: 0,
      pendingReceivables: 0,
      fleetStates: [],
      qualitySummary: {
        OK: 0,
        WARNING: 0,
        REVIEW_REQUIRED: 0,
        UNKNOWN: 0,
      },
      snapshotCount: 0,
      latestReferenceDate: null,
    },
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
  const defaultBucket = getDefaultBucket(dateRange);

  if (!process.env.DATABASE_URL) {
    return {
      data: getEmptyDashboardData(dateRange),
      execData: getEmptyExecDashboardData(dateRange, defaultBucket, 'Database not configured'),
      defaultBucket,
    };
  }

  try {
    const { db } = await import('@/lib/db');
    const [totalSnapshots, totalFinancialEntries, totalFineRecords] = await Promise.all([
      db.operationalSnapshot.count(),
      db.financialEntry.count(),
      db.fineRecord.count(),
    ]);

    if (totalSnapshots === 0 && totalFinancialEntries === 0 && totalFineRecords === 0) {
      return {
        data: getEmptyDashboardData(dateRange, { emptyState: getDashboardEmptyState() }),
        execData: getEmptyExecDashboardData(dateRange, defaultBucket),
        defaultBucket,
      };
    }

    const [dashboardData, execData] = await Promise.all([
      getDashboardData(db, dateRange),
      getExecDashboardData(db, dateRange, defaultBucket),
    ]);

    return {
      data: {
        ...dashboardData,
      },
      execData,
      defaultBucket,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar dashboard';
    return {
      data: getEmptyDashboardData(dateRange, { error: message }),
      execData: getEmptyExecDashboardData(dateRange, defaultBucket, message),
      defaultBucket,
    };
  }
}

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const dateRange = parseDateRangeFromSearchParams(searchParams);
  const { data, execData, defaultBucket } = await getDashboardPageData(dateRange);

  return (
    <DashboardCharts
      data={data}
      initialExecData={execData}
      dateRange={dateRange}
      initialBucket={defaultBucket}
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
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full bg-[#022D44]" />
        <h2 className="text-xl font-bold tracking-tight">Visão Geral</h2>
      </div>
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
