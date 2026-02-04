import { NextRequest, NextResponse } from 'next/server';
import { 
  getExecDashboardData, 
  type BucketGranularity 
} from '@/lib/analytics/dashboardExec';

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Parse parameters
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const bucketParam = searchParams.get('bucket') || 'day';
  
  // Validate bucket parameter
  const validBuckets: BucketGranularity[] = ['day', 'week', 'month'];
  const bucket: BucketGranularity = validBuckets.includes(bucketParam as BucketGranularity) 
    ? (bucketParam as BucketGranularity) 
    : 'day';

  // Default date range: current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const dateRange = {
    from: from || defaultFrom,
    to: to || defaultTo,
  };

  // Check if database is configured
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      summary: {
        incomeReceived: 0,
        expensePaid: 0,
        profitCash: 0,
        margin: null,
        receivable: 0,
        payable: 0,
        receivableOverdue: 0,
        payableOverdue: 0,
      },
      comparison: {
        incomeReceived: { prev: 0, deltaValue: 0, deltaPct: null },
        expensePaid: { prev: 0, deltaValue: 0, deltaPct: null },
        profitCash: { prev: 0, deltaValue: 0, deltaPct: null },
        margin: { prev: null, deltaPP: null },
      },
      series: [],
      drivers: [],
      dateRange,
      previousRange: dateRange,
      bucket,
      error: 'Database not configured',
    });
  }

  try {
    const { db } = await import('@/lib/db');
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[api/dashboard/exec] Request:', { dateRange, bucket });
    }
    
    const data = await getExecDashboardData(db, dateRange, bucket);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[api/dashboard/exec] Response:', {
        profitCash: data.summary.profitCash,
        seriesCount: data.series.length,
        driversCount: data.drivers.length,
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/dashboard/exec] Error:', error);
    
    return NextResponse.json({
      summary: {
        incomeReceived: 0,
        expensePaid: 0,
        profitCash: 0,
        margin: null,
        receivable: 0,
        payable: 0,
        receivableOverdue: 0,
        payableOverdue: 0,
      },
      comparison: {
        incomeReceived: { prev: 0, deltaValue: 0, deltaPct: null },
        expensePaid: { prev: 0, deltaValue: 0, deltaPct: null },
        profitCash: { prev: 0, deltaValue: 0, deltaPct: null },
        margin: { prev: null, deltaPP: null },
      },
      series: [],
      drivers: [],
      dateRange,
      previousRange: dateRange,
      bucket,
      error: (error as Error).message,
    }, { status: 500 });
  }
}
