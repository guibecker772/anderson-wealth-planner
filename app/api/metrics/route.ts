import { NextRequest, NextResponse } from 'next/server';
import { 
  getMockMetrics, 
  getEmptyMetricsResponse, 
  useMockData 
} from '@/lib/db-safe';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().getFullYear(), 0, 1);
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();

  // Check if we should use mock data (no DATABASE_URL or USE_MOCK_DATA=true)
  if (useMockData()) {
    const mockResult = getMockMetrics({ from, to });
    return NextResponse.json(mockResult);
  }

  // Try to fetch from database
  try {
    const { db } = await import('@/lib/db');

    // 1. Receitas Recebidas (SETTLED) no período (por actualDate)
    const incomeAgg = await db.transaction.aggregate({
      _sum: { actualAmount: true },
      where: {
        type: 'RECEIVABLE',
        status: 'SETTLED',
        actualDate: { gte: from, lte: to }
      }
    });

    // 2. Despesas Pagas (SETTLED) no período (por actualDate)
    const expenseAgg = await db.transaction.aggregate({
      _sum: { actualAmount: true },
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        actualDate: { gte: from, lte: to }
      }
    });

    // 3. A Receber (PENDING) no período (por dueDate)
    const openReceivables = await db.transaction.aggregate({
      _sum: { plannedAmount: true },
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        dueDate: { gte: from, lte: to }
      }
    });

    // 4. A Pagar (PENDING) no período (por dueDate)
    const openPayables = await db.transaction.aggregate({
      _sum: { plannedAmount: true },
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: { gte: from, lte: to }
      }
    });

    // 5. Vencidos (PENDING + DueDate < Hoje)
    const today = new Date();
    const overduePayables = await db.transaction.aggregate({
      _sum: { plannedAmount: true },
      where: {
        type: 'PAYABLE',
        status: 'PENDING',
        dueDate: { lt: today }
      }
    });

    // 6. Chart Data (Group by Month for simple view) - SETTLED transactions by actualDate
    const chartData = await db.$queryRaw`
      SELECT 
        TO_CHAR("actualDate", 'YYYY-MM') as period,
        COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN "actualAmount" ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN "actualAmount" ELSE 0 END), 0) as expense
      FROM "Transaction"
      WHERE status = 'SETTLED' 
        AND "actualDate" IS NOT NULL
        AND "actualDate" BETWEEN ${from} AND ${to}
      GROUP BY TO_CHAR("actualDate", 'YYYY-MM')
      ORDER BY period ASC
    `;

    // 7. Top Categories (Expenses)
    const topCategories = await db.transaction.groupBy({
      by: ['category'],
      _sum: { actualAmount: true },
      where: {
        type: 'PAYABLE',
        status: 'SETTLED',
        actualDate: { gte: from, lte: to }
      },
      orderBy: {
        _sum: { actualAmount: 'desc' }
      },
      take: 5
    });

    return NextResponse.json({
      kpi: {
        income: incomeAgg._sum.actualAmount || 0,
        expense: expenseAgg._sum.actualAmount || 0,
        balance: (Number(incomeAgg._sum.actualAmount) || 0) - (Number(expenseAgg._sum.actualAmount) || 0),
        openReceivables: openReceivables._sum.plannedAmount || 0,
        openPayables: openPayables._sum.plannedAmount || 0,
        overduePayables: overduePayables._sum.plannedAmount || 0,
      },
      chart: chartData,
      categories: topCategories
    });
  } catch (error) {
    // Database error - return mock or empty based on preference
    console.warn('[api/metrics] Database error, falling back:', (error as Error).message);
    
    // If USE_MOCK_DATA is explicitly set, return mock; otherwise return empty
    if (process.env.USE_MOCK_DATA === 'true') {
      const mockResult = getMockMetrics({ from, to });
      return NextResponse.json(mockResult);
    }
    
    // Return empty response with warning (never 500)
    return NextResponse.json(getEmptyMetricsResponse());
  }
}