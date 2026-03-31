import { format } from "date-fns";
import { Badge, BadgeProps } from "@/lib/components/layout/ui/badge";
import { Button } from "@/lib/components/layout/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { RefreshCw, FileSpreadsheet, HardDrive, CheckCircle2, AlertOctagon, Info, Calendar, ArrowRight, FileX } from "lucide-react";
import { parseDateRangeFromSearchParams, dateRangeToDbFilter, formatDateDisplay } from "@/lib/dateRange";
import { RemoveSeedButton } from "./RemoveSeedButton";
import { getProcessingStatusInfo } from "@/lib/i18n/statusLabels";

type SourceFileWithBatch = {
  id: string;
  name: string;
  driveFileId: string;
  processedAt: Date | null;
  status: string;
  errorMessage: string | null;
  kind: string;
  totalRows: number;
  importedRows: number;
  errorCount: number;
  details: Record<string, unknown> | null;
  importBatch: {
    id: string;
    status: string;
  } | null;
};

async function getSourceFiles(searchParams: { from?: string; to?: string }) {
  if (!process.env.DATABASE_URL) {
    return { files: [] as SourceFileWithBatch[], isMock: true, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }

  try {
    const { db } = await import("@/lib/db");
    const dateRange = parseDateRangeFromSearchParams(searchParams);
    const dateFilter = dateRangeToDbFilter(dateRange);

    const files = await db.sourceFile.findMany({
      where: {
        OR: [
          {
            processedAt: {
              gte: dateFilter.gte,
              lte: dateFilter.lte,
            }
          },
          { processedAt: null }
        ]
      },
      include: {
        importBatch: {
          select: {
            id: true,
            status: true,
          }
        }
      },
      orderBy: { processedAt: 'desc' },
      take: 50
    });

    return { files: files as SourceFileWithBatch[], isMock: false, dateRange };
  } catch (_error) {
    return { files: [] as SourceFileWithBatch[], isMock: false, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }
}

function formatQualitySummary(details: Record<string, unknown> | null): string {
  const qualitySummary = details?.qualitySummary;
  if (!qualitySummary || typeof qualitySummary !== 'object' || Array.isArray(qualitySummary)) {
    return 'Sem resumo de qualidade';
  }

  const summary = qualitySummary as Record<string, unknown>;
  if (summary.operational || summary.financial || summary.fines) {
    const operational = (summary.operational ?? {}) as Record<string, unknown>;
    const financial = (summary.financial ?? {}) as Record<string, unknown>;
    const fines = (summary.fines ?? {}) as Record<string, unknown>;
    return `Op OK ${operational.OK ?? 0} • Fin OK ${financial.OK ?? 0} • Multas OK ${fines.OK ?? 0}`;
  }

  const byStatus =
    summary.byStatus && typeof summary.byStatus === 'object' && !Array.isArray(summary.byStatus)
      ? (summary.byStatus as Record<string, unknown>)
      : summary;
  return `OK ${byStatus.OK ?? 0} • Warning ${byStatus.WARNING ?? 0} • Revisao ${byStatus.REVIEW_REQUIRED ?? 0}`;
}

function formatWarnings(details: Record<string, unknown> | null): string {
  const warnings = details?.warnings;
  if (!Array.isArray(warnings) || warnings.length === 0) return 'Sem warnings';
  return `${warnings.length} warning(s)`;
}

function formatSheetSummary(details: Record<string, unknown> | null): string[] {
  const sheetSummaries = details?.sheetSummaries;
  if (!Array.isArray(sheetSummaries)) return [];

  return sheetSummaries
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const summary = item as Record<string, unknown>;
      const sheet = typeof summary.sheetName === 'string' ? summary.sheetName : 'aba';
      const domain = typeof summary.domain === 'string' ? summary.domain : 'n/a';
      const imported = typeof summary.importedRows === 'number' ? summary.importedRows : 0;
      return `${sheet} (${domain}): ${imported}`;
    })
    .filter((value): value is string => Boolean(value));
}

function formatDeferredSheets(details: Record<string, unknown> | null): string {
  const deferredSheets = details?.deferredSheets;
  if (!Array.isArray(deferredSheets) || deferredSheets.length === 0) return 'Sem abas pendentes';

  const names = deferredSheets.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return 'n/a';
    const record = item as Record<string, unknown>;
    return typeof record.sheetName === 'string' ? record.sheetName : 'n/a';
  });

  return `Pendentes: ${names.join(', ')}`;
}

export default async function RelatoriosPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { files, isMock, dateRange } = await getSourceFiles(searchParams);
  const hasSeedFile = files.some((f) => f.name === 'Seed Data.xlsx');
  const successCount = files.filter((f) => f.status === 'PROCESSED').length;
  const errorCount = files.filter((f) => f.status === 'ERROR').length;

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstracao: banco nao configurado (DATABASE_URL ausente).</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Relatorios</h2>
            <Badge variant="info" size="lg">{files.length} arquivos</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Historico da nova pipeline operacional e dos lotes de importacao
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm px-3 py-2 bg-muted rounded-lg">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{formatDateDisplay(dateRange.from)}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">{formatDateDisplay(dateRange.to)}</span>
          </div>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Arquivos Totais</p>
              <p className="text-2xl font-bold mt-2">{files.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#022D44]/10 text-[#022D44]">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Processados</p>
              <p className="text-2xl font-bold mt-2 text-emerald-600">{successCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Com Erros</p>
              <p className="text-2xl font-bold mt-2 text-red-600">{errorCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {hasSeedFile && (
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700 text-sm flex-1">
            Arquivo de teste <strong>&quot;Seed Data.xlsx&quot;</strong> detectado. Deseja remove-lo?
          </span>
          <RemoveSeedButton />
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Arquivo</TableHead>
              <TableHead className="font-semibold">Tipo / Aba</TableHead>
              <TableHead className="font-semibold">Lote</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Resumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => {
              const statusInfo = getProcessingStatusInfo(file.status);
              const details = file.details;
              const sheetSummary = formatSheetSummary(details);
              const deferredSheets = formatDeferredSheets(details);
              const primarySheetName =
                details && typeof details.primarySheetName === 'string'
                  ? details.primarySheetName
                  : 'n/a';
              return (
                <TableRow key={file.id} className={file.name === 'Seed Data.xlsx' ? 'bg-amber-50/50' : 'hover:bg-muted/30'}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#A8CF4C]" />
                      <div className="min-w-0">
                        <div className="truncate">{file.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {file.driveFileId.substring(0, 12)}...
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-1">
                      <div>{file.kind}</div>
                      <div className="text-muted-foreground">{primarySheetName}</div>
                      {sheetSummary.length > 0 ? (
                        <div className="text-muted-foreground">{sheetSummary.length} abas importadas</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {file.importBatch?.status || 'Sem lote'}
                  </TableCell>
                  <TableCell>
                    {file.processedAt ? format(new Date(file.processedAt), 'dd/MM/yyyy HH:mm') : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant as BadgeProps['variant']}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                    <div>{file.importedRows}/{file.totalRows} linhas importadas</div>
                    <div>{formatWarnings(details)}</div>
                    <div>{formatQualitySummary(details)}</div>
                    {sheetSummary.slice(0, 3).map((line) => (
                      <div key={line} className="truncate" title={line}>{line}</div>
                    ))}
                    <div className="truncate" title={deferredSheets}>{deferredSheets}</div>
                    {file.errorMessage && <div className="truncate" title={file.errorMessage}>{file.errorMessage}</div>}
                  </TableCell>
                </TableRow>
              );
            })}
            {files.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileX className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum arquivo encontrado
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Ajuste o periodo ou importe novos arquivos
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
