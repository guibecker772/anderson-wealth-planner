import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { getVehicleDetailV2 } from '@/lib/analytics/fleet-metrics';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { placa: string } },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);

  // Determine investorId: INVESTOR uses own; ADMIN can use _as param
  let investorId: string | null = null;
  if (auth.role === 'INVESTOR') {
    investorId = auth.investorId;
  } else if (auth.role === 'ADMIN') {
    investorId = searchParams.get('_as') || null;
  }

  if (!investorId) {
    return NextResponse.json({ error: 'Investidor não vinculado' }, { status: 403 });
  }

  const plate = decodeURIComponent(params.placa);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const dateRange = { from: from || defaultFrom, to: to || defaultTo };

  try {
    const { db } = await import('@/lib/db');
    const data = await getVehicleDetailV2(db, plate, dateRange, investorId);
    if (!data) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/portal/fleet/[placa]] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
