import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { getVehicleDetailV2 } from '@/lib/analytics/fleet-metrics';
import { resolvePortalDateRange } from '@/lib/portalDateRange';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { placa: string } },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);

  let investorId: string | null = null;
  if (auth.role === 'INVESTOR') {
    investorId = auth.investorId;
  } else if (auth.role === 'ADMIN') {
    investorId = searchParams.get('_as') || null;
  }

  if (!investorId) {
    return NextResponse.json({ error: 'Investidor nao vinculado' }, { status: 403 });
  }

  const plate = decodeURIComponent(params.placa);

  try {
    const { db } = await import('@/lib/db');
    const dateRange = await resolvePortalDateRange(db, {
      investorId,
      plate,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });
    const data = await getVehicleDetailV2(db, plate, dateRange, investorId);
    if (!data) {
      return NextResponse.json({ error: 'Veiculo nao encontrado no periodo' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/portal/fleet/[placa]] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
