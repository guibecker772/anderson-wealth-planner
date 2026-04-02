import { NextRequest, NextResponse } from 'next/server';
import { getFleetData } from '@/lib/analytics/fleet-metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const dateRange = {
    from: from || defaultFrom,
    to: to || defaultTo,
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      kpis: {
        totalVehicles: 0,
        totalSnapshots: 0,
        operationalRevenueReceived: 0,
        operationalCost: 0,
        amountToCharge: 0,
        openAmount: 0,
        operationalResult: 0,
        statusDistribution: [],
      },
      vehicles: [],
      dateRange,
      error: 'Database not configured',
    });
  }

  try {
    const { db } = await import('@/lib/db');
    const data = await getFleetData(db, dateRange);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/frota] Error:', err);
    return NextResponse.json(
      {
        kpis: {
          totalVehicles: 0,
          totalSnapshots: 0,
          operationalRevenueReceived: 0,
          operationalCost: 0,
          amountToCharge: 0,
          openAmount: 0,
          operationalResult: 0,
          statusDistribution: [],
        },
        vehicles: [],
        dateRange,
        error: (err as Error).message,
      },
      { status: 500 },
    );
  }
}
