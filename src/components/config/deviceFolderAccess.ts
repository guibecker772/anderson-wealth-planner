'use client';

export type DeviceFolderPermission = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';

export interface DeviceImportCandidate {
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  handle: FileSystemFileHandle;
}

export interface DeviceImportFolders {
  root: FileSystemDirectoryHandle;
  inbox: FileSystemDirectoryHandle;
  processed: FileSystemDirectoryHandle;
  error: FileSystemDirectoryHandle;
  archive: FileSystemDirectoryHandle;
}

const DB_NAME = 'clikfinance-imports';
const STORE_NAME = 'handles';
const ROOT_HANDLE_KEY = 'device-import-root';
type FsPermissionMode = 'read' | 'readwrite';

type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor: { mode: FsPermissionMode }) => Promise<DeviceFolderPermission>;
  requestPermission?: (descriptor: { mode: FsPermissionMode }) => Promise<DeviceFolderPermission>;
};

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: FsPermissionMode }) => Promise<FileSystemDirectoryHandle>;
  };

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openDatabase();

  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = await callback(store);

    if (result instanceof IDBRequest) {
      return await new Promise<T>((resolve, reject) => {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error ?? new Error('Falha em IndexedDB'));
      });
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Transação abortada'));
    });

    return result;
  } finally {
    db.close();
  }
}

export function supportsDeviceFolderImport(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function loadStoredImportRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDeviceFolderImport()) {
    return null;
  }

  try {
    const result = await withStore('readonly', (store) => store.get(ROOT_HANDLE_KEY));
    return (result as FileSystemDirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveImportRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!supportsDeviceFolderImport()) {
    return;
  }

  await withStore('readwrite', (store) => {
    store.put(handle, ROOT_HANDLE_KEY);
    return Promise.resolve(undefined as unknown as void);
  });
}

export async function clearStoredImportRootHandle(): Promise<void> {
  if (!supportsDeviceFolderImport()) {
    return;
  }

  await withStore('readwrite', (store) => {
    store.delete(ROOT_HANDLE_KEY);
    return Promise.resolve(undefined as unknown as void);
  });
}

export async function pickImportRootDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!supportsDeviceFolderImport()) {
    throw new Error('Este navegador não suporta seleção de pasta local.');
  }

  const pickerWindow = window as DirectoryPickerWindow;
  if (typeof pickerWindow.showDirectoryPicker !== 'function') {
    throw new Error('Este navegador nao suporta selecao de pasta local.');
  }

  return await pickerWindow.showDirectoryPicker({ mode: 'readwrite' });
}

async function queryPermission(
  handle: FileSystemHandle,
  mode: FsPermissionMode
): Promise<DeviceFolderPermission> {
  const permissionHandle = handle as PermissionCapableHandle;
  if (typeof permissionHandle.queryPermission !== 'function') {
    return 'unknown';
  }

  return await permissionHandle.queryPermission({ mode });
}

async function requestPermission(
  handle: FileSystemHandle,
  mode: FsPermissionMode
): Promise<DeviceFolderPermission> {
  const permissionHandle = handle as PermissionCapableHandle;
  if (typeof permissionHandle.requestPermission !== 'function') {
    return 'unknown';
  }

  return await permissionHandle.requestPermission({ mode });
}

export async function getDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FsPermissionMode = 'readwrite'
): Promise<DeviceFolderPermission> {
  if (!supportsDeviceFolderImport()) {
    return 'unsupported';
  }

  return await queryPermission(handle, mode);
}

export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FsPermissionMode = 'readwrite'
): Promise<DeviceFolderPermission> {
  if (!supportsDeviceFolderImport()) {
    return 'unsupported';
  }

  const current = await queryPermission(handle, mode);
  if (current === 'granted') {
    return current;
  }

  return await requestPermission(handle, mode);
}

export async function ensureDeviceImportFolders(
  rootHandle: FileSystemDirectoryHandle
): Promise<DeviceImportFolders> {
  const inbox = await rootHandle.getDirectoryHandle('inbox', { create: true });
  const processed = await rootHandle.getDirectoryHandle('processed', { create: true });
  const error = await rootHandle.getDirectoryHandle('error', { create: true });
  const archive = await rootHandle.getDirectoryHandle('archive', { create: true });

  return {
    root: rootHandle,
    inbox,
    processed,
    error,
    archive,
  };
}

export async function listDeviceInboxFiles(
  rootHandle: FileSystemDirectoryHandle
): Promise<DeviceImportCandidate[]> {
  const folders = await ensureDeviceImportFolders(rootHandle);
  const entries: DeviceImportCandidate[] = [];

  const iterableInbox = folders.inbox as IterableDirectoryHandle;
  if (typeof iterableInbox.values !== 'function') {
    return entries;
  }

  for await (const entry of iterableInbox.values()) {
    if (entry.kind !== 'file') {
      continue;
    }

    const fileHandle = entry as FileSystemFileHandle;
    const normalizedName = fileHandle.name.toLowerCase();
    const isSupported =
      (normalizedName.endsWith('.xlsx') || normalizedName.endsWith('.xlsm')) &&
      !normalizedName.startsWith('~$');

    if (!isSupported) {
      continue;
    }

    const file = await fileHandle.getFile();
    entries.push({
      name: fileHandle.name,
      relativePath: `inbox/${fileHandle.name}`,
      size: file.size,
      lastModified: file.lastModified,
      handle: fileHandle,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function getUniqueFileHandle(
  folderHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<FileSystemFileHandle> {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : '';

  let candidate = fileName;
  let attempt = 1;

  while (true) {
    try {
      await folderHandle.getFileHandle(candidate);
      candidate = `${baseName}_${attempt}${extension}`;
      attempt += 1;
    } catch {
      return await folderHandle.getFileHandle(candidate, { create: true });
    }
  }
}

async function writeFileToHandle(targetHandle: FileSystemFileHandle, file: File): Promise<void> {
  const writable = await targetHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

export async function moveDeviceInboxFile(params: {
  rootHandle: FileSystemDirectoryHandle;
  fileHandle: FileSystemFileHandle;
  target: 'processed' | 'error';
  archive?: {
    kind: 'OPERATIONAL' | 'FINES' | 'FINANCIAL' | 'WORKBOOK' | 'UNKNOWN';
    archivePeriod: string | null;
  };
}): Promise<void> {
  const folders = await ensureDeviceImportFolders(params.rootHandle);
  const sourceFile = await params.fileHandle.getFile();
  const targetFolder = params.target === 'processed' ? folders.processed : folders.error;

  const processedHandle = await getUniqueFileHandle(targetFolder, sourceFile.name);
  await writeFileToHandle(processedHandle, sourceFile);

  if (params.target === 'processed' && params.archive) {
    const kindFolder = await folders.archive.getDirectoryHandle(
      params.archive.kind.toLowerCase(),
      { create: true }
    );
    const periodFolder = await kindFolder.getDirectoryHandle(
      params.archive.archivePeriod || 'sem-periodo',
      { create: true }
    );
    const archiveHandle = await getUniqueFileHandle(periodFolder, sourceFile.name);
    await writeFileToHandle(archiveHandle, sourceFile);
  }

  await folders.inbox.removeEntry(params.fileHandle.name);
}
