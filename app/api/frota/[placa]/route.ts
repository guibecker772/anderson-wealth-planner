import { NextRequest, NextResponse } from 'next/server';
import { getVehicleDetailV2 } from '@/lib/analytics/fleet-metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { placa: string } }) {
  const plate = decodeURIComponent(params.placa);
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
    return NextResponse.json({ error: 'Database not configured', plate, dateRange }, { status: 503 });
  }

  try {
    const { db } = await import('@/lib/db');
    const data = await getVehicleDetailV2(db, plate, dateRange);

    if (!data) {
      return NextResponse.json(
        { error: 'Veículo não encontrado no período', plate, dateRange },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/frota/[placa]] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message, plate, dateRange },
      { status: 500 },
    );
  }
}
