import Link from 'next/link';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, FileSpreadsheet, Layers3, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImportBatchActions } from '@/components/admin/ImportBatchActions';
import type { ImportBatchDetail } from '@/lib/import/monitoring';

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

interface ImportBatchDetailViewProps {
  detail: ImportBatchDetail;
}

export function ImportBatchDetailView({ detail }: ImportBatchDetailViewProps) {
  const canPublish = detail.batch.pipelineStatus === 'VALIDATED';
  const canReprocess = detail.batch.pipelineStatus === 'PUBLISHED' || detail.batch.pipelineStatus === 'VALIDATED';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="module-surface module-surface-operational space-y-4">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2>Resumo do lote</h2>
              <p>Origem, timestamps e situacao atual do pipeline.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Batch" value={detail.batch.id.slice(0, 12)} />
            <InfoCard label="Status" value={detail.batch.pipelineStatus} />
            <InfoCard label="Tipo" value={detail.batch.kind} />
            <InfoCard label="Template" value={detail.batch.templateVersion || 'n/a'} />
            <InfoCard label="Iniciado em" value={format(detail.batch.startedAt, 'dd/MM/yyyy HH:mm')} />
            <InfoCard label="Publicado em" value={detail.batch.publishedAt ? format(detail.batch.publishedAt, 'dd/MM/yyyy HH:mm') : '-'} />
          </div>
        </div>

        <div className="module-surface module-surface-financial space-y-4">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2>Acao operacional</h2>
              <p>Publicacao do staging validado e reprocessamento seguro do lote.</p>
            </div>
          </div>

          <ImportBatchActions batchId={detail.batch.id} canPublish={canPublish} canReprocess={canReprocess} />

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Linhas totais" value={String(detail.batch.rowCount)} />
            <InfoCard label="Normalizadas" value={String(detail.batch.normalizedRowCount)} />
            <InfoCard label="Rejeitadas" value={String(detail.batch.rejectedRowCount)} />
            <InfoCard label="Publicadas" value={String(detail.batch.publishedRowCount)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Snapshots" value={detail.finalCounts.operationalSnapshots} />
        <SummaryCard label="Financeiro" value={detail.finalCounts.financialEntries} />
        <SummaryCard label="Multas" value={detail.finalCounts.fineRecords} />
        <SummaryCard label="Responsabilidades" value={detail.finalCounts.fineResponsibilities} />
      </div>

      <div className="data-table-shell overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Arquivos do lote</h2>
            <p className="mt-1 text-sm text-slate-500">Origem, modo de importacao e contadores por arquivo.</p>
          </div>
          <Badge variant="info" size="lg">{detail.files.length} arquivo(s)</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linhas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.files.map((file) => (
              <TableRow key={file.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{file.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{file.checksum.slice(0, 16)}...</div>
                    <div className="text-xs text-slate-500">{file.originalPath || 'Sem caminho original'}</div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  <div>{file.source}</div>
                  <div>{file.importMode}</div>
                  <div>{file.kind}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={pipelineBadge(file.status) as never}>{file.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  <div>Total: {file.totalRows}</div>
                  <div>Validas: {file.validatedRows}</div>
                  <div>Rejeitadas: {file.rejectedRows}</div>
                  <div>Publicadas: {file.publishedRows}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="data-table-shell overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Linhas com validacao e erros</h2>
            <p className="mt-1 text-sm text-slate-500">Amostra operacional para auditoria do lote.</p>
          </div>
          <Badge variant="warning" size="lg">{detail.rows.length} linha(s)</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aba / linha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mensagens</TableHead>
              <TableHead>Publicado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm text-slate-600">
                  <div className="font-medium text-slate-900">{row.sourceSheetName}</div>
                  <div>source_row_number: {row.sourceRowNumber}</div>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  <div>{row.recordType}</div>
                  <div className="text-xs text-slate-400">{row.rowKind}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={pipelineBadge(row.status) as never}>{row.status}</Badge>
                </TableCell>
                <TableCell className="max-w-[360px] text-sm text-slate-600">
                  {row.errorMessage ? <div className="font-medium text-red-600">{row.errorMessage}</div> : null}
                  {row.validationMessages.slice(0, 3).map((message) => (
                    <div key={`${row.id}-${message.code}-${message.message}`} className="truncate">
                      [{message.severity}] {message.message}
                    </div>
                  ))}
                  {row.validationMessages.length === 0 ? <div>Sem mensagens</div> : null}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {row.publishedRecordId ? (
                    <div className="space-y-1">
                      <div className="text-emerald-700">Sim</div>
                      <div className="font-mono text-[11px] text-slate-400">{row.publishedRecordId.slice(0, 12)}...</div>
                    </div>
                  ) : 'Nao'}
                </TableCell>
              </TableRow>
            ))}

            {detail.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-36">
                  <div className="premium-empty h-full">
                    <AlertTriangle className="h-10 w-10 text-slate-300" />
                    <p className="text-base font-medium text-slate-700">Nenhuma linha encontrada</p>
                    <p className="text-sm text-slate-500">Ajuste os filtros do detalhe para ampliar a auditoria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Layers3 className="h-4 w-4 text-[#022D44]" />
          <span>Resumo de validacao: {detail.summary.errors} erro(s), {detail.summary.warnings} warning(s)</span>
        </div>
        <Link href="/importacoes" className="inline-flex items-center gap-2 text-sm font-medium text-[#022D44]">
          <ArrowLeft className="h-4 w-4" />
          Voltar para o centro de importacoes
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-premium flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#A8CF4C]/18 text-[#47640f]">
        <Layers3 className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
