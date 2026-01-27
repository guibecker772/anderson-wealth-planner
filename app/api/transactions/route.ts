import { NextRequest, NextResponse } from 'next/server';
import { 
  getMockTransactions, 
  getEmptyTransactionsResponse, 
  useMockData,
  type TransactionFilters 
} from '@/lib/db-safe';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const type = searchParams.get('type') as TransactionFilters['type'];
  const status = searchParams.get('status') as TransactionFilters['status'];
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const q = searchParams.get('q') || undefined;
  const category = searchParams.get('category') || undefined;

  const filters: TransactionFilters = { type, status, category, from, to, q, page, pageSize };

  // Check if we should use mock data (no DATABASE_URL or USE_MOCK_DATA=true)
  if (useMockData()) {
    const mockResult = getMockTransactions(filters);
    return NextResponse.json(mockResult);
  }

  // Try to fetch from database
  try {
    const { db } = await import('@/lib/db');

    const where: any = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = category;

    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { counterparty: { contains: q, mode: 'insensitive' } },
        { externalId: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [count, data] = await Promise.all([
      db.transaction.count({ where }),
      db.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { dueDate: 'desc' },
      }),
    ]);

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize) || 1
      }
    });
  } catch (error) {
    // Database error - return empty or mock based on preference
    console.warn('[api/transactions] Database error, falling back:', (error as Error).message);
    
    // If USE_MOCK_DATA is explicitly set, return mock; otherwise return empty
    if (process.env.USE_MOCK_DATA === 'true') {
      const mockResult = getMockTransactions(filters);
      return NextResponse.json(mockResult);
    }
    
    // Return empty response with warning (never 500)
    return NextResponse.json(getEmptyTransactionsResponse(page, pageSize));
  }
}