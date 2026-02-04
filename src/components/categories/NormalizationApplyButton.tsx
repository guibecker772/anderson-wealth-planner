'use client';

/**
 * Normalization Apply Modal
 * 
 * Preview and apply normalization rules to existing transactions
 */

import { useState } from 'react';
import { 
  PlayCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  ArrowRight,
  X,
} from 'lucide-react';
import { Badge } from '@/lib/components/layout/ui/badge';

interface PreviewResult {
  eligibleCount: number;
  wouldUpdateCount: number;
  byRuleCount: { ruleId: string; fromPattern: string; toCategory: string; count: number }[];
  sample: {
    transactionId: string;
    rawLabel: string | null;
    currentCategory: string | null;
    newCategory: string | null;
    ruleId: string | null;
    ruleName: string | null;
  }[];
}

interface ApplyResult {
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  byRuleCount: { ruleId: string; fromPattern: string; toCategory: string; count: number }[];
  dryRun: boolean;
}

export function NormalizationApplyButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'config' | 'preview' | 'result'>('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Config state
  const [scope, setScope] = useState<'BOTH' | 'EXPENSE' | 'INCOME'>('BOTH');
  const [onlyUncategorized, setOnlyUncategorized] = useState(true);
  
  // Results
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const handleOpen = () => {
    setIsOpen(true);
    setStep('config');
    setError(null);
    setPreviewResult(null);
    setApplyResult(null);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories/normalization/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          onlyUncategorized,
          sampleLimit: 10,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar preview');
      }

      setPreviewResult(data);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories/normalization/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          onlyUncategorized,
          dryRun: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao aplicar regras');
      }

      setApplyResult(data);
      setStep('result');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const renderConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Escopo</label>
        <select
          value={scope}
          onChange={e => setScope(e.target.value as typeof scope)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="BOTH">Despesas e Receitas</option>
          <option value="EXPENSE">Apenas Despesas</option>
          <option value="INCOME">Apenas Receitas</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="onlyUncategorized"
          checked={onlyUncategorized}
          onChange={e => setOnlyUncategorized(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="onlyUncategorized" className="text-sm">
          Apenas lançamentos sem categoria ou com categoria RAW
        </label>
      </div>
      
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 text-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Importante</p>
            <p className="mt-1">
              Lançamentos categorizados manualmente (MANUAL) nunca serão alterados.
              Esta ação é idempotente e pode ser executada múltiplas vezes sem duplicação.
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}
      
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleClose}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handlePreview}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Ver Preview
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!previewResult) return null;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{previewResult.eligibleCount}</div>
            <div className="text-sm text-muted-foreground">Lançamentos elegíveis</div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">{previewResult.wouldUpdateCount}</div>
            <div className="text-sm text-muted-foreground">Serão atualizados</div>
          </div>
        </div>
        
        {/* Top rules */}
        {previewResult.byRuleCount.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Regras que serão aplicadas</h4>
            <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
              {previewResult.byRuleCount.slice(0, 5).map((rc, i) => (
                <div key={i} className="p-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-red-400 truncate max-w-[100px]" title={rc.fromPattern}>
                      {rc.fromPattern}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-emerald-600 truncate max-w-[100px]" title={rc.toCategory}>
                      {rc.toCategory}
                    </span>
                  </div>
                  <Badge variant="accent">{rc.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Sample */}
        {previewResult.sample.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Amostra de lançamentos</h4>
            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto text-sm">
              {previewResult.sample.map((s, i) => (
                <div key={i} className="p-2">
                  <div className="text-xs text-muted-foreground truncate" title={s.rawLabel || ''}>
                    {s.rawLabel || '(sem rawLabel)'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-red-400">{s.currentCategory || 'Sem Categoria'}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-emerald-600 font-medium">{s.newCategory}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {previewResult.wouldUpdateCount === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            Nenhum lançamento será atualizado com as regras atuais.
          </div>
        )}
        
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setStep('config')}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleApply}
            disabled={loading || previewResult.wouldUpdateCount === 0}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Aplicar {previewResult.wouldUpdateCount} atualizações
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!applyResult) return null;

    return (
      <div className="space-y-4">
        {/* Success message */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Normalização concluída!</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-600">{applyResult.updatedCount}</div>
            <div className="text-xs text-muted-foreground">Atualizados</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold">{applyResult.skippedCount}</div>
            <div className="text-xs text-muted-foreground">Ignorados</div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{applyResult.errorsCount}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
        </div>
        
        {/* Top rules applied */}
        {applyResult.byRuleCount.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Regras aplicadas</h4>
            <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
              {applyResult.byRuleCount.slice(0, 5).map((rc, i) => (
                <div key={i} className="p-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-red-400 truncate max-w-[100px]">{rc.fromPattern}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-emerald-600 truncate max-w-[100px]">{rc.toCategory}</span>
                  </div>
                  <Badge variant="accent">{rc.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-500 text-emerald-600 text-sm rounded-lg hover:bg-emerald-500/10 transition-colors"
      >
        <PlayCircle className="w-4 h-4" />
        Aplicar regras agora
      </button>
    );
  }

  return (
    <>
      {/* Trigger button (hidden when modal is open) */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-500 text-emerald-600 text-sm rounded-lg hover:bg-emerald-500/10 transition-colors"
      >
        <PlayCircle className="w-4 h-4" />
        Aplicar regras agora
      </button>
      
      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {step === 'config' && 'Aplicar Regras de Normalização'}
              {step === 'preview' && 'Preview das Alterações'}
              {step === 'result' && 'Resultado'}
            </h3>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6">
            {step === 'config' && renderConfig()}
            {step === 'preview' && renderPreview()}
            {step === 'result' && renderResult()}
          </div>
        </div>
      </div>
    </>
  );
}
