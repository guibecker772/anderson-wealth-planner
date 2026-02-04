/**
 * Multas (Fines) API - Detailed List
 * 
 * GET /api/multas/list?from=YYYY-MM-DD&to=YYYY-MM-DD&paidBy=ALL|COMPANY|LESSOR&page=1&pageSize=20
 * 
 * Returns paginated list of fines with detailed information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFinesList } from '@/lib/analytics/transaction-metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
  const paidByFilter = (searchParams.get('paidBy') || 'ALL') as 'ALL' | 'COMPANY' | 'LESSOR';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  
  // Check database configuration
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      data: [],
      total: 0,
      page,
      pageSize,
      dateRange: { from, to },
      error: 'Database not configured',
    });
  }
  
  try {
    const { db } = await import('@/lib/db');
    
    const result = await getFinesList(db, {
      from,
      to,
      scope: 'fines',
      paidByFilter,
      page,
      pageSize,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/multas/list] Error:', error);
    return NextResponse.json(
      { 
        data: [], 
        total: 0,
        page,
        pageSize,
        dateRange: { from, to },
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
