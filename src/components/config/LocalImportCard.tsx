'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck,
  FileSpreadsheet,
  FileX,
  FolderOpen,
  Inbox,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  clearStoredImportRootHandle,
  ensureDeviceImportFolders,
  ensureDirectoryPermission,
  getDirectoryPermission,
  listDeviceInboxFiles,
  loadStoredImportRootHandle,
  moveDeviceInboxFile,
  pickImportRootDirectory,
  saveImportRootHandle,
  supportsDeviceFolderImport,
  type DeviceFolderPermission,
  type DeviceImportCandidate,
} from './deviceFolderAccess';

type EffectiveSourceMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD' | 'DEVICE_FOLDER';
type SourceFileKind = 'OPERATIONAL' | 'FINES' | 'FINANCIAL' | 'WORKBOOK' | 'UNKNOWN';
type SourceImportMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD';

interface ImportLogEntry {
  id: string;
  name: string;
  hash: string;
  status: 'PENDING' | 'PROCESSED' | 'ERROR';
  processedAt: string | Date | null;
  kind: SourceFileKind;
  importMode: SourceImportMode;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorCount: number;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
}

interface FolderStatus {
  configured: boolean;
  configSource: 'IMPORT_ROOT_FOLDER' | 'LOCAL_IMPORT_FOLDER' | 'UNCONFIGURED';
  requiresSecret: boolean;
  exists: boolean;
  path: string | null;
  folders: {
    root: string | null;
    inbox: string | null;
    processed: string | null;
    error: string | null;
    archive: string | null;
  };
  inboxCount: number;
  processedCount: number;
  errorCount: number;
  archiveCount: number;
  lastRun: string | Date | null;
  lastFileName: string | null;
  recentFiles: ImportLogEntry[];
}

interface StatusResponse {
  ok: boolean;
  message: string;
  status: FolderStatus | null;
}

interface ImportFileReport {
  file: string;
  hash: string;
  kind: SourceFileKind;
  importMode: SourceImportMode;
  effectiveSourceMode: EffectiveSourceMode;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorCount: number;
  archivePeriod: string | null;
  status: 'PROCESSED' | 'ERROR' | 'SKIPPED';
  message: string;
  warnings: string[];
}

interface ImportResponse {
  ok: boolean;
  message: string;
  importedFiles: number;
  importedRows: number;
  skippedFiles: number;
  skippedRows: number;
  errors: { file: string; message: string }[];
  files: ImportFileReport[];
}

interface LocalImportCardProps {
  initialStatus: FolderStatus | null;
  initialMessage?: { type: 'success' | 'error' | 'info'; text: string } | null;
}

export function LocalImportCard({ initialStatus, initialMessage = null }: LocalImportCardProps) {
  const [status, setStatus] = useState<FolderStatus | null>(initialStatus);
  const [secret, setSecret] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deviceWorking, setDeviceWorking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(initialMessage);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [deviceSupported, setDeviceSupported] = useState(false);
  const [deviceHandle, setDeviceHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [devicePermission, setDevicePermission] = useState<DeviceFolderPermission>('unknown');
  const [deviceInboxFiles, setDeviceInboxFiles] = useState<DeviceImportCandidate[]>([]);

  const recentErrors = useMemo(
    () => (status?.recentFiles || []).filter((file) => file.status === 'ERROR').slice(0, 3),
    [status]
  );

  const canUseAutomatic = Boolean(status?.configured && status.exists);
  const secretRequired = Boolean(status?.requiresSecret);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDeviceFolder() {
      const supported = supportsDeviceFolderImport();
      if (cancelled) return;

      setDeviceSupported(supported);
      if (!supported) {
        setDevicePermission('unsupported');
        return;
      }

      const storedHandle = await loadStoredImportRootHandle();
      if (cancelled) return;

      if (!storedHandle) {
        setDeviceHandle(null);
        setDevicePermission('prompt');
        setDeviceInboxFiles([]);
        return;
      }

      setDeviceHandle(storedHandle);
      const permission = await getDirectoryPermission(storedHandle);
      if (cancelled) return;

      setDevicePermission(permission);
      if (permission === 'granted') {
        try {
          await ensureDeviceImportFolders(storedHandle);
          const files = await listDeviceInboxFiles(storedHandle);
          if (!cancelled) {
            setDeviceInboxFiles(files);
          }
        } catch {
          if (!cancelled) {
            setDeviceInboxFiles([]);
          }
        }
      }
    }

    void bootstrapDeviceFolder();
    return () => {
      cancelled = true;
    };
  }, []);

  const authHeaders: Record<string, string> = secret ? { 'x-import-secret': secret } : {};

  const fetchStatus = async (options?: { silent?: boolean }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/import/local/status');
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      if (data.message && !options?.silent) {
        setMessage({ type: data.ok ? 'info' : 'error', text: data.message });
      }
    } catch {
      if (!options?.silent) {
        setMessage({ type: 'error', text: 'Erro ao buscar status da importacao' });
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshDeviceFolderState = async (options?: { silent?: boolean; requestPermission?: boolean }) => {
    if (!supportsDeviceFolderImport()) {
      setDeviceSupported(false);
      setDevicePermission('unsupported');
      setDeviceInboxFiles([]);
      return;
    }

    setDeviceSupported(true);
    const handle = deviceHandle || (await loadStoredImportRootHandle());

    if (!handle) {
      setDeviceHandle(null);
      setDevicePermission('prompt');
      setDeviceInboxFiles([]);
      if (!options?.silent) {
        setMessage({ type: 'info', text: 'Selecione uma pasta local desta maquina para habilitar a sincronizacao.' });
      }
      return;
    }

    setDeviceHandle(handle);
    const permission = options?.requestPermission
      ? await ensureDirectoryPermission(handle)
      : await getDirectoryPermission(handle);
    setDevicePermission(permission);

    if (permission !== 'granted') {
      setDeviceInboxFiles([]);
      if (!options?.silent) {
        setMessage({
          type: permission === 'denied' ? 'error' : 'info',
          text:
            permission === 'denied'
              ? 'A pasta local desta maquina perdeu permissao de acesso.'
              : 'Permita o acesso a pasta local para validar e sincronizar.',
        });
      }
      return;
    }

    await ensureDeviceImportFolders(handle);
    const files = await listDeviceInboxFiles(handle);
    setDeviceInboxFiles(files);

    if (!options?.silent) {
      setMessage({
        type: 'success',
        text: `Pasta local validada. ${files.length} arquivo(s) suportado(s) em inbox/.`,
      });
    }
  };

  const handlePickDeviceFolder = async () => {
    setDeviceWorking(true);
    setMessage(null);

    try {
      const handle = await pickImportRootDirectory();
      await saveImportRootHandle(handle);
      setDeviceHandle(handle);
      await refreshDeviceFolderState({ requestPermission: true, silent: false });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Nao foi possivel selecionar a pasta local.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setDeviceWorking(false);
    }
  };

  const handleForgetDeviceFolder = async () => {
    setDeviceWorking(true);
    try {
      await clearStoredImportRootHandle();
      setDeviceHandle(null);
      setDevicePermission(deviceSupported ? 'prompt' : 'unsupported');
      setDeviceInboxFiles([]);
      setMessage({ type: 'info', text: 'A pasta local desta maquina foi esquecida neste navegador.' });
    } catch {
      setMessage({ type: 'error', text: 'Nao foi possivel limpar a pasta local salva.' });
    } finally {
      setDeviceWorking(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/import/local/status', { method: 'POST' });
      const data = await res.json();
      setStatus(data.status ?? null);
      setMessage({ type: data.ok ? 'success' : 'error', text: data.message });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao validar a raiz automatica do servidor' });
    } finally {
      setTesting(false);
    }
  };

  const handleRunImport = async () => {
    setImporting(true);
    setMessage(null);
    setImportResult(null);

    try {
      const res = await fetch('/api/import/local', {
        method: 'POST',
        headers: authHeaders,
      });
      const data: ImportResponse = await res.json();
      setImportResult(data);
      setMessage({ type: data.ok ? 'success' : 'error', text: data.message });
      await fetchStatus({ silent: true });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao executar a importacao automatica do servidor' });
    } finally {
      setImporting(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setMessage({ type: 'info', text: 'Selecione pelo menos um arquivo .xlsx ou .xlsm.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('files', file));
      if (secret) {
        formData.append('secret', secret);
      }
      formData.append('sourceMode', 'MANUAL_UPLOAD');

      const res = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
      });

      const data: ImportResponse = await res.json();
      setImportResult(data);
      setMessage({ type: data.ok ? 'success' : 'error', text: data.message });
      if (data.ok) {
        setSelectedFiles([]);
      }
      await fetchStatus({ silent: true });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao processar upload manual' });
    } finally {
      setUploading(false);
    }
  };

  const handleSyncDeviceFolder = async () => {
    if (!deviceHandle) {
      setMessage({ type: 'info', text: 'Selecione primeiro uma pasta local desta maquina.' });
      return;
    }

    setDeviceWorking(true);
    setMessage(null);
    setImportResult(null);

    try {
      await refreshDeviceFolderState({ requestPermission: true, silent: true });

      const files = await listDeviceInboxFiles(deviceHandle);
      setDeviceInboxFiles(files);

      if (files.length === 0) {
        setMessage({ type: 'info', text: 'Nenhum arquivo suportado encontrado em inbox/ na pasta desta maquina.' });
        return;
      }

      const aggregate: ImportResponse = {
        ok: true,
        message: '',
        importedFiles: 0,
        importedRows: 0,
        skippedFiles: 0,
        skippedRows: 0,
        errors: [],
        files: [],
      };

      for (const candidate of files) {
        const file = await candidate.handle.getFile();
        const formData = new FormData();
        formData.append('files', file);
        if (secret) {
          formData.append('secret', secret);
        }
        formData.append('sourceMode', 'DEVICE_FOLDER');
        formData.append('rootLabel', deviceHandle.name);
        formData.append('relativePath', candidate.relativePath);

        const res = await fetch('/api/import/upload', {
          method: 'POST',
          body: formData,
        });

        const data: ImportResponse = await res.json();
        const fileReport = data.files[0];

        aggregate.ok = aggregate.ok && data.ok;
        aggregate.files.push(...data.files);
        aggregate.errors.push(...data.errors);
        aggregate.importedFiles += data.importedFiles;
        aggregate.importedRows += data.importedRows;
        aggregate.skippedFiles += data.skippedFiles;
        aggregate.skippedRows += data.skippedRows;

        if (fileReport) {
          await moveDeviceInboxFile({
            rootHandle: deviceHandle,
            fileHandle: candidate.handle,
            target: fileReport.status === 'ERROR' ? 'error' : 'processed',
            archive:
              fileReport.status === 'ERROR'
                ? undefined
                : {
                    kind: fileReport.kind,
                    archivePeriod: fileReport.archivePeriod,
                  },
          });
        }
      }

      aggregate.message = aggregate.ok
        ? `Sincronizacao local concluida: ${aggregate.importedFiles} arquivo(s) importado(s), ${aggregate.skippedFiles} ignorado(s).`
        : 'Sincronizacao local concluida com erros.';

      setImportResult(aggregate);
      setMessage({ type: aggregate.ok ? 'success' : 'error', text: aggregate.message });
      await refreshDeviceFolderState({ silent: true });
      await fetchStatus({ silent: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao sincronizar a pasta local desta maquina.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setDeviceWorking(false);
    }
  };

  const formatDate = (value: string | Date | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
  };

  const formatMode = (mode: EffectiveSourceMode) => {
    if (mode === 'DEVICE_FOLDER') return 'Pasta desta maquina';
    if (mode === 'AUTO_FOLDER') return 'Pasta global do servidor';
    return 'Upload manual';
  };

  const resolveFileMode = (file: {
    importMode: SourceImportMode;
    details?: Record<string, unknown> | null;
  }): EffectiveSourceMode => {
    const detailMode = typeof file.details?.effectiveSourceMode === 'string' ? file.details.effectiveSourceMode : null;
    if (detailMode === 'DEVICE_FOLDER' || detailMode === 'AUTO_FOLDER' || detailMode === 'MANUAL_UPLOAD') {
      return detailMode;
    }

    return file.importMode;
  };

  const kindLabel = (kind: SourceFileKind) => {
    if (kind === 'OPERATIONAL') return 'Operacional';
    if (kind === 'FINES') return 'Infracoes';
    if (kind === 'FINANCIAL') return 'Financeiro';
    if (kind === 'WORKBOOK') return 'Workbook';
    return 'Nao identificado';
  };

  const statusLabel = (fileStatus: ImportLogEntry['status'] | ImportFileReport['status']) => {
    if (fileStatus === 'PROCESSED') return 'Processado';
    if (fileStatus === 'ERROR') return 'Erro';
    if (fileStatus === 'SKIPPED') return 'Ignorado';
    return 'Pendente';
  };

  return (
    <div className="border rounded-xl p-6 bg-card space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Central de Importacao</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            O sistema web principal pode importar por pasta local desta maquina, por upload manual e, quando existir,
            pela pasta global do servidor. Todos os modos usam a mesma validacao, a mesma deduplicacao e gravam no banco como fonte oficial.
          </p>
        </div>

        {secretRequired ? (
          <div className="w-full lg:w-[280px] space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Autorizacao local
            </label>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="CRON_SECRET"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Se o ambiente exigir <code>CRON_SECRET</code>, informe a chave aqui.
            </p>
          </div>
        ) : (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 self-start">
            Rotas de importacao liberadas sem chave adicional neste ambiente.
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 border rounded-xl p-5 bg-muted/20">
          <div>
            <p className="text-sm font-semibold text-foreground">Pasta local desta maquina</p>
            <p className="text-xs text-muted-foreground mt-1">
              Modo principal em navegadores Chromium desktop. A preferencia da pasta fica salva apenas neste navegador e nesta maquina.
            </p>
          </div>

          <InfoRow label="Suporte do navegador" value={deviceSupported ? 'Disponivel' : 'Use upload manual'} />
          <InfoRow label="Pasta selecionada" value={deviceHandle?.name || 'Nenhuma pasta local selecionada'} />
          <InfoRow label="Permissao" value={permissionLabel(devicePermission)} />
          <InfoRow label="Arquivos em inbox/" value={`${deviceInboxFiles.length} arquivo(s) suportado(s)`} />

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handlePickDeviceFolder} disabled={deviceWorking || !deviceSupported}>
              {deviceWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
              Selecionar pasta
            </Button>
            <Button variant="outline" onClick={() => { void refreshDeviceFolderState({ requestPermission: true }); }} disabled={deviceWorking || !deviceSupported}>
              {deviceWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Validar estrutura
            </Button>
            <Button onClick={handleSyncDeviceFolder} disabled={deviceWorking || !deviceHandle || !deviceSupported}>
              {deviceWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Sincronizar agora
            </Button>
            <Button variant="outline" onClick={handleForgetDeviceFolder} disabled={deviceWorking || !deviceHandle}>
              Esquecer pasta
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Arquivos detectados em inbox/ desta maquina</p>
            {deviceInboxFiles.length > 0 ? (
              <div className="space-y-2">
                {deviceInboxFiles.slice(0, 6).map((file) => (
                  <div key={file.relativePath} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{formatBytes(file.size)}</span>
                  </div>
                ))}
                {deviceInboxFiles.length > 6 ? (
                  <p className="text-xs text-muted-foreground">+ {deviceInboxFiles.length - 6} arquivo(s) adicionais</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {deviceSupported
                  ? 'Nenhum arquivo local detectado em inbox/ ainda.'
                  : 'Seu navegador nao suporta selecao de pasta local. Use o upload manual abaixo.'}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 border rounded-xl p-5 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Pasta global do servidor</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modo de compatibilidade baseado em <code>IMPORT_ROOT_FOLDER</code> ou <code>LOCAL_IMPORT_FOLDER</code>.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void fetchStatus(); }} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-3">
            <PathRow label="Raiz configurada" value={status?.folders.root ?? 'Nao configurada'} ok={Boolean(status?.configured)} />
            <PathRow label="Inbox" value={status?.folders.inbox ?? '-'} ok={Boolean(status?.exists)} extra={`${status?.inboxCount ?? 0} arquivo(s)`} />
            <PathRow label="Processed" value={status?.folders.processed ?? '-'} ok={Boolean(status?.exists)} extra={`${status?.processedCount ?? 0} arquivo(s)`} />
            <PathRow label="Error" value={status?.folders.error ?? '-'} ok={Boolean(status?.exists)} extra={`${status?.errorCount ?? 0} arquivo(s)`} />
            <PathRow label="Archive" value={status?.folders.archive ?? '-'} ok={Boolean(status?.exists)} extra={`${status?.archiveCount ?? 0} arquivo(s)`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-3">
            <FolderMetric label="Inbox" value={status?.inboxCount ?? 0} icon={<Inbox className="w-4 h-4 text-amber-600" />} />
            <FolderMetric label="Processados" value={status?.processedCount ?? 0} icon={<FileCheck className="w-4 h-4 text-emerald-600" />} />
            <FolderMetric label="Erros" value={status?.errorCount ?? 0} icon={<FileX className="w-4 h-4 text-red-600" />} />
            <FolderMetric label="Arquivo" value={status?.archiveCount ?? 0} icon={<Archive className="w-4 h-4 text-sky-600" />} />
          </div>

          <div className="text-xs text-muted-foreground">
            Ultima atividade: {formatDate(status?.lastRun ?? null)} {status?.lastFileName ? `- ${status.lastFileName}` : ''}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing || importing}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Validar estrutura
            </Button>
            <Button onClick={handleRunImport} disabled={testing || importing || !canUseAutomatic}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Processar inbox
            </Button>
          </div>

          {!status?.configured && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              Configure <code>IMPORT_ROOT_FOLDER</code> ou <code>LOCAL_IMPORT_FOLDER</code> se quiser manter o modo do servidor.
            </div>
          )}
        </div>

        <div className="space-y-4 border rounded-xl p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Upload manual de arquivo</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fallback universal para qualquer computador, mesmo sem suporte a pasta local. Aceita <code>.xlsx</code> e <code>.xlsm</code> e usa a mesma pipeline do backend.
            </p>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
            <input
              type="file"
              accept=".xlsx,.xlsm"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
              className="block w-full text-sm"
            />
            <div className="text-sm">
              {selectedFiles.length > 0 ? (
                <span className="font-medium">{selectedFiles.length} arquivo(s) selecionado(s)</span>
              ) : (
                <span className="text-muted-foreground">Nenhum arquivo selecionado</span>
              )}
            </div>
            <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Validar e importar
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Regras ativas desta central</p>
            <p>A aba principal operacional prioriza <code>planilha teste carros</code>.</p>
            <p><code>Dashboard</code> e <code>Planilha4</code> sao ignoradas como fonte bruta.</p>
            <p>O relatorio de infracoes prioriza <code>Pagina1</code> e variantes equivalentes.</p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {message.type === 'error' && <XCircle className="w-4 h-4" />}
          {message.type === 'info' && <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {importResult && (
        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Arquivos importados: <strong className="text-emerald-700">{importResult.importedFiles}</strong></span>
            <span>Arquivos ignorados: <strong className="text-amber-700">{importResult.skippedFiles}</strong></span>
            <span>Linhas novas: <strong className="text-emerald-700">{importResult.importedRows}</strong></span>
            <span>Linhas ignoradas: <strong className="text-amber-700">{importResult.skippedRows}</strong></span>
          </div>

          <div className="space-y-2">
            {importResult.files.map((file) => (
              <div key={`${file.file}-${file.hash}-${file.effectiveSourceMode}`} className="rounded-lg border bg-background p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-sm">{file.file}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel(file.kind)} - {formatMode(file.effectiveSourceMode)} - hash {file.hash ? `${file.hash.slice(0, 12)}...` : '-'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${
                    file.status === 'PROCESSED'
                      ? 'text-emerald-700'
                      : file.status === 'ERROR'
                        ? 'text-red-700'
                        : 'text-amber-700'
                  }`}>
                    {statusLabel(file.status)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Lidas: {file.totalRows} - Importadas: {file.importedRows} - Ignoradas: {file.skippedRows} - Erros: {file.errorCount}
                </p>
                {file.archivePeriod ? (
                  <p className="text-xs text-muted-foreground mt-1">Periodo de arquivo: {file.archivePeriod}</p>
                ) : null}
                <p className="text-xs mt-1">{file.message}</p>
                {file.warnings.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-xs text-amber-700">
                    {file.warnings.slice(0, 4).map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {importResult.errors.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-red-700">Erros encontrados</p>
              <ul className="list-disc list-inside text-xs text-red-700 mt-1">
                {importResult.errors.map((error, index) => (
                  <li key={`${error.file}-${index}`}>{error.file}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-semibold">Ultimos arquivos importados</h4>
        </div>

        <div className="grid gap-3">
          {(status?.recentFiles || []).map((file) => {
            const effectiveMode = resolveFileMode(file);
            return (
              <div key={file.id} className="rounded-xl border p-4 bg-background">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#A8CF4C]" />
                      <span className="font-medium text-sm">{file.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel(file.kind)} - {formatMode(effectiveMode)} - {formatDate(file.processedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">Hash: {file.hash.slice(0, 16)}...</p>
                  </div>

                  <div className="text-right text-xs space-y-1">
                    <p className={
                      file.status === 'PROCESSED'
                        ? 'text-emerald-700'
                        : file.status === 'ERROR'
                          ? 'text-red-700'
                          : 'text-amber-700'
                    }>
                      {statusLabel(file.status)}
                    </p>
                    <p className="text-muted-foreground">
                      Lidas {file.totalRows} - Importadas {file.importedRows} - Ignoradas {file.skippedRows}
                    </p>
                    <p className="text-muted-foreground">Erros {file.errorCount}</p>
                  </div>
                </div>

                {file.errorMessage && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {file.errorMessage}
                  </div>
                )}
              </div>
            );
          })}

          {(status?.recentFiles || []).length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground text-center">
              Nenhum arquivo importado ainda.
            </div>
          )}
        </div>
      </div>

      {recentErrors.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-red-700">Ultimos erros objetivos</h4>
          {recentErrors.map((file) => (
            <div key={`${file.id}-error`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <strong>{file.name}</strong>: {file.errorMessage || 'Falha sem mensagem adicional'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function permissionLabel(permission: DeviceFolderPermission): string {
  switch (permission) {
    case 'granted':
      return 'Liberada';
    case 'prompt':
      return 'Precisa autorizar';
    case 'denied':
      return 'Negada';
    case 'unsupported':
      return 'Nao suportada';
    default:
      return 'Indefinida';
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function PathRow({
  label,
  value,
  ok,
  extra,
}: {
  label: string;
  value: string;
  ok: boolean;
  extra?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <code className="text-xs break-all">{value}</code>
        </div>
        <div className="text-right">
          {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" /> : <XCircle className="w-4 h-4 text-red-600 ml-auto" />}
          {extra ? <p className="text-xs text-muted-foreground mt-1">{extra}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FolderMetric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold mt-1">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm mt-1 break-all">{value}</p>
    </div>
  );
}
