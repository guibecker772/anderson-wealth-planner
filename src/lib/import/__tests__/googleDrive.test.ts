/** @jest-environment node */

const listMock = jest.fn();
const getMock = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({})),
    },
    drive: jest.fn().mockImplementation(() => ({
      files: {
        list: listMock,
        get: getMock,
      },
    })),
  },
}));

import { downloadGoogleDriveFile, listGoogleDriveFolderFiles } from '../googleDrive';

describe('googleDrive service', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL = 'svc@example.iam.gserviceaccount.com';
    process.env.GOOGLE_DRIVE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('lists eligible spreadsheet files with pagination support', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          nextPageToken: 'page-2',
          files: [
            {
              id: '1',
              name: 'planilha.xlsm',
              mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
              modifiedTime: '2026-04-11T10:00:00.000Z',
              md5Checksum: 'abc',
              parents: ['folder-1'],
              driveId: 'drive-1',
            },
            {
              id: '2',
              name: 'notes.txt',
              mimeType: 'text/plain',
              modifiedTime: '2026-04-11T10:00:00.000Z',
              parents: ['folder-1'],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          nextPageToken: undefined,
          files: [
            {
              id: '3',
              name: 'base.xlsx',
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              modifiedTime: '2026-04-11T10:05:00.000Z',
              md5Checksum: 'def',
              parents: ['folder-1'],
              driveId: 'drive-1',
            },
          ],
        },
      });

    const files = await listGoogleDriveFolderFiles({
      folderId: 'folder-1',
      sharedDriveId: 'drive-1',
      modifiedAfter: new Date('2026-04-11T09:00:00.000Z'),
    });

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.id)).toEqual(['1', '3']);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('downloads a drive file as buffer', async () => {
    getMock.mockResolvedValue({
      data: Uint8Array.from([1, 2, 3, 4]).buffer,
    });

    const buffer = await downloadGoogleDriveFile('file-1');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(Array.from(buffer)).toEqual([1, 2, 3, 4]);
    expect(getMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'file-1',
        alt: 'media',
      }),
      expect.objectContaining({
        responseType: 'arraybuffer',
      }),
    );
  });
});
