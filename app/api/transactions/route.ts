import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { 
  getMockTransactions, 
  getEmptyTransactionsResponse, 
  shouldUseMockData,
  type TransactionFilters 
} from '@/lib/db-safe';
import { parseDateRangeFromSearchParams, dateRangeToDbFilter } from '@/lib/dateRange';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const type = searchParams.get('type') as TransactionFilters['type'];
  // CORRIGIDO: status "ALL" ou vazio = não filtrar por status
  const statusParam = searchParams.get('status');
  const status = (statusParam && statusParam !== 'ALL') ? statusParam as TransactionFilters['status'] : undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const q = searchParams.get('q') || undefined;
  const category = searchParams.get('category') || undefined;

  // Parse date range with defaults
  const dateRange = parseDateRangeFromSearchParams({ from, to });
  const filters: TransactionFilters = { type, status, category, from: dateRange.from, to: dateRange.to, q, page, pageSize };
  
  // DEBUG: Log em desenvolvimento para diagnóstico
  if (process.env.NODE_ENV === 'development') {
    console.log('[api/transactions] Params recebidos:', {
      type,
      status: statusParam,
      statusAplicado: status,
      from,
      to,
      dateRangeParsed: dateRange,
      q,
      page,
    });
  }

  // Check if we should use mock data (no DATABASE_URL or USE_MOCK_DATA=true)
  if (shouldUseMockData()) {
    const mockResult = getMockTransactions(filters);
    return NextResponse.json(mockResult);
  }

  // Try to fetch from database
  try {
    const { db } = await import('@/lib/db');

    const where: Prisma.TransactionWhereInput = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = category;

    // Apply date filter (always has values due to defaults)
    const dbDateFilter = dateRangeToDbFilter(dateRange);
    where.dueDate = {
      gte: dbDateFilter.gte,
      lte: dbDateFilter.lte,
    };

    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { counterparty: { contains: q, mode: 'insensitive' } },
        { externalId: { contains: q, mode: 'insensitive' } }
      ];
    }

    // DEBUG: Log where clause em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('[api/transactions] WHERE clause:', JSON.stringify(where, null, 2));
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
        totalPages: Math.ceil(count / pageSize) || 1,
        dateRange, // Include the applied date range in response
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