/**
 * Transaction Metrics - Top Ranking API
 * 
 * GET /api/metrics/top?scope=income|expense&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=5
 * 
 * Returns top N categories/classes by total value
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopByClass } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const scope = (searchParams.get('scope') || 'income') as 'income' | 'expense' | 'fines';
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const limit = parseInt(searchParams.get('limit') || '5');
  
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
      data: [],
      limit,
      dateRange: { from, to },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getTopByClass(db, {
      from,
      to,
      scope,
      limit,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/metrics/top] Error:', error);
    return NextResponse.json(
      { 
        data: [], 
        limit,
        dateRange: { from, to },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
