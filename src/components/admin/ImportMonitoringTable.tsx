import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight, FileSpreadsheet, Filter, FolderClock, Inbox, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateDisplay } from '@/lib/dateRange';
import type { ImportBatchListResult } from '@/lib/import/monitoring';

function pipelineBadge(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'success';
    case 'VALIDATED':
      return 'info';
    case 'REJECTED':
      return 'error';
    case 'PARSED':
      return 'warning';
    default:
      return 'neutral';
  }
}

interface ImportMonitoringTableProps {
  data: ImportBatchListResult;
}

export function ImportMonitoringTable({ data }: ImportMonitoringTableProps) {
  const { filters, items, totals } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Lotes" value={String(totals.batches)} icon={<Inbox className="h-4 w-4" />} />
        <StatCard label="Arquivos" value={String(totals.files)} icon={<FileSpreadsheet className="h-4 w-4" />} />
        <StatCard label="Linhas validadas" value={String(totals.validatedRows)} icon={<FolderClock className="h-4 w-4" />} />
        <StatCard label="Linhas publicadas" value={String(totals.publishedRows)} icon={<ArrowRight className="h-4 w-4" />} />
      </div>

      <form className="glass-panel grid gap-3 p-4 md:grid-cols-[1.2fr_180px_180px_160px]" method="GET">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={filters.query}
            placeholder="Buscar por arquivo, hash ou lote..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700"
          />
        </label>
        <select
          name="status"
          defaultValue={filters.status}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="ALL">Todos os status</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="PARSED">Parsed</option>
          <option value="VALIDATED">Validated</option>
          <option value="REJECTED">Rejected</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select
          name="kind"
          defaultValue={filters.kind}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="ALL">Todos os tipos</option>
          <option value="WORKBOOK_MULTI_SHEET">Workbook multiaba</option>
          <option value="OPERATIONAL_SNAPSHOT">Operacional</option>
          <option value="FINANCIAL_LEDGER">Financeiro</option>
          <option value="FINE_LEDGER">Multas</option>
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            name="from"
            defaultValue={filters.dateRange.from}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />
          <input
            type="date"
            name="to"
            defaultValue={filters.dateRange.to}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />
          <Button type="submit" variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white px-4">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
        </div>
      </form>

      <div className="data-table-shell overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lotes importados</h2>
            <p className="mt-1 text-sm text-slate-500">
              Periodo de {formatDateDisplay(filters.dateRange.from)} ate {formatDateDisplay(filters.dateRange.to)}
            </p>
          </div>
          <Badge variant="info" size="lg">
            {items.length} lote(s)
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Arquivo / origem</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linhas</TableHead>
              <TableHead>Qualidade</TableHead>
              <TableHead className="text-right">Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="min-w-[220px]">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{item.primaryFileName || item.batchKey}</div>
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.kind}</div>
                    <div className="font-mono text-[11px] text-slate-400">{item.id.slice(0, 12)}...</div>
                  </div>
                </TableCell>
                <TableCell className="min-w-[240px]">
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>{item.fileNames.slice(0, 2).join(', ') || 'Sem arquivo'}</div>
                    <div className="text-xs text-slate-400">{item.primarySource || 'n/a'} · {item.importModes.join(', ') || 'n/a'}</div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {format(item.startedAt, 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <Badge variant={pipelineBadge(item.pipelineStatus) as never}>{item.pipelineStatus}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  <div>Total: {item.rowCount}</div>
                  <div>Validas: {item.validatedRows}</div>
                  <div>Rejeitadas: {item.rejectedRowCount}</div>
                  <div>Publicadas: {item.publishedRowCount}</div>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  <div>Warnings: {item.warningCount}</div>
                  <div>Erros: {item.errorCount}</div>
                  <div>Arquivos: {item.importedFiles}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white px-4">
                    <Link href={`/importacoes/${item.id}`}>
                      Ver detalhe
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40">
                  <div className="premium-empty h-full">
                    <FileSpreadsheet className="h-10 w-10 text-slate-300" />
                    <p className="text-base font-medium text-slate-700">Nenhum lote encontrado</p>
                    <p className="text-sm text-slate-500">Ajuste os filtros ou execute uma nova importacao.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-premium flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#022D44]/8 text-[#022D44]">{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{value}</p>
      </div>
    </div>
  );
}
