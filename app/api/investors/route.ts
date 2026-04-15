/**
 * Investors API - List
 * 
 * GET /api/investors
 * 
 * Returns list of all investors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInvestorList } from '@/lib/analytics/investor-metrics';
import { parseDateRangeFromSearchParams } from '@/lib/dateRange';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateRange = parseDateRangeFromSearchParams({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });
    const { db } = await import('@/lib/db');
    const result = await getInvestorList(db, dateRange);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/investors] Error:', error);
    return NextResponse.json(
      { 
        investors: [], 
        total: 0,
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
