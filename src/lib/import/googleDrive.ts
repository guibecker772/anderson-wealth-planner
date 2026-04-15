import { google } from 'googleapis';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
]);

export interface GoogleDriveFileDescriptor {
  id: string;
  name: string;
  mimeType: string | null;
  modifiedTime: string;
  md5Checksum: string | null;
  size: string | null;
  parents: string[];
  driveId: string | null;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} nao configurado`);
  }
  return value;
}

function getGoogleDriveAuth() {
  const clientEmail = readRequiredEnv('GOOGLE_DRIVE_CLIENT_EMAIL');
  const privateKey = readRequiredEnv('GOOGLE_DRIVE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const subject = process.env.GOOGLE_DRIVE_IMPERSONATE_USER?.trim() || undefined;

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES,
    subject,
  });
}

function isEligibleSpreadsheet(file: GoogleDriveFileDescriptor): boolean {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm');
  return hasSupportedExtension || (file.mimeType != null && EXCEL_MIME_TYPES.has(file.mimeType));
}

export async function listGoogleDriveFolderFiles(params: {
  folderId: string;
  sharedDriveId?: string | null;
  modifiedAfter?: Date | null;
}): Promise<GoogleDriveFileDescriptor[]> {
  const auth = getGoogleDriveAuth();
  const drive = google.drive({ version: 'v3', auth });
  const files: GoogleDriveFileDescriptor[] = [];

  let pageToken: string | undefined;
  const modifiedClause = params.modifiedAfter
    ? ` and modifiedTime > '${params.modifiedAfter.toISOString()}'`
    : '';

  do {
    const response = await drive.files.list({
      q: `'${params.folderId}' in parents and trashed = false${modifiedClause}`,
      pageToken,
      pageSize: 1000,
      orderBy: 'modifiedTime asc,name',
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,md5Checksum,size,parents,driveId)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: params.sharedDriveId ? 'drive' : 'allDrives',
      driveId: params.sharedDriveId || undefined,
    });

    for (const file of response.data.files || []) {
      if (!file.id || !file.name || !file.modifiedTime) continue;
      const descriptor: GoogleDriveFileDescriptor = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || null,
        modifiedTime: file.modifiedTime,
        md5Checksum: file.md5Checksum || null,
        size: file.size || null,
        parents: file.parents || [],
        driveId: file.driveId || null,
      };

      if (isEligibleSpreadsheet(descriptor)) {
        files.push(descriptor);
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

export async function downloadGoogleDriveFile(fileId: string): Promise<Buffer> {
  const auth = getGoogleDriveAuth();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    {
      responseType: 'arraybuffer',
    },
  );

  return Buffer.from(response.data as ArrayBuffer);
}
