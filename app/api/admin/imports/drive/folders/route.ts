import { NextRequest, NextResponse } from 'next/server';

import { isAuthError, requireAdmin } from '@/lib/auth-utils';
import { createDriveImportFolder, listDriveImportFolders } from '@/lib/import/driveFolders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const folders = await listDriveImportFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const folder = await createDriveImportFolder({
      label: body?.label,
      folderId: body?.folderId,
      sharedDriveId: body?.sharedDriveId,
      enabled: body?.enabled,
      templateVersion: body?.templateVersion,
    });
    return NextResponse.json({ ok: true, folder }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar pasta monitorada';
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
