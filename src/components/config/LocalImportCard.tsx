'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FolderOpen, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertTriangle,
  Inbox,
  FileCheck,
  FileX
} from 'lucide-react';

interface FolderStatus {
  exists: boolean;
  path: string;
  inboxCount: number;
  processedCount: number;
  errorCount: number;
  lastRun: string | null;
  lastFileName: string | null;
}

interface StatusResponse {
  ok: boolean;
  message: string;
  status: FolderStatus | null;
}

interface ImportResponse {
  ok: boolean;
  message: string;
  importedFiles: number;
  importedRows: number;
  skippedFiles: number;
  skippedRows: number;
  errors: { file: string; message: string }[];
}

export function LocalImportCard() {
  const [status, setStatus] = useState<FolderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/import/local/status');
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      if (!data.ok && data.message) {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (_err: unknown) {
      setMessage({ type: 'error', text: 'Erro ao buscar status' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/import/local/status', { method: 'POST' });
      const data = await res.json();
      
      if (data.ok) {
        setMessage({ type: 'success', text: data.message });
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (_err: unknown) {
      setMessage({ type: 'error', text: 'Erro ao testar conexão' });
    } finally {
      setTesting(false);
    }
  };

  const handleRunImport = async () => {
    setImporting(true);
    setMessage(null);
    setImportResult(null);
    
    try {
      // Pegar CRON_SECRET do localStorage ou usar query param
      // Em produção, isso deveria ser protegido de outra forma
      const secret = prompt('Digite o CRON_SECRET para autorizar a importação:');
      
      if (!secret) {
        setMessage({ type: 'info', text: 'Importação cancelada' });
        setImporting(false);
        return;
      }
      
      const res = await fetch(`/api/import/local?secret=${encodeURIComponent(secret)}`, {
        method: 'POST'
      });
      const data: ImportResponse = await res.json();
      
      setImportResult(data);
      
      if (data.ok) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
      
      await fetchStatus();
      
    } catch (_err: unknown) {
      setMessage({ type: 'error', text: 'Erro ao executar importação' });
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  return (
    <div className="border rounded-xl p-6 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-lg">Importação Local (Google Drive Desktop)</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Importa arquivos Excel (.xlsx) de uma pasta local sincronizada com Google Drive.
        Coloque os arquivos em <code className="bg-muted px-1 rounded">inbox/</code> dentro da pasta configurada.
      </p>
      
      {/* Status da Pasta */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Caminho Configurado:</span>
          <button onClick={fetchStatus} className="text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : status ? (
          <div className="space-y-2">
            <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
              {status.path}
            </code>
            
            <div className="flex items-center gap-2">
              {status.exists ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm ${status.exists ? 'text-green-600' : 'text-red-600'}`}>
                {status.exists ? 'Pasta encontrada' : 'Pasta não encontrada'}
              </span>
            </div>
            
            {status.exists && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <Inbox className="w-4 h-4 text-amber-600" />
                  <span className="text-muted-foreground">Inbox:</span>
                  <span className="font-medium">{status.inboxCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <FileCheck className="w-4 h-4 text-green-600" />
                  <span className="text-muted-foreground">Processados:</span>
                  <span className="font-medium">{status.processedCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <FileX className="w-4 h-4 text-red-600" />
                  <span className="text-muted-foreground">Erros:</span>
                  <span className="font-medium">{status.errorCount}</span>
                </div>
              </div>
            )}
            
            {status.lastRun && (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Última execução: {formatDate(status.lastRun)} — {status.lastFileName}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">LOCAL_IMPORT_FOLDER não configurado</span>
          </div>
        )}
      </div>
      
      {/* Mensagens */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {message.type === 'error' && <XCircle className="w-4 h-4" />}
          {message.type === 'info' && <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}
      
      {/* Resultado da Importação */}
      {importResult && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <div className="font-medium">Resultado da Importação:</div>
          <div className="grid grid-cols-2 gap-2">
            <div>Arquivos importados: <span className="font-bold text-green-600">{importResult.importedFiles}</span></div>
            <div>Arquivos pulados: <span className="font-bold text-amber-600">{importResult.skippedFiles}</span></div>
            <div>Transações novas: <span className="font-bold text-green-600">{importResult.importedRows}</span></div>
            <div>Transações puladas: <span className="font-bold text-amber-600">{importResult.skippedRows}</span></div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-red-600 font-medium">Erros:</div>
              <ul className="list-disc list-inside text-xs text-red-600">
                {importResult.errors.map((e, i) => (
                  <li key={i}>{e.file}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={testing || importing}
          className="flex-1"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Testar Conexão
        </Button>
        
        <Button 
          onClick={handleRunImport}
          disabled={testing || importing || !status?.exists}
          className="flex-1"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Executar Importação
        </Button>
      </div>
    </div>
  );
}
