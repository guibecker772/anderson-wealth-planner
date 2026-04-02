import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/portal/me — Returns current user's portal-relevant flags */
export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const user = await db.user.findUnique({
    where: { id: auth.id },
    select: { firstLogin: true, active: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    firstLogin: user.firstLogin,
    active: user.active,
    role: user.role,
  });
}
