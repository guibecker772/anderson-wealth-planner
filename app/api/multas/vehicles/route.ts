/**
 * Multas (Fines) API - Vehicle Ranking
 * 
 * GET /api/multas/vehicles?from=YYYY-MM-DD&to=YYYY-MM-DD&paidBy=ALL|COMPANY|LESSOR&limit=10&sortBy=count|value
 * 
 * Returns vehicle ranking by fines (by count or by value)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleRanking } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const paidByFilter = (searchParams.get('paidBy') || 'ALL') as 'ALL' | 'COMPANY' | 'LESSOR';
  const limit = parseInt(searchParams.get('limit') || '10');
  const sortBy = (searchParams.get('sortBy') || 'count') as 'count' | 'value';
  
  // Check database configuration
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      data: [],
      limit,
      sortBy,
      dateRange: { from, to },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getVehicleRanking(db, {
      from,
      to,
      scope: 'fines',
      paidByFilter,
      limit,
      sortBy,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/multas/vehicles] Error:', error);
    return NextResponse.json(
      { 
        data: [], 
        limit,
        sortBy,
        dateRange: { from, to },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
