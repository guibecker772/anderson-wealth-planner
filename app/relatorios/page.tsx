import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { AlertOctagon, Calendar, CheckCircle2, Clock3, FileSpreadsheet, FileX, HardDrive, Info, Layers3, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, BadgeProps } from '@/lib/components/layout/ui/badge';
import { Button } from '@/lib/components/layout/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/lib/components/layout/ui/table';
import { PageHero } from '@/components/ui/PageHero';
import { RemoveSeedButton } from './RemoveSeedButton';
import { parseDateRangeFromSearchParams, dateRangeToDbFilter, formatDateDisplay } from '@/lib/dateRange';
import { getProcessingStatusInfo } from '@/lib/i18n/statusLabels';

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
  importBatch: { id: string; status: string } | null;
};

async function getSourceFiles(searchParams: { from?: string; to?: string }) {
  if (!process.env.DATABASE_URL) {
    return { files: [] as SourceFileWithBatch[], isMock: true, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }
  try {
    const { db } = await import('@/lib/db');
    const dateRange = parseDateRangeFromSearchParams(searchParams);
    const dateFilter = dateRangeToDbFilter(dateRange);
    const files = await db.sourceFile.findMany({
      where: {
        OR: [
          { processedAt: { gte: dateFilter.gte, lte: dateFilter.lte } },
          { processedAt: null },
        ],
      },
      include: { importBatch: { select: { id: true, status: true } } },
      orderBy: { processedAt: 'desc' },
      take: 50,
    });
    return { files: files as SourceFileWithBatch[], isMock: false, dateRange };
  } catch {
    return { files: [] as SourceFileWithBatch[], isMock: false, dateRange: parseDateRangeFromSearchParams(searchParams) };
  }
}

function formatQualitySummary(details: Record<string, unknown> | null): string {
  const qualitySummary = details?.qualitySummary;
  if (!qualitySummary || typeof qualitySummary !== 'object' || Array.isArray(qualitySummary)) return 'Sem resumo de qualidade';
  const summary = qualitySummary as Record<string, unknown>;
  if (summary.operational || summary.financial || summary.fines) {
    const operational = (summary.operational ?? {}) as Record<string, unknown>;
    const financial = (summary.financial ?? {}) as Record<string, unknown>;
    const fines = (summary.fines ?? {}) as Record<string, unknown>;
    return `Op OK ${operational.OK ?? 0} | Fin OK ${financial.OK ?? 0} | Multas OK ${fines.OK ?? 0}`;
  }
  const byStatus =
    summary.byStatus && typeof summary.byStatus === 'object' && !Array.isArray(summary.byStatus)
      ? (summary.byStatus as Record<string, unknown>)
      : summary;
  return `OK ${byStatus.OK ?? 0} | Warning ${byStatus.WARNING ?? 0} | Revisao ${byStatus.REVIEW_REQUIRED ?? 0}`;
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
  const warningCount = files.reduce((acc, file) => acc + (Array.isArray(file.details?.warnings) ? file.details!.warnings.length : 0), 0);

  return (
    <div className="page-shell">
      {isMock ? (
        <div className="glass-panel border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.1),rgba(255,255,255,0.92))] p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Modo demonstracao: banco nao configurado (DATABASE_URL ausente).
          </div>
        </div>
      ) : null}

      <PageHero
        eyebrow="Governanca de Importacao"
        title="Relatorios"
        description="Historico da pipeline multiaba, com rastreabilidade por workbook, resumo por dominio e leitura rapida de warnings."
        accent="blue"
        meta={
          <>
            <span className="page-hero-chip">Arquivos: {files.length}</span>
            <span className="page-hero-chip">Periodo: {formatDateDisplay(dateRange.from)} ate {formatDateDisplay(dateRange.to)}</span>
            <span className="page-hero-chip">Warnings: {warningCount}</span>
          </>
        }
        actions={(
          <div className="flex items-center gap-3">
            <div className="page-hero-chip">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateDisplay(dateRange.from)} ate {formatDateDisplay(dateRange.to)}
            </div>
            <Button variant="outline" className="h-11 rounded-full border-white/70 bg-white/80 px-4 shadow-sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
          </div>
        )}
      >
        <div className="hero-metrics-grid">
          <HeroMetric icon={<HardDrive className="h-4 w-4" />} label="Workbooks" value={String(files.length)} tone="blue" />
          <HeroMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Processados" value={String(successCount)} tone="emerald" />
          <HeroMetric icon={<AlertOctagon className="h-4 w-4" />} label="Com erro" value={String(errorCount)} tone="red" />
          <HeroMetric icon={<Layers3 className="h-4 w-4" />} label="Warnings" value={String(warningCount)} tone="amber" />
        </div>
      </PageHero>

      {hasSeedFile ? (
        <div className="glass-panel border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.92))] p-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <span className="flex-1 text-sm text-amber-800">
              Arquivo de teste <strong>&quot;Seed Data.xlsx&quot;</strong> detectado. Deseja remove-lo?
            </span>
            <RemoveSeedButton />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="module-surface module-surface-operational">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/10 text-[#022D44]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2>Panorama da pipeline</h2>
              <p>Visao resumida do estado de importacao e consistencia recente.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoStat label="Ultimo periodo filtrado" value={`${formatDateDisplay(dateRange.from)} ate ${formatDateDisplay(dateRange.to)}`} />
            <InfoStat label="Arquivos com lote" value={String(files.filter((file) => file.importBatch).length)} />
            <InfoStat label="Arquivos com erro" value={String(errorCount)} />
            <InfoStat label="Sem abas pendentes" value={String(files.filter((file) => !formatDeferredSheets(file.details).startsWith('Pendentes')).length)} />
          </div>
        </div>

        <div className="module-surface module-surface-financial">
          <div className="section-heading">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2>Leitura rapida dos dominios</h2>
              <p>Cada workbook mostra dominios importados, warnings e sheets ainda deferidas.</p>
            </div>
          </div>
          <div className="soft-grid grid gap-3 sm:grid-cols-3">
            <DomainTag title="Operacional" description="Snapshots da frota e cobranca semanal." />
            <DomainTag title="Financeiro" description="Receita, despesa e investimentos do workbook." />
            <DomainTag title="Multas" description="FineRecord oficial, sem depender da camada operacional." />
          </div>
        </div>
      </div>

      <div className="data-table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Historico de arquivos</h2>
            <p className="mt-1 text-sm text-slate-500">Tipo do workbook, aba principal, resumo por sheet e rastreabilidade do lote.</p>
          </div>
          <Badge variant="info" size="lg">{files.length} arquivos</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Tipo / Aba</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => {
              const statusInfo = getProcessingStatusInfo(file.status);
              const details = file.details;
              const sheetSummary = formatSheetSummary(details);
              const deferredSheets = formatDeferredSheets(details);
              const primarySheetName = details && typeof details.primarySheetName === 'string' ? details.primarySheetName : 'n/a';
              return (
                <TableRow key={file.id}>
                  <TableCell className="min-w-[260px]">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A8CF4C]/18 text-[#47640f]">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{file.name}</div>
                        <div className="truncate font-mono text-[11px] text-slate-400">{file.driveFileId.substring(0, 16)}...</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-1.5">
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">{file.kind}</div>
                      <div className="text-sm text-slate-700">{primarySheetName}</div>
                      {sheetSummary.length > 0 ? <div className="text-xs text-slate-500">{sheetSummary.length} abas importadas</div> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{file.importBatch?.status || 'Sem lote'}</TableCell>
                  <TableCell className="text-sm text-slate-600">{file.processedAt ? format(new Date(file.processedAt), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant as BadgeProps['variant']}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[360px] text-xs text-slate-500">
                    <div>{file.importedRows}/{file.totalRows} linhas importadas</div>
                    <div>{formatWarnings(details)}</div>
                    <div>{formatQualitySummary(details)}</div>
                    {sheetSummary.slice(0, 3).map((line) => (
                      <div key={line} className="truncate" title={line}>{line}</div>
                    ))}
                    <div className="truncate" title={deferredSheets}>{deferredSheets}</div>
                    {file.errorMessage ? <div className="truncate text-red-600" title={file.errorMessage}>{file.errorMessage}</div> : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40">
                  <div className="premium-empty h-full">
                    <FileX className="h-10 w-10 text-slate-300" />
                    <p className="text-base font-medium text-slate-700">Nenhum arquivo encontrado</p>
                    <p className="text-sm text-slate-500">Ajuste o periodo ou importe novos arquivos.</p>
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

function HeroMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'blue' | 'emerald' | 'red' | 'amber' }) {
  const toneClass = {
    blue: 'from-[#022D44]/12 to-white text-[#022D44]',
    emerald: 'from-emerald-500/12 to-white text-emerald-700',
    red: 'from-red-500/12 to-white text-red-700',
    amber: 'from-amber-500/12 to-white text-amber-700',
  }[tone];
  return (
    <div className={`hero-metric-card bg-gradient-to-br ${toneClass}`}>
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/85 shadow-sm">{icon}</div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="metric-value-fluid mt-2">{value}</p>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-slate-900">{value}</p>
    </div>
  );
}

function DomainTag({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-600">{description}</p>
    </div>
  );
}
