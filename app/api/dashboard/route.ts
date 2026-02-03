import { NextRequest, NextResponse } from 'next/server';
import { parseDateRangeFromSearchParams, getDefaultDateRange } from '@/lib/dateRange';
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
      error: 'Database not configured',
    });
  }

  try {
    const { db } = await import('@/lib/db');
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
      },
      cashflow: [],
      topCategories: [],
      dateRange,
      error: (error as Error).message,
    });
  }
}
