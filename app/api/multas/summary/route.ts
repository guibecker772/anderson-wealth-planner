/**
 * Multas (Fines) API - Summary
 * 
 * GET /api/multas/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&paidBy=ALL|COMPANY|LESSOR
 * 
 * Returns summary metrics for fines with period comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactionSummary } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const paidByFilter = (searchParams.get('paidBy') || 'ALL') as 'ALL' | 'COMPANY' | 'LESSOR';
  
  // Check database configuration
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      total: 0,
      count: 0,
      prevTotal: 0,
      prevCount: 0,
      deltaValue: 0,
      deltaPct: null,
      dateRange: { from, to },
      previousRange: { from: '', to: '' },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getTransactionSummary(db, {
      from,
      to,
      scope: 'fines',
      paidByFilter,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/multas/summary] Error:', error);
    return NextResponse.json(
      { 
        total: 0,
        count: 0,
        prevTotal: 0,
        prevCount: 0,
        deltaValue: 0,
        deltaPct: null,
        dateRange: { from, to },
        previousRange: { from: '', to: '' },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
