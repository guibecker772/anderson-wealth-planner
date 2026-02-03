'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { getTransactionStatusInfo, type BadgeVariant } from "@/lib/i18n/statusLabels";
import { FileX } from "lucide-react";

interface TransactionTableProps {
  data: any[];
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
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Vencimento</TableHead>
              <TableHead className="font-semibold">{type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'}</TableHead>
              <TableHead className="font-semibold">Categoria</TableHead>
              <TableHead className="font-semibold text-right">Valor Previsto</TableHead>
              <TableHead className="font-semibold text-right">Valor Real</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((tx) => {
              const statusInfo = getTransactionStatusInfo(tx.status);
              
              return (
                <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{formatDate(tx.dueDate)}</TableCell>
                  <TableCell>{tx.counterparty || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {tx.category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs">
                        {tx.category}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(tx.plannedAmount))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {tx.actualAmount ? formatCurrency(Number(tx.actualAmount)) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant as any}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileX className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum lançamento encontrado
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Tente ajustar os filtros ou o período selecionado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
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
