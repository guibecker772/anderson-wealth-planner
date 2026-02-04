/**
 * Investors API - List
 * 
 * GET /api/investors
 * 
 * Returns list of all investors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInvestorList } from '@/lib/analytics/investor-metrics';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const result = await getInvestorList();
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
