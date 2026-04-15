import { NextRequest, NextResponse } from 'next/server';

import { authorizeImportRequest } from '@/lib/import/auth';
import { publishImportBatch } from '@/lib/import/publisher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = authorizeImportRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });
    }

    const body = await request.json();
    const batchId = typeof body?.batchId === 'string' ? body.batchId.trim() : '';

    if (!batchId) {
      return NextResponse.json({ ok: false, message: 'batchId obrigatorio' }, { status: 400 });
    }

    const result = await publishImportBatch(batchId);

    return NextResponse.json({
      ok: true,
      message:
        result.status === 'NOOP'
          ? 'Batch sem linhas publicaveis'
          : `Batch publicado com sucesso: ${result.publishedRows} nova(s) linha(s), ${result.reusedRows} reaproveitada(s)`,
      ...result,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno ao publicar batch';
    console.error('Erro na publicacao do batch:', error);

    return NextResponse.json(
      {
        ok: false,
        message: errMsg,
      },
      { status: 500 },
    );
  }
}
