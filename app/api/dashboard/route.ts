import { NextRequest, NextResponse } from 'next/server';
import { parseDateRangeFromSearchParams } from '@/lib/dateRange';
import { getDashboardData } from '@/lib/analytics/dashboard';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  
  // Parse date range (uses defaults if not provided)
  const dateRange = parseDateRangeFromSearchParams({ from, to });

  // Check if database is configured
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      summary: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingPayables: 0,
        overduePayables: 0,
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
        qualitySummary: { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
        snapshotCount: 0,
      },
      error: 'Database not configured',
    });
  }

  try {
    const { db } = await import('@/lib/db');
    const [totalSnapshots, totalFinancialEntries, totalFineRecords] = await Promise.all([
      db.operationalSnapshot.count(),
      db.financialEntry.count(),
      db.fineRecord.count(),
    ]);

    if (totalSnapshots === 0 && totalFinancialEntries === 0 && totalFineRecords === 0) {
      return NextResponse.json({
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
          qualitySummary: { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
          snapshotCount: 0,
        },
        emptyState: {
          isEmpty: true,
          title: 'Nenhum dado importado ainda',
          description:
            'Importe seus arquivos em Configuracoes para preencher os indicadores, graficos e rankings deste painel.',
          actionLabel: 'Ir para Configuracoes',
          actionHref: '/configuracoes',
        },
      });
    }

    const data = await getDashboardData(db, dateRange);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/dashboard] Error:', error);
    
    return NextResponse.json({
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
        qualitySummary: { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
        snapshotCount: 0,
      },
      error: (error as Error).message,
    });
  }
}
