import { NextRequest, NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { getImportBatchDetail, parseImportBatchRowFilters } from '@/lib/import/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } },
) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const rowFilters = parseImportBatchRowFilters({
      rowStatus: searchParams.get('rowStatus') || undefined,
      recordType: searchParams.get('recordType') || undefined,
      sheet: searchParams.get('sheet') || undefined,
    });

    const detail = await getImportBatchDetail(params.batchId, rowFilters);
    return NextResponse.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar lote';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
