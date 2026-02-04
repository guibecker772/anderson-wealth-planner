/**
 * Transaction Metrics - Summary API
 * 
 * GET /api/metrics/summary?scope=income|expense&from=YYYY-MM-DD&to=YYYY-MM-DD
 * 
 * Returns summary with period comparison (delta vs previous period)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactionSummary } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const scope = (searchParams.get('scope') || 'income') as 'income' | 'expense' | 'fines';
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const paidByFilter = searchParams.get('paidBy') as 'ALL' | 'COMPANY' | 'LESSOR' | null;
  
  // Validate scope
  if (!['income', 'expense', 'fines'].includes(scope)) {
    return NextResponse.json(
      { error: 'Invalid scope. Must be: income, expense, or fines' },
      { status: 400 }
    );
  }
  
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
      scope,
      paidByFilter: paidByFilter || undefined,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/metrics/summary] Error:', error);
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
