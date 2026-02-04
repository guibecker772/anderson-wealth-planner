import { Suspense } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionAnalyticsPanel } from "@/components/analytics/TransactionAnalyticsPanel";
import { MetricsSummaryCards } from "@/components/metrics/MetricsSummaryCards";
import { Badge } from "@/components/ui/badge";
import { parseDateRangeFromSearchParams, dateRangeToDbFilter } from "@/lib/dateRange";
import { db } from "@/lib/db";

import { Prisma } from '@prisma/client';

async function getDespesas(searchParams: Record<string, string | undefined>) {
  const page = parseInt(searchParams.page || '1');
  const pageSize = 20;
  
  // Aplicar date range (com defaults se não fornecido)
  const dateRange = parseDateRangeFromSearchParams(searchParams);
  const dbDateFilter = dateRangeToDbFilter(dateRange);
  
  // Construir filtro where
  const where: Prisma.TransactionWhereInput = {
    type: 'PAYABLE',
    dueDate: {
      gte: dbDateFilter.gte,
      lte: dbDateFilter.lte,
    },
  };
  
  // Filtros opcionais
  if (searchParams.status && searchParams.status !== 'ALL') {
    where.status = searchParams.status as 'PENDING' | 'SETTLED';
  }
  if (searchParams.category) {
    where.category = searchParams.category;
  }
  if (searchParams.q) {
    where.OR = [
      { description: { contains: searchParams.q, mode: 'insensitive' } },
      { counterparty: { contains: searchParams.q, mode: 'insensitive' } },
      { externalId: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }
  
  try {
    const [count, rawData] = await Promise.all([
      db.transaction.count({ where }),
      db.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { dueDate: 'desc' },
      }),
    ]);
    
    // Serializar Decimal para number (Prisma Decimal não é serializável para Client Components)
    const data = rawData.map(tx => ({
      ...tx,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      feesInterest: tx.feesInterest ? Number(tx.feesInterest) : null,
      feesFine: tx.feesFine ? Number(tx.feesFine) : null,
      discount: tx.discount ? Number(tx.discount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    }));
    
    return {
      data,
      meta: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize) || 1,
        dateRange,
      },
    };
  } catch (error) {
    console.error('[despesas] Erro ao buscar dados:', error);
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
  }
}

export default async function DespesasPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { data, meta } = await getDespesas(searchParams);
  const dateRange = parseDateRangeFromSearchParams(searchParams);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Despesas</h2>
            <Badge variant="error" size="lg">{meta.total}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas contas a pagar e saídas de caixa
          </p>
        </div>
      </div>

      {/* Metrics Summary Cards - Pago / A Pagar / Vencidos / Total Previsto */}
      <Suspense fallback={<div className="h-[100px] bg-muted/20 rounded-xl animate-pulse" />}>
        <MetricsSummaryCards scope="expense" dateRange={dateRange} />
      </Suspense>

      {/* Analytics Panel - Evolution Chart + Ranking */}
      <Suspense fallback={<div className="h-[300px] bg-muted/20 rounded-xl animate-pulse" />}>
        <TransactionAnalyticsPanel scope="expense" dateRange={dateRange} />
      </Suspense>
      
      {/* Filters */}
      <Suspense fallback={<div className="h-[60px] bg-muted/20 rounded-xl animate-pulse" />}>
        <TransactionFilters />
      </Suspense>

      {/* Table */}
      <TransactionTable 
        data={data} 
        page={Number(meta.page)} 
        totalPages={Number(meta.totalPages)} 
        type="PAYABLE" 
      />
    </div>
  );
}