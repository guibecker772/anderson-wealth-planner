import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { getFleetData } from '@/lib/analytics/fleet-metrics';
import { audit, extractIp, extractUserAgent } from '@/lib/audit';
import { resolvePortalDateRange } from '@/lib/portalDateRange';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);

  let investorId: string | null = null;
  if (auth.role === 'INVESTOR') {
    investorId = auth.investorId;
  } else if (auth.role === 'ADMIN') {
    investorId = searchParams.get('_as') || null;
    if (investorId) {
      audit({
        action: 'IMPERSONATE_INVESTOR',
        actorUserId: auth.id,
        actorRole: auth.role,
        targetInvestorId: investorId,
        ip: extractIp(req),
        userAgent: extractUserAgent(req),
      });
    }
  }

  if (!investorId) {
    return NextResponse.json({ error: 'Investidor nao vinculado' }, { status: 403 });
  }

  try {
    const { db } = await import('@/lib/db');
    const dateRange = await resolvePortalDateRange(db, {
      investorId,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });
    const data = await getFleetData(db, dateRange, investorId);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/portal/fleet] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
