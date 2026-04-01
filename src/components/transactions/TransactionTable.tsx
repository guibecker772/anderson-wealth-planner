'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { getTransactionStatusInfo } from "@/lib/i18n/statusLabels";
import { FileX, Pencil, Sparkles } from "lucide-react";

interface Transaction {
  id: string;
  dueDate: string | Date | null;
  counterparty: string | null;
  category: string | null;
  plannedAmount: number | string | null;
  actualAmount: number | string | null;
  status: string;
  categorySource?: 'RAW' | 'NORMALIZED' | 'MANUAL' | null;
  normalizedAt?: string | Date | null;
  qualityStatus?: 'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN' | null;
}

interface TransactionTableProps {
  data: Transaction[];
  page: number;
  totalPages: number;
  type: 'PAYABLE' | 'RECEIVABLE';
}

export function TransactionTable({ data, page, totalPages, type }: TransactionTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="card-premium overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="whitespace-nowrap py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Vencimento
              </TableHead>
              <TableHead className="py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'}
              </TableHead>
              <TableHead className="py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Categoria
              </TableHead>
              <TableHead className="whitespace-nowrap py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Valor Previsto
              </TableHead>
              <TableHead className="whitespace-nowrap py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Valor Real
              </TableHead>
              <TableHead className="py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((tx) => {
              const statusInfo = getTransactionStatusInfo(tx.status);

              return (
                <TableRow key={tx.id} className="transition-colors hover:bg-slate-50/70">
                  <TableCell className="whitespace-nowrap py-4 text-sm font-medium text-slate-700">
                    {formatDate(tx.dueDate)}
                  </TableCell>
                  <TableCell className="max-w-[220px] py-4">
                    <span className="block truncate text-sm text-slate-800" title={tx.counterparty ?? undefined}>
                      {tx.counterparty || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[240px] py-4">
                    {tx.category ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        <span className="truncate" title={tx.category}>
                          {tx.category}
                        </span>
                        {tx.categorySource === 'NORMALIZED' && (
                          <span title="Categoria normalizada automaticamente">
                            <Sparkles className="h-3 w-3 text-emerald-500" />
                          </span>
                        )}
                        {tx.categorySource === 'MANUAL' && (
                          <span title="Categoria definida manualmente">
                            <Pencil className="h-3 w-3 text-blue-500" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="table-number py-4 text-right font-medium text-slate-900">
                    {formatCurrency(Number(tx.plannedAmount))}
                  </TableCell>
                  <TableCell className="table-number py-4 text-right font-medium text-slate-900">
                    {tx.actualAmount ? formatCurrency(Number(tx.actualAmount)) : <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusInfo.variant as BadgeProps['variant']}>
                        {statusInfo.label}
                      </Badge>
                      {tx.qualityStatus && tx.qualityStatus !== 'OK' && tx.qualityStatus !== 'UNKNOWN' && (
                        <Badge variant={tx.qualityStatus === 'REVIEW_REQUIRED' ? 'warning' : 'info'}>
                          {tx.qualityStatus === 'REVIEW_REQUIRED' ? 'Revisar' : 'Alerta'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileX className="mb-4 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      Nenhum lançamento encontrado
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Tente ajustar os filtros ou o período selecionado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
