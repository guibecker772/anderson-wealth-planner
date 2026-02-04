/**
 * Multas (Fines) API - Time Series
 * 
 * GET /api/multas/series?from=YYYY-MM-DD&to=YYYY-MM-DD&paidBy=ALL|COMPANY|LESSOR
 * 
 * Returns time series data for fines evolution chart
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactionTimeSeries } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const paidByFilter = (searchParams.get('paidBy') || 'ALL') as 'ALL' | 'COMPANY' | 'LESSOR';
  
  // Check database configuration
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      data: [],
      granularity: 'day',
      dateRange: { from, to },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getTransactionTimeSeries(db, {
      from,
      to,
      scope: 'fines',
      paidByFilter,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/multas/series] Error:', error);
    return NextResponse.json(
      { 
        data: [], 
        granularity: 'day',
        dateRange: { from, to },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
