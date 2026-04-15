import { db } from '@/lib/db';

export interface DriveImportFolderInput {
  label: string;
  folderId: string;
  sharedDriveId?: string | null;
  enabled?: boolean;
  templateVersion?: string | null;
}

function normalizeText(value: string | null | undefined): string | null {
  const text = (value || '').trim();
  return text.length > 0 ? text : null;
}

export async function listDriveImportFolders() {
  return db.driveImportFolder.findMany({
    orderBy: [{ enabled: 'desc' }, { label: 'asc' }],
  });
}

export async function createDriveImportFolder(input: DriveImportFolderInput) {
  const label = normalizeText(input.label);
  const folderId = normalizeText(input.folderId);

  if (!label || !folderId) {
    throw new Error('label e folderId sao obrigatorios');
  }

  return db.driveImportFolder.create({
    data: {
      label,
      folderId,
      sharedDriveId: normalizeText(input.sharedDriveId),
      enabled: input.enabled ?? true,
      templateVersion: normalizeText(input.templateVersion),
      details: {
        provider: 'GOOGLE_DRIVE',
      },
    },
  });
}

export async function updateDriveImportFolder(
  id: string,
  input: Partial<DriveImportFolderInput> & { errorMessage?: string | null },
) {
  return db.driveImportFolder.update({
    where: { id },
    data: {
      label: input.label !== undefined ? normalizeText(input.label) || undefined : undefined,
      folderId: input.folderId !== undefined ? normalizeText(input.folderId) || undefined : undefined,
      sharedDriveId:
        input.sharedDriveId !== undefined ? normalizeText(input.sharedDriveId) : undefined,
      enabled: input.enabled,
      templateVersion:
        input.templateVersion !== undefined ? normalizeText(input.templateVersion) : undefined,
      errorMessage: input.errorMessage !== undefined ? input.errorMessage : undefined,
    },
  });
}
