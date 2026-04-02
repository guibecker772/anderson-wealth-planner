import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { getFleetData } from '@/lib/analytics/fleet-metrics';
import { audit, extractIp, extractUserAgent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);

  // Determine investorId: INVESTOR uses own; ADMIN can use _as param
  let investorId: string | null = null;
  if (auth.role === 'INVESTOR') {
    investorId = auth.investorId;
  } else if (auth.role === 'ADMIN') {
    investorId = searchParams.get('_as') || null;
    // Audit impersonation
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
    return NextResponse.json({ error: 'Investidor não vinculado' }, { status: 403 });
  }

  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const dateRange = { from: from || defaultFrom, to: to || defaultTo };

  if (!investorId) {
    return NextResponse.json({ error: 'Investidor não vinculado' }, { status: 403 });
  }

  try {
    const { db } = await import('@/lib/db');
    const data = await getFleetData(db, dateRange, investorId);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/portal/fleet] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
