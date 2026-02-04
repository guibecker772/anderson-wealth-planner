import { db } from '@/lib/db';

/**
 * Checks if the database is reachable
 */
export async function isDbAvailable(): Promise<boolean> {
  // Se DATABASE_URL não existe, nem tenta conectar
  if (!process.env.DATABASE_URL) {
    return false;
  }
  
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn('[db-safe] Database not available:', (error as Error).message);
    return false;
  }
}

/**
 * Check if mock mode is enabled via environment variable
 */
export function shouldUseMockData(): boolean {
  return process.env.USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;
}

// =========================================
// MOCK DATA
// =========================================

export interface MockTransaction {
  id: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  status: 'PENDING' | 'SETTLED';
  dueDate: string;
  actualDate: string | null;
  plannedAmount: number;
  actualAmount: number | null;
  category: string;
  counterparty: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const today = new Date();
const formatDate = (d: Date) => d.toISOString().split('T')[0];

// Generate dates relative to today
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return formatDate(d);
};

const daysAhead = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return formatDate(d);
};

export const mockTransactions: MockTransaction[] = [
  // RECEIVABLE - Settled
  { id: 'mock-1', type: 'RECEIVABLE', status: 'SETTLED', dueDate: daysAgo(15), actualDate: daysAgo(14), plannedAmount: 15000.00, actualAmount: 15000.00, category: 'Vendas', counterparty: 'Cliente A', description: 'Fatura #001', createdAt: daysAgo(30), updatedAt: daysAgo(14) },
  { id: 'mock-6', type: 'RECEIVABLE', status: 'SETTLED', dueDate: daysAgo(22), actualDate: daysAgo(21), plannedAmount: 12500.00, actualAmount: 12350.00, category: 'Vendas', counterparty: 'Cliente C', description: 'Fatura #002', createdAt: daysAgo(40), updatedAt: daysAgo(21) },
  { id: 'mock-10', type: 'RECEIVABLE', status: 'SETTLED', dueDate: daysAgo(8), actualDate: daysAgo(8), plannedAmount: 6500.00, actualAmount: 6500.00, category: 'Vendas', counterparty: 'Cliente E', description: 'Fatura #003', createdAt: daysAgo(20), updatedAt: daysAgo(8) },
  { id: 'mock-14', type: 'RECEIVABLE', status: 'SETTLED', dueDate: daysAgo(45), actualDate: daysAgo(44), plannedAmount: 18200.00, actualAmount: 18200.00, category: 'Serviços', counterparty: 'Cliente F', description: 'Consultoria Dez', createdAt: daysAgo(60), updatedAt: daysAgo(44) },
  
  // RECEIVABLE - Pending
  { id: 'mock-3', type: 'RECEIVABLE', status: 'PENDING', dueDate: daysAhead(5), actualDate: null, plannedAmount: 8200.00, actualAmount: null, category: 'Serviços', counterparty: 'Cliente B', description: 'Consultoria Jan', createdAt: daysAgo(10), updatedAt: daysAgo(10) },
  { id: 'mock-8', type: 'RECEIVABLE', status: 'PENDING', dueDate: daysAhead(10), actualDate: null, plannedAmount: 9800.00, actualAmount: null, category: 'Serviços', counterparty: 'Cliente D', description: 'Projeto #15', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
  { id: 'mock-15', type: 'RECEIVABLE', status: 'PENDING', dueDate: daysAhead(15), actualDate: null, plannedAmount: 22000.00, actualAmount: null, category: 'Vendas', counterparty: 'Cliente G', description: 'Pedido grande', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  
  // PAYABLE - Settled
  { id: 'mock-2', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(20), actualDate: daysAgo(20), plannedAmount: 3500.00, actualAmount: 3500.00, category: 'Aluguel', counterparty: 'Imobiliária XYZ', description: 'Aluguel Janeiro', createdAt: daysAgo(35), updatedAt: daysAgo(20) },
  { id: 'mock-5', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(25), actualDate: daysAgo(25), plannedAmount: 25000.00, actualAmount: 25000.00, category: 'Salários', counterparty: 'Folha', description: 'Salários Dezembro', createdAt: daysAgo(30), updatedAt: daysAgo(25) },
  { id: 'mock-9', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(18), actualDate: daysAgo(18), plannedAmount: 1200.00, actualAmount: 1180.00, category: 'Utilidades', counterparty: 'Energia Elétrica', description: 'Conta de luz', createdAt: daysAgo(25), updatedAt: daysAgo(18) },
  { id: 'mock-11', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(12), actualDate: daysAgo(12), plannedAmount: 850.00, actualAmount: 850.00, category: 'Utilidades', counterparty: 'Água e Esgoto', description: 'Conta de água', createdAt: daysAgo(20), updatedAt: daysAgo(12) },
  { id: 'mock-12', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(30), actualDate: daysAgo(29), plannedAmount: 4500.00, actualAmount: 4500.00, category: 'Combustível', counterparty: 'Posto Shell', description: 'Combustível Dez', createdAt: daysAgo(45), updatedAt: daysAgo(29) },
  { id: 'mock-16', type: 'PAYABLE', status: 'SETTLED', dueDate: daysAgo(35), actualDate: daysAgo(34), plannedAmount: 2800.00, actualAmount: 2800.00, category: 'Impostos', counterparty: 'Receita Federal', description: 'DAS Simples', createdAt: daysAgo(50), updatedAt: daysAgo(34) },
  
  // PAYABLE - Pending
  { id: 'mock-4', type: 'PAYABLE', status: 'PENDING', dueDate: daysAhead(2), actualDate: null, plannedAmount: 2800.00, actualAmount: null, category: 'Combustível', counterparty: 'Posto Shell', description: 'Abastecimento frota', createdAt: daysAgo(7), updatedAt: daysAgo(7) },
  { id: 'mock-7', type: 'PAYABLE', status: 'PENDING', dueDate: daysAhead(8), actualDate: null, plannedAmount: 4500.00, actualAmount: null, category: 'Manutenção', counterparty: 'Oficina Central', description: 'Revisão veículos', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
  { id: 'mock-13', type: 'PAYABLE', status: 'PENDING', dueDate: daysAhead(12), actualDate: null, plannedAmount: 3500.00, actualAmount: null, category: 'Aluguel', counterparty: 'Imobiliária XYZ', description: 'Aluguel Fevereiro', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  
  // Overdue PAYABLE (vencido)
  { id: 'mock-17', type: 'PAYABLE', status: 'PENDING', dueDate: daysAgo(3), actualDate: null, plannedAmount: 1500.00, actualAmount: null, category: 'Fornecedores', counterparty: 'Fornecedor X', description: 'NF atrasada', createdAt: daysAgo(15), updatedAt: daysAgo(15) },
];

export interface TransactionFilters {
  type?: 'PAYABLE' | 'RECEIVABLE';
  status?: 'PENDING' | 'SETTLED';
  category?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Get mock transactions with filtering and pagination
 */
export function getMockTransactions(filters: TransactionFilters = {}) {
  const { type, status, category, from, to, q, page = 1, pageSize = 20 } = filters;

  let filtered = [...mockTransactions];

  if (type) {
    filtered = filtered.filter(t => t.type === type);
  }
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }
  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }
  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(t =>
      t.description?.toLowerCase().includes(query) ||
      t.counterparty?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query)
    );
  }
  if (from) {
    filtered = filtered.filter(t => new Date(t.dueDate) >= new Date(from));
  }
  if (to) {
    filtered = filtered.filter(t => new Date(t.dueDate) <= new Date(to));
  }

  // Sort by dueDate descending
  filtered.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages
    },
    warning: 'DB_OFFLINE' as const
  };
}

export interface MetricsFilters {
  from?: Date;
  to?: Date;
}

/**
 * Get mock metrics calculated from mock transactions
 */
export function getMockMetrics(filters: MetricsFilters = {}) {
  const { from, to } = filters;
  const now = new Date();
  const startDate = from || new Date(now.getFullYear(), 0, 1);
  const endDate = to || now;

  // Filter settled transactions in date range
  const settledReceivables = mockTransactions.filter(t => 
    t.type === 'RECEIVABLE' && 
    t.status === 'SETTLED' && 
    t.actualDate &&
    new Date(t.actualDate) >= startDate &&
    new Date(t.actualDate) <= endDate
  );

  const settledPayables = mockTransactions.filter(t => 
    t.type === 'PAYABLE' && 
    t.status === 'SETTLED' && 
    t.actualDate &&
    new Date(t.actualDate) >= startDate &&
    new Date(t.actualDate) <= endDate
  );

  const pendingReceivables = mockTransactions.filter(t => 
    t.type === 'RECEIVABLE' && 
    t.status === 'PENDING' &&
    new Date(t.dueDate) >= startDate &&
    new Date(t.dueDate) <= endDate
  );

  const pendingPayables = mockTransactions.filter(t => 
    t.type === 'PAYABLE' && 
    t.status === 'PENDING' &&
    new Date(t.dueDate) >= startDate &&
    new Date(t.dueDate) <= endDate
  );

  const overduePayables = mockTransactions.filter(t => 
    t.type === 'PAYABLE' && 
    t.status === 'PENDING' &&
    new Date(t.dueDate) < now
  );

  // Calculate KPIs
  const income = settledReceivables.reduce((sum, t) => sum + (t.actualAmount || 0), 0);
  const expense = settledPayables.reduce((sum, t) => sum + (t.actualAmount || 0), 0);
  const openReceivables = pendingReceivables.reduce((sum, t) => sum + t.plannedAmount, 0);
  const openPayables = pendingPayables.reduce((sum, t) => sum + t.plannedAmount, 0);
  const overdueTotal = overduePayables.reduce((sum, t) => sum + t.plannedAmount, 0);

  // Generate chart data (last 6 months)
  const chartData: { period: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const monthIncome = mockTransactions
      .filter(t => 
        t.type === 'RECEIVABLE' && 
        t.status === 'SETTLED' && 
        t.actualDate &&
        new Date(t.actualDate) >= monthStart &&
        new Date(t.actualDate) <= monthEnd
      )
      .reduce((sum, t) => sum + (t.actualAmount || 0), 0);

    const monthExpense = mockTransactions
      .filter(t => 
        t.type === 'PAYABLE' && 
        t.status === 'SETTLED' && 
        t.actualDate &&
        new Date(t.actualDate) >= monthStart &&
        new Date(t.actualDate) <= monthEnd
      )
      .reduce((sum, t) => sum + (t.actualAmount || 0), 0);

    // Add some base values so chart isn't empty
    chartData.push({
      period,
      income: monthIncome + 35000 + Math.random() * 15000,
      expense: monthExpense + 28000 + Math.random() * 12000
    });
  }

  // Top expense categories
  const categoryMap = new Map<string, number>();
  settledPayables.forEach(t => {
    const current = categoryMap.get(t.category) || 0;
    categoryMap.set(t.category, current + (t.actualAmount || 0));
  });

  const categories = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      _sum: { actualAmount: total }
    }))
    .sort((a, b) => (b._sum.actualAmount || 0) - (a._sum.actualAmount || 0))
    .slice(0, 5);

  // If no categories from data, use fallback
  const finalCategories = categories.length > 0 ? categories : [
    { category: 'Salários', _sum: { actualAmount: 25000 } },
    { category: 'Combustível', _sum: { actualAmount: 4500 } },
    { category: 'Aluguel', _sum: { actualAmount: 3500 } },
    { category: 'Impostos', _sum: { actualAmount: 2800 } },
    { category: 'Utilidades', _sum: { actualAmount: 2030 } },
  ];

  return {
    kpi: {
      income: income || 52250, // fallback values
      expense: expense || 37830,
      balance: (income || 52250) - (expense || 37830),
      openReceivables: openReceivables || 40000,
      openPayables: openPayables || 12300,
      overduePayables: overdueTotal || 1500,
    },
    chart: chartData,
    categories: finalCategories,
    warning: 'DB_OFFLINE' as const
  };
}

/**
 * Empty response for transactions (when DB is offline and mock is disabled)
 */
export function getEmptyTransactionsResponse(page = 1, pageSize = 20) {
  return {
    data: [],
    meta: {
      page,
      pageSize,
      total: 0,
      totalPages: 1
    },
    warning: 'DB_OFFLINE' as const
  };
}

/**
 * Empty response for metrics (when DB is offline and mock is disabled)
 */
export function getEmptyMetricsResponse() {
  return {
    kpi: {
      income: 0,
      expense: 0,
      balance: 0,
      openReceivables: 0,
      openPayables: 0,
      overduePayables: 0,
    },
    chart: [],
    categories: [],
    warning: 'DB_OFFLINE' as const
  };
}
