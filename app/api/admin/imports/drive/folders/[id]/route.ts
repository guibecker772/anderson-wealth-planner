import { NextRequest, NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { updateDriveImportFolder } from '@/lib/import/driveFolders';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const folder = await updateDriveImportFolder(params.id, {
      label: body?.label,
      folderId: body?.folderId,
      sharedDriveId: body?.sharedDriveId,
      enabled: body?.enabled,
      templateVersion: body?.templateVersion,
      errorMessage: body?.errorMessage,
    });
    return NextResponse.json({ ok: true, folder });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar pasta monitorada';
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
