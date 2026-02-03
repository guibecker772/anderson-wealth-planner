/**
 * Mapeamento centralizado de status para pt-BR
 * Usado em todo o sistema para exibir labels traduzidos
 * 
 * IMPORTANTE: Não altera dados do banco, apenas a camada de apresentação
 */

// ============================================================================
// TIPOS
// ============================================================================

export type TransactionStatusKey = 'PENDING' | 'SETTLED' | 'OVERDUE' | 'CANCELLED' | 'SCHEDULED';
export type ProcessingStatusKey = 'PENDING' | 'PROCESSED' | 'ERROR' | 'PROCESSING';
export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'destructive' | 'default';

export interface StatusInfo {
  label: string;
  variant: BadgeVariant;
  description?: string;
}

// ============================================================================
// MAPEAMENTO DE STATUS DE TRANSAÇÃO (RECEITAS/DESPESAS)
// ============================================================================

export const transactionStatusMap: Record<TransactionStatusKey, StatusInfo> = {
  PENDING: {
    label: 'Pendente',
    variant: 'warning',
    description: 'Aguardando pagamento/recebimento',
  },
  SETTLED: {
    label: 'Quitado',
    variant: 'success',
    description: 'Pagamento/recebimento confirmado',
  },
  OVERDUE: {
    label: 'Vencido',
    variant: 'error',
    description: 'Prazo de pagamento expirado',
  },
  CANCELLED: {
    label: 'Cancelado',
    variant: 'neutral',
    description: 'Lançamento cancelado',
  },
  SCHEDULED: {
    label: 'Agendado',
    variant: 'info',
    description: 'Pagamento agendado para data futura',
  },
};

// ============================================================================
// MAPEAMENTO DE STATUS DE PROCESSAMENTO (IMPORTAÇÃO)
// ============================================================================

export const processingStatusMap: Record<ProcessingStatusKey, StatusInfo> = {
  PENDING: {
    label: 'Pendente',
    variant: 'warning',
    description: 'Aguardando processamento',
  },
  PROCESSING: {
    label: 'Processando',
    variant: 'info',
    description: 'Em processamento',
  },
  PROCESSED: {
    label: 'Processado',
    variant: 'success',
    description: 'Processamento concluído',
  },
  ERROR: {
    label: 'Erro',
    variant: 'error',
    description: 'Falha no processamento',
  },
};

// ============================================================================
// MAPEAMENTO DE TIPO DE TRANSAÇÃO
// ============================================================================

export const transactionTypeMap: Record<string, StatusInfo> = {
  PAYABLE: {
    label: 'A Pagar',
    variant: 'destructive',
    description: 'Contas a pagar (despesas)',
  },
  RECEIVABLE: {
    label: 'A Receber',
    variant: 'success',
    description: 'Contas a receber (receitas)',
  },
};

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém informações de status de transação traduzidas
 */
export function getTransactionStatusInfo(status: string | null | undefined): StatusInfo {
  if (!status) {
    return { label: 'Desconhecido', variant: 'neutral' };
  }
  
  const upperStatus = status.toUpperCase() as TransactionStatusKey;
  return transactionStatusMap[upperStatus] || { 
    label: status, 
    variant: 'neutral' 
  };
}

/**
 * Obtém informações de status de processamento traduzidas
 */
export function getProcessingStatusInfo(status: string | null | undefined): StatusInfo {
  if (!status) {
    return { label: 'Desconhecido', variant: 'neutral' };
  }
  
  const upperStatus = status.toUpperCase() as ProcessingStatusKey;
  return processingStatusMap[upperStatus] || { 
    label: status, 
    variant: 'neutral' 
  };
}

/**
 * Obtém informações de tipo de transação traduzidas
 */
export function getTransactionTypeInfo(type: string | null | undefined): StatusInfo {
  if (!type) {
    return { label: 'Desconhecido', variant: 'neutral' };
  }
  
  return transactionTypeMap[type.toUpperCase()] || { 
    label: type, 
    variant: 'neutral' 
  };
}

/**
 * Obtém apenas o label traduzido do status
 */
export function getStatusLabel(status: string | null | undefined): string {
  return getTransactionStatusInfo(status).label;
}

/**
 * Obtém apenas a variant do badge para o status
 */
export function getStatusVariant(status: string | null | undefined): BadgeVariant {
  return getTransactionStatusInfo(status).variant;
}

// ============================================================================
// OPÇÕES PARA SELECTS/FILTROS
// ============================================================================

export const transactionStatusOptions = [
  { value: 'ALL', label: 'Todos os Status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'SETTLED', label: 'Quitado' },
  { value: 'OVERDUE', label: 'Vencido' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'SCHEDULED', label: 'Agendado' },
];

export const processingStatusOptions = [
  { value: 'ALL', label: 'Todos os Status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'PROCESSED', label: 'Processado' },
  { value: 'ERROR', label: 'Erro' },
];

// ============================================================================
// TESTES SIMPLES (validação do mapping)
// ============================================================================

export function validateStatusMappings(): boolean {
  const testCases = [
    { input: 'PENDING', expectedLabel: 'Pendente' },
    { input: 'SETTLED', expectedLabel: 'Quitado' },
    { input: 'pending', expectedLabel: 'Pendente' }, // case insensitive
    { input: null, expectedLabel: 'Desconhecido' },
    { input: undefined, expectedLabel: 'Desconhecido' },
  ];
  
  for (const tc of testCases) {
    const result = getStatusLabel(tc.input);
    if (result !== tc.expectedLabel) {
      console.error(`Mapping falhou: ${tc.input} -> esperado "${tc.expectedLabel}", recebeu "${result}"`);
      return false;
    }
  }
  
  return true;
}
