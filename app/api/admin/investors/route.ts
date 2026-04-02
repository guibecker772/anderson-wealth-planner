import { NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/admin/investors — Simple investor list for dropdowns */
export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const investors = await db.investor.findMany({
    orderBy: { displayName: 'asc' },
    select: { id: true, displayName: true },
  });

  return NextResponse.json({ investors });
}
