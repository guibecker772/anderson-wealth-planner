'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { Badge } from "@/lib/components/layout/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/lib/components/layout/ui/button";
import { useRouter, useSearchParams } from "next/navigation";

export function TransactionTable({ data, page, totalPages, type }: { data: any[], page: number, totalPages: number, type: 'PAYABLE' | 'RECEIVABLE' }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
      const params = new URLSearchParams(searchParams);
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
            <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                Próximo
            </Button>
        </div>
    </div>
  );
}