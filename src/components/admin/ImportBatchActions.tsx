'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ImportBatchActionsProps {
  batchId: string;
  canPublish: boolean;
  canReprocess: boolean;
}

export function ImportBatchActions({ batchId, canPublish, canReprocess }: ImportBatchActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<'publish' | 'reprocess' | null>(null);

  async function runAction(action: 'publish' | 'reprocess') {
    setLoadingAction(action);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/imports/${batchId}/${action}`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Falha ao executar acao');
      }

      setMessage({ type: 'success', text: payload.message || 'Acao executada com sucesso' });
      startTransition(() => router.refresh());
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao executar acao',
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => runAction('publish')}
          disabled={!canPublish || isPending || loadingAction != null}
          className="rounded-full bg-[#022D44] px-4 text-white hover:bg-[#033b5a]"
        >
          {loadingAction === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Publicar lote
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => runAction('reprocess')}
          disabled={!canReprocess || isPending || loadingAction != null}
          className="rounded-full border-slate-200 bg-white/90 px-4"
        >
          {loadingAction === 'reprocess' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reprocessar publicacao
        </Button>
      </div>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
