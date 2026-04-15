import { NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { publishImportBatch } from '@/lib/import/publisher';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { batchId: string } },
) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    const result = await publishImportBatch(params.batchId);
    return NextResponse.json({
      ok: true,
      message:
        result.status === 'NOOP'
          ? 'Batch sem linhas publicaveis'
          : `Batch publicado: ${result.publishedRows} nova(s), ${result.reusedRows} reaproveitada(s)`,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao publicar batch';
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
