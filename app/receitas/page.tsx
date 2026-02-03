import { Suspense } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Badge } from "@/components/ui/badge";
import { parseDateRangeFromSearchParams, dateRangeToDbFilter } from "@/lib/dateRange";
import { db } from "@/lib/db";

async function getReceitas(searchParams: Record<string, string | undefined>) {
  const page = parseInt(searchParams.page || '1');
  const pageSize = 20;
  
  // Aplicar date range (com defaults se não fornecido)
  const dateRange = parseDateRangeFromSearchParams(searchParams);
  const dbDateFilter = dateRangeToDbFilter(dateRange);
  
  // Construir filtro where
  const where: any = {
    type: 'RECEIVABLE',
    dueDate: {
      gte: dbDateFilter.gte,
      lte: dbDateFilter.lte,
    },
  };
  
  // Filtros opcionais
  if (searchParams.status && searchParams.status !== 'ALL') {
    where.status = searchParams.status;
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
    console.error('[receitas] Erro ao buscar dados:', error);
    return { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
  }
}

export default async function ReceitasPage({ searchParams }: { searchParams: any }) {
  const { data, meta } = await getReceitas(searchParams);
  const totalPagina = data.reduce((acc: number, item: any) => acc + Number(item.plannedAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Receitas</h2>
            <Badge variant="success" size="lg">{meta.total}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Controle suas entradas e previsões de faturamento
          </p>
        </div>
        <div className="bg-emerald-500/10 px-4 py-2.5 rounded-lg border border-emerald-500/20">
          <p className="text-xs text-muted-foreground">Total desta página</p>
          <p className="text-lg font-bold text-emerald-600">
            R$ {totalPagina.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      {/* Filters */}
      <Suspense fallback={<div className="h-[60px] bg-muted/20 rounded-xl animate-pulse" />}>
        <TransactionFilters />
      </Suspense>
      
      {/* Table */}
      <TransactionTable 
        data={data} 
        page={Number(meta.page)} 
        totalPages={Number(meta.totalPages)} 
        type="RECEIVABLE" 
      />
    </div>
  );
}