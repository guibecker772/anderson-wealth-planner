import { DriveSyncRunTrigger } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { syncGoogleDriveImports } from '@/lib/import/driveSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const summary = await syncGoogleDriveImports({
      driveImportFolderId: typeof body?.driveImportFolderId === 'string' ? body.driveImportFolderId : null,
      trigger: DriveSyncRunTrigger.MANUAL,
    });

    return NextResponse.json({
      ...summary,
      message: summary.ok
        ? `Sincronizacao Drive concluida: ${summary.importedFiles} importado(s), ${summary.skippedFiles} ignorado(s)`
        : 'Sincronizacao Drive concluida com erros',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar Google Drive';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
