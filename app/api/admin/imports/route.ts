import { NextRequest, NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { listImportBatches, parseImportMonitoringFilters } from '@/lib/import/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const searchParams = request.nextUrl.searchParams;
  const filters = parseImportMonitoringFilters({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    status: searchParams.get('status') || undefined,
    kind: searchParams.get('kind') || undefined,
    q: searchParams.get('q') || undefined,
  });

  const result = await listImportBatches(filters);
  return NextResponse.json(result);
}
