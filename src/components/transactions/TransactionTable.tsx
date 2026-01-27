'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>{type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'}</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor Previsto</TableHead>
              <TableHead>Valor Real</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.dueDate)}</TableCell>
                <TableCell>{tx.counterparty || '-'}</TableCell>
                <TableCell>{tx.category || '-'}</TableCell>
                <TableCell>{formatCurrency(Number(tx.plannedAmount))}</TableCell>
                <TableCell>{tx.actualAmount ? formatCurrency(Number(tx.actualAmount)) : '-'}</TableCell>
                <TableCell>
                  <Badge variant={tx.status === 'SETTLED' ? 'success' : 'warning'}>
                    {tx.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handlePageChange(page - 1)} 
          disabled={page <= 1}
        >
          Anterior
        </Button>
        <span className="flex items-center px-3 text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
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
  );
}
