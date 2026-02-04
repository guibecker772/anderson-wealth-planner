/**
 * GET /api/metrics/unified
 * 
 * Unified metrics endpoint - single source of truth for all financial dashboards.
 * Returns income/expense metrics with cash view vs obligation view breakdown.
 * 
 * Query params:
 * - from: YYYY-MM-DD (required)
 * - to: YYYY-MM-DD (required)
 * - compare: boolean (optional, default true) - include previous period comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getMetricsSummary, 
  getMetricsSummaryWithComparison,
  type MetricsSummary,
  type MetricsSummaryWithComparison,
} from '@/lib/analytics/metricsSummary';

export const dynamic = 'force-dynamic';

// Return empty metrics for fallback
function getEmptyMetrics(): MetricsSummaryWithComparison {
  const emptyMetrics: MetricsSummary = {
    income: { 
      received: 0, receivable: 0, overdue: 0,
      receivedCount: 0, receivableCount: 0, overdueCount: 0,
    },
    expense: { 
      paid: 0, payable: 0, overdue: 0,
      paidCount: 0, payableCount: 0, overdueCount: 0,
    },
    netCash: 0,
    dateRange: { from: '', to: '' },
  };
  return {
    current: emptyMetrics,
    previous: emptyMetrics,
    delta: {
      receivedDelta: 0, receivedDeltaPct: null,
      paidDelta: 0, paidDeltaPct: null,
      netCashDelta: 0, netCashDeltaPct: null,
      receivableDelta: 0, receivableDeltaPct: null,
      payableDelta: 0, payableDeltaPct: null,
    },
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const compare = searchParams.get('compare') !== 'false'; // default true
  
  // Validate required params
  if (!from || !to) {
    return NextResponse.json(
      { error: 'Missing required parameters: from, to' },
      { status: 400 }
    );
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // Check if database is configured
  if (!process.env.DATABASE_URL) {
    console.warn('[api/metrics/unified] No DATABASE_URL, returning empty');
    return NextResponse.json(getEmptyMetrics());
  }

  try {
    const { db } = await import('@/lib/db');
    const dateRange = { from, to };
    
    if (compare) {
      const result = await getMetricsSummaryWithComparison(db, dateRange);
      return NextResponse.json(result);
    } else {
      const result = await getMetricsSummary(db, dateRange);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('[api/metrics/unified] Error:', error);
    
    // Return empty metrics instead of 500 for resilience
    const emptyResult = getEmptyMetrics();
    emptyResult.current.dateRange = { from, to };
    return NextResponse.json(emptyResult);
  }
}
