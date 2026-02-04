'use client';

/**
 * Category Normalization Rules Management
 * 
 * CRUD interface for De/Para normalization rules
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/lib/components/layout/ui/badge';

// Types
interface NormalizationRule {
  id: string;
  fromPattern: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX';
  scope: 'EXPENSE' | 'INCOME' | 'BOTH';
  toCategory: string;
  priority: number;
  active: boolean;
  transactionCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  fromPattern: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX';
  scope: 'EXPENSE' | 'INCOME' | 'BOTH';
  toCategory: string;
  priority: number;
  active: boolean;
}

const DEFAULT_FORM: RuleFormData = {
  fromPattern: '',
  matchType: 'CONTAINS',
  scope: 'BOTH',
  toCategory: '',
  priority: 0,
  active: true,
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: 'Exato',
  CONTAINS: 'Contém',
  REGEX: 'Regex',
};

const SCOPE_LABELS: Record<string, string> = {
  EXPENSE: 'Despesas',
  INCOME: 'Receitas',
  BOTH: 'Ambos',
};

export function NormalizationRulesManager() {
  const [rules, setRules] = useState<NormalizationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NormalizationRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Expanded rows for mobile
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load rules
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories/normalization/rules');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar regras');
      }
      
      setRules(data.rules || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Form handlers
  const openCreateForm = () => {
    setEditingRule(null);
    setFormData(DEFAULT_FORM);
    setFormErrors([]);
    setIsFormOpen(true);
  };

  const openEditForm = (rule: NormalizationRule) => {
    setEditingRule(rule);
    setFormData({
      fromPattern: rule.fromPattern,
      matchType: rule.matchType,
      scope: rule.scope,
      toCategory: rule.toCategory,
      priority: rule.priority,
      active: rule.active,
    });
    setFormErrors([]);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRule(null);
    setFormData(DEFAULT_FORM);
    setFormErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);
    setSaving(true);

    try {
      const url = editingRule 
        ? `/api/categories/normalization/rules/${editingRule.id}`
        : '/api/categories/normalization/rules';
      
      const res = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setFormErrors(data.details || [data.error || 'Erro ao salvar']);
        return;
      }
      
      closeForm();
      loadRules();
    } catch (err) {
      setFormErrors([(err as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: NormalizationRule) => {
    if (!confirm(`Excluir regra "${rule.fromPattern}" → "${rule.toCategory}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/normalization/rules/${rule.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir');
      }
      
      loadRules();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleToggleActive = async (rule: NormalizationRule) => {
    try {
      const res = await fetch(`/api/categories/normalization/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao atualizar');
      }
      
      loadRules();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Render form modal
  const renderForm = () => {
    if (!isFormOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">
              {editingRule ? 'Editar Regra' : 'Nova Regra De/Para'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {formErrors.length > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
                <ul className="list-disc list-inside">
                  {formErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            
            {/* From Pattern */}
            <div>
              <label className="block text-sm font-medium mb-1">
                De (Padrão de busca) *
              </label>
              <input
                type="text"
                value={formData.fromPattern}
                onChange={e => setFormData(prev => ({ ...prev, fromPattern: e.target.value }))}
                placeholder="Ex: Energia Elétrica, CPFL, pgto energia..."
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Texto que será buscado no lançamento (fornecedor, descrição, categoria original)
              </p>
            </div>
            
            {/* Match Type */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo de Match
              </label>
              <select
                value={formData.matchType}
                onChange={e => setFormData(prev => ({ ...prev, matchType: e.target.value as RuleFormData['matchType'] }))}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="CONTAINS">Contém (substring)</option>
                <option value="EXACT">Exato (igualdade)</option>
                <option value="REGEX">Regex (avançado)</option>
              </select>
            </div>
            
            {/* To Category */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Para (Categoria normalizada) *
              </label>
              <input
                type="text"
                value={formData.toCategory}
                onChange={e => setFormData(prev => ({ ...prev, toCategory: e.target.value }))}
                placeholder="Ex: Energia Elétrica"
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            
            {/* Scope */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Escopo
              </label>
              <select
                value={formData.scope}
                onChange={e => setFormData(prev => ({ ...prev, scope: e.target.value as RuleFormData['scope'] }))}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="BOTH">Despesas e Receitas</option>
                <option value="EXPENSE">Apenas Despesas</option>
                <option value="INCOME">Apenas Receitas</option>
              </select>
            </div>
            
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Prioridade
              </label>
              <input
                type="number"
                value={formData.priority}
                onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maior prioridade ganha quando múltiplas regras casam (0 = padrão)
              </p>
            </div>
            
            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="active" className="text-sm">
                Regra ativa
              </label>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingRule ? 'Atualizar' : 'Criar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render content
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 rounded-lg text-red-600">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rules.length === 0 ? 'Nenhuma regra cadastrada' : `${rules.length} regra(s)`}
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </button>
      </div>
      
      {/* Rules list */}
      {rules.length > 0 && (
        <div className="border rounded-lg divide-y overflow-hidden">
          {rules.map(rule => (
            <div 
              key={rule.id} 
              className={`p-3 transition-colors ${rule.active ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-red-400 line-through truncate max-w-[150px]" title={rule.fromPattern}>
                      {rule.fromPattern}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-emerald-600 truncate max-w-[150px]" title={rule.toCategory}>
                      {rule.toCategory}
                    </span>
                  </div>
                  
                  {/* Badges - desktop */}
                  <div className="hidden md:flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {MATCH_TYPE_LABELS[rule.matchType]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {SCOPE_LABELS[rule.scope]}
                    </Badge>
                    {rule.priority > 0 && (
                      <Badge variant="accent" className="text-xs">
                        P{rule.priority}
                      </Badge>
                    )}
                    {rule.transactionCount !== undefined && rule.transactionCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {rule.transactionCount} lançamentos
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      rule.active 
                        ? 'text-emerald-600 hover:bg-emerald-500/10' 
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    title={rule.active ? 'Desativar' : 'Ativar'}
                  >
                    {rule.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditForm(rule)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {/* Mobile expand button */}
                  <button
                    onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors md:hidden"
                  >
                    {expandedId === rule.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Mobile expanded info */}
              {expandedId === rule.id && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t md:hidden">
                  <Badge variant="outline" className="text-xs">
                    {MATCH_TYPE_LABELS[rule.matchType]}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {SCOPE_LABELS[rule.scope]}
                  </Badge>
                  {rule.priority > 0 && (
                    <Badge variant="accent" className="text-xs">
                      P{rule.priority}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Empty state */}
      {rules.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Crie regras para mapear textos do Excel para categorias padronizadas
          </p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira regra
          </button>
        </div>
      )}
      
      {/* Form modal */}
      {renderForm()}
    </div>
  );
}
