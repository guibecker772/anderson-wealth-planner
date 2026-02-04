import { format } from "date-fns";
import { Badge, BadgeProps } from "@/lib/components/layout/ui/badge";
import { Button } from "@/lib/components/layout/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { RefreshCw, FileSpreadsheet, HardDrive, CheckCircle2, AlertOctagon, Info, Calendar, ArrowRight, FileX } from "lucide-react";
import { parseDateRangeFromSearchParams, dateRangeToDbFilter, formatDateDisplay } from "@/lib/dateRange";
import { RemoveSeedButton } from "./RemoveSeedButton";
import { getProcessingStatusInfo } from "@/lib/i18n/statusLabels";

async function getSourceFiles(searchParams: { from?: string; to?: string }) {
  // Fallback para modo sem DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return { files: [], isMock: true, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }

  try {
    const { db } = await import("@/lib/db");
    
    // Parse date range from URL params
    const dateRange = parseDateRangeFromSearchParams(searchParams);
    const dateFilter = dateRangeToDbFilter(dateRange);
    
    // Filter by processedAt date if the file was processed in the selected period
    const files = await db.sourceFile.findMany({
      where: {
        OR: [
          {
            processedAt: {
              gte: dateFilter.gte,
              lte: dateFilter.lte,
            }
          },
          // Also include files without processedAt (pending)
          { processedAt: null }
        ]
      },
      orderBy: { processedAt: 'desc' },
      take: 50
    });
    
    return { files, isMock: false, dateRange };
  } catch (_error) {
    return { files: [], isMock: false, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }
}

export default async function RelatoriosPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { files, isMock, dateRange } = await getSourceFiles(searchParams);

  // Check if Seed Data.xlsx exists
  const hasSeedFile = files.some(f => f.name === 'Seed Data.xlsx');
  const successCount = files.filter(f => f.status === 'PROCESSED').length;
  const errorCount = files.filter(f => f.status === 'ERROR').length;

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstração: banco não configurado (DATABASE_URL ausente).</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h2>
            <Badge variant="info" size="lg">{files.length} arquivos</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de processamento e importação de arquivos
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

      {/* Stats Cards */}
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

      {/* Remove Seed Data Button */}
      {hasSeedFile && (
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700 text-sm flex-1">
            Arquivo de teste <strong>&quot;Seed Data.xlsx&quot;</strong> detectado. Deseja removê-lo?
          </span>
          <RemoveSeedButton />
        </div>
      )}
      
      {/* Files Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Arquivo</TableHead>
              <TableHead className="font-semibold">Origem</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => {
              const statusInfo = getProcessingStatusInfo(file.status);
              
              return (
                <TableRow key={file.id} className={`hover:bg-muted/30 ${file.name === 'Seed Data.xlsx' ? 'bg-amber-50/50' : ''}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#A8CF4C]" />
                      <span>{file.name}</span>
                      {file.name === 'Seed Data.xlsx' && (
                        <Badge variant="warning" size="sm">Teste</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {file.driveFileId.substring(0, 12)}...
                    </span>
                  </TableCell>
                  <TableCell>
                    {file.processedAt ? format(new Date(file.processedAt), 'dd/MM/yyyy HH:mm') : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant as BadgeProps['variant']}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={file.errorMessage || ''}>
                    {file.errorMessage || <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {files.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileX className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum arquivo encontrado
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Ajuste o período ou importe novos arquivos
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