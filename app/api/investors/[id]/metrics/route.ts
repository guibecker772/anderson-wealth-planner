/**
 * Investors API - Metrics by ID
 * 
 * GET /api/investors/[id]/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 
 * Returns metrics for a specific investor (consolidated + per-vehicle)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInvestorMetrics } from '@/lib/analytics/investor-metrics';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const investorId = params.id;
  
  // Check database configuration
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      investor: null,
      totals: {
        operationalRevenue: 0,
        operationalCost: 0,
        operationalFines: 0,
        operationalDiscount: 0,
        operationalResult: 0,
        identifiedFinancialInflow: 0,
        identifiedFinancialOutflow: 0,
        identifiedFinancialNet: 0,
        expandedResult: 0,
      },
      vehicles: [],
      financialLinks: [],
      allocationSummary: {
        linkedEntryCount: 0,
        linkedRevenueCount: 0,
        linkedExpenseCount: 0,
        linkageCoverageNote: '',
        excludedFromInvestorResult: [],
      },
      dateRange: { from, to },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getInvestorMetrics(db, investorId, { from, to });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Investor not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/investors/:id/metrics] Error:', error);
    return NextResponse.json(
      { 
        investor: null,
        totals: {
          operationalRevenue: 0,
          operationalCost: 0,
          operationalFines: 0,
          operationalDiscount: 0,
          operationalResult: 0,
          identifiedFinancialInflow: 0,
          identifiedFinancialOutflow: 0,
          identifiedFinancialNet: 0,
          expandedResult: 0,
        },
        vehicles: [],
        financialLinks: [],
        allocationSummary: {
          linkedEntryCount: 0,
          linkedRevenueCount: 0,
          linkedExpenseCount: 0,
          linkageCoverageNote: '',
          excludedFromInvestorResult: [],
        },
        dateRange: { from, to },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
