import { ImportPipelineStatus, type ImportBatchKind, type Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { dateRangeToDbFilter, getDefaultDateRange, parseDateRangeFromSearchParams, type DateRangeStrings } from '@/lib/dateRange';

import { publishImportBatch, type PublishBatchResult } from './publisher';

type JsonRecord = Record<string, unknown>;

export type ImportBatchListStatus = ImportPipelineStatus | 'ALL';
export type ImportRowFilterStatus = ImportPipelineStatus | 'ALL' | 'ERROR_ONLY';
export type ImportRecordFilter =
  | 'ALL'
  | 'OPERATIONAL_SNAPSHOT'
  | 'FINANCIAL_ENTRY'
  | 'FINE_RECORD'
  | 'FINE_RESPONSIBILITY'
  | 'RECONCILIATION'
  | 'UNSUPPORTED';

export interface ImportMonitoringFilters {
  dateRange: DateRangeStrings;
  status: ImportBatchListStatus;
  kind: ImportBatchKind | 'ALL';
  query: string;
}

export interface ImportBatchRowFilters {
  status: ImportRowFilterStatus;
  recordType: ImportRecordFilter;
  sheet: string;
}

export interface ImportBatchListItem {
  id: string;
  batchKey: string;
  kind: ImportBatchKind;
  pipelineStatus: ImportPipelineStatus;
  processingStatus: string;
  startedAt: Date;
  validatedAt: Date | null;
  rejectedAt: Date | null;
  publishedAt: Date | null;
  fileCount: number;
  rowCount: number;
  normalizedRowCount: number;
  rejectedRowCount: number;
  publishedRowCount: number;
  validatedRows: number;
  warningCount: number;
  errorCount: number;
  importedFiles: number;
  primaryFileName: string | null;
  primarySource: string | null;
  importModes: string[];
  fileNames: string[];
}

export interface ImportBatchListResult {
  filters: ImportMonitoringFilters;
  items: ImportBatchListItem[];
  totals: {
    batches: number;
    files: number;
    rows: number;
    validatedRows: number;
    rejectedRows: number;
    publishedRows: number;
    warnings: number;
    errors: number;
  };
  availableStatuses: ImportPipelineStatus[];
}

export interface ImportBatchDetailRow {
  id: string;
  status: ImportPipelineStatus;
  recordType: string;
  rowKind: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  publishable: boolean;
  errorMessage: string | null;
  validationMessages: Array<{ code: string; severity: string; message: string; columnHeader?: string | null }>;
  publishedRecordId: string | null;
  publishedAt: Date | null;
}

export interface ImportBatchDetail {
  batch: {
    id: string;
    batchKey: string;
    kind: ImportBatchKind;
    status: string;
    pipelineStatus: ImportPipelineStatus;
    startedAt: Date;
    parsedAt: Date | null;
    validatedAt: Date | null;
    rejectedAt: Date | null;
    publishedAt: Date | null;
    completedAt: Date | null;
    fileCount: number;
    rowCount: number;
    normalizedRowCount: number;
    rejectedRowCount: number;
    publishedRowCount: number;
    templateVersion: string | null;
    errorMessage: string | null;
    validationMessages: Array<{ code: string; severity: string; message: string }>;
  };
  files: Array<{
    id: string;
    name: string;
    checksum: string;
    status: ImportPipelineStatus;
    kind: string;
    importMode: string;
    source: string;
    originalPath: string | null;
    uploadedAt: Date;
    parsedAt: Date | null;
    validatedAt: Date | null;
    rejectedAt: Date | null;
    publishedAt: Date | null;
    totalRows: number;
    parsedRows: number;
    validatedRows: number;
    rejectedRows: number;
    publishedRows: number;
    warningCount: number;
    errorCount: number;
    sourceSheets: Array<{ sheetName?: string; rowCount?: number; headerMatchesContract?: boolean }>;
  }>;
  rows: ImportBatchDetailRow[];
  summary: {
    byStatus: Array<{ status: string; count: number }>;
    byRecordType: Array<{ recordType: string; count: number }>;
    bySheet: Array<{ sheetName: string; count: number }>;
    errors: number;
    warnings: number;
    publishableRows: number;
    publishedRows: number;
  };
  finalCounts: {
    operationalSnapshots: number;
    financialEntries: number;
    fineRecords: number;
    fineResponsibilities: number;
  };
  rowFilters: ImportBatchRowFilters;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toValidationMessages(value: unknown): Array<{ code: string; severity: string; message: string; columnHeader?: string | null }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const code = typeof record.code === 'string' ? record.code : null;
    const severity = typeof record.severity === 'string' ? record.severity : null;
    const message = typeof record.message === 'string' ? record.message : null;
    if (!code || !severity || !message) return [];
    return [{
      code,
      severity,
      message,
      columnHeader: typeof record.columnHeader === 'string' ? record.columnHeader : null,
    }];
  });
}

function toSheetSummaries(value: unknown): Array<{ sheetName?: string; rowCount?: number; headerMatchesContract?: boolean }> {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      sheetName: typeof record.sheetName === 'string' ? record.sheetName : undefined,
      rowCount: typeof record.rowCount === 'number' ? record.rowCount : undefined,
      headerMatchesContract:
        typeof record.headerMatchesContract === 'boolean' ? record.headerMatchesContract : undefined,
    };
  });
}

function normalizeQuery(value: string | undefined): string {
  return (value || '').trim();
}

function normalizeListStatus(value: string | undefined): ImportBatchListStatus {
  const normalized = (value || 'ALL').trim().toUpperCase();
  return ['UPLOADED', 'PARSED', 'VALIDATED', 'REJECTED', 'PUBLISHED'].includes(normalized)
    ? (normalized as ImportPipelineStatus)
    : 'ALL';
}

function normalizeRowStatus(value: string | undefined): ImportRowFilterStatus {
  const normalized = (value || 'ERROR_ONLY').trim().toUpperCase();
  return ['ALL', 'ERROR_ONLY', 'UPLOADED', 'PARSED', 'VALIDATED', 'REJECTED', 'PUBLISHED'].includes(normalized)
    ? (normalized as ImportRowFilterStatus)
    : 'ERROR_ONLY';
}

function normalizeRecordType(value: string | undefined): ImportRecordFilter {
  const normalized = (value || 'ALL').trim().toUpperCase();
  return [
    'ALL',
    'OPERATIONAL_SNAPSHOT',
    'FINANCIAL_ENTRY',
    'FINE_RECORD',
    'FINE_RESPONSIBILITY',
    'RECONCILIATION',
    'UNSUPPORTED',
  ].includes(normalized)
    ? (normalized as ImportRecordFilter)
    : 'ALL';
}

function normalizeKind(value: string | undefined): ImportBatchKind | 'ALL' {
  const normalized = (value || 'ALL').trim().toUpperCase();
  return [
    'ALL',
    'LEGACY_TRANSACTION',
    'OPERATIONAL_SNAPSHOT',
    'FINANCIAL_LEDGER',
    'FINE_LEDGER',
    'WORKBOOK_MULTI_SHEET',
  ].includes(normalized)
    ? (normalized as ImportBatchKind | 'ALL')
    : 'ALL';
}

export function parseImportMonitoringFilters(params: {
  from?: string;
  to?: string;
  status?: string;
  kind?: string;
  q?: string;
}): ImportMonitoringFilters {
  return {
    dateRange: parseDateRangeFromSearchParams(params),
    status: normalizeListStatus(params.status),
    kind: normalizeKind(params.kind),
    query: normalizeQuery(params.q),
  };
}

export function parseImportBatchRowFilters(params: {
  rowStatus?: string;
  recordType?: string;
  sheet?: string;
}): ImportBatchRowFilters {
  return {
    status: normalizeRowStatus(params.rowStatus),
    recordType: normalizeRecordType(params.recordType),
    sheet: (params.sheet || '').trim(),
  };
}

function buildListWhere(filters: ImportMonitoringFilters): Prisma.ImportBatchWhereInput {
  const dateFilter = dateRangeToDbFilter(filters.dateRange);
  const where: Prisma.ImportBatchWhereInput = {
    startedAt: {
      gte: dateFilter.gte,
      lte: dateFilter.lte,
    },
  };

  if (filters.status !== 'ALL') {
    where.pipelineStatus = filters.status;
  }

  if (filters.kind !== 'ALL') {
    where.kind = filters.kind;
  }

  if (filters.query) {
    where.OR = [
      { batchKey: { contains: filters.query, mode: 'insensitive' } },
      {
        importFiles: {
          some: {
            OR: [
              { name: { contains: filters.query, mode: 'insensitive' } },
              { checksum: { contains: filters.query, mode: 'insensitive' } },
              { originalPath: { contains: filters.query, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  return where;
}

export async function listImportBatches(filters: ImportMonitoringFilters): Promise<ImportBatchListResult> {
  const where = buildListWhere(filters);

  const batches = await db.importBatch.findMany({
    where,
    orderBy: [{ startedAt: 'desc' }],
    include: {
      importFiles: {
        orderBy: [{ uploadedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          source: true,
          importMode: true,
          validatedRows: true,
          rejectedRows: true,
          publishedRows: true,
          warningCount: true,
          errorCount: true,
        },
      },
    },
  });

  const items = batches.map((batch) => {
    const files = batch.importFiles;
    const primaryFile = files[0] || null;

    return {
      id: batch.id,
      batchKey: batch.batchKey,
      kind: batch.kind,
      pipelineStatus: batch.pipelineStatus,
      processingStatus: batch.status,
      startedAt: batch.startedAt,
      validatedAt: batch.validatedAt,
      rejectedAt: batch.rejectedAt,
      publishedAt: batch.publishedAt,
      fileCount: batch.fileCount,
      rowCount: batch.rowCount,
      normalizedRowCount: batch.normalizedRowCount,
      rejectedRowCount: batch.rejectedRowCount,
      publishedRowCount: batch.publishedRowCount,
      validatedRows: files.reduce((acc, file) => acc + file.validatedRows, 0),
      warningCount: files.reduce((acc, file) => acc + file.warningCount, 0),
      errorCount: files.reduce((acc, file) => acc + file.errorCount, 0),
      importedFiles: files.length,
      primaryFileName: primaryFile?.name || null,
      primarySource: primaryFile?.source || null,
      importModes: Array.from(new Set(files.map((file) => file.importMode))),
      fileNames: files.map((file) => file.name),
    } satisfies ImportBatchListItem;
  });

  return {
    filters,
    items,
    totals: {
      batches: items.length,
      files: items.reduce((acc, item) => acc + item.importedFiles, 0),
      rows: items.reduce((acc, item) => acc + item.rowCount, 0),
      validatedRows: items.reduce((acc, item) => acc + item.validatedRows, 0),
      rejectedRows: items.reduce((acc, item) => acc + item.rejectedRowCount, 0),
      publishedRows: items.reduce((acc, item) => acc + item.publishedRowCount, 0),
      warnings: items.reduce((acc, item) => acc + item.warningCount, 0),
      errors: items.reduce((acc, item) => acc + item.errorCount, 0),
    },
    availableStatuses: [
      ImportPipelineStatus.UPLOADED,
      ImportPipelineStatus.PARSED,
      ImportPipelineStatus.VALIDATED,
      ImportPipelineStatus.REJECTED,
      ImportPipelineStatus.PUBLISHED,
    ],
  };
}

function buildRowWhere(batchId: string, filters: ImportBatchRowFilters): Prisma.ImportRowNormalizedWhereInput {
  const where: Prisma.ImportRowNormalizedWhereInput = { importBatchId: batchId };

  if (filters.status === 'ERROR_ONLY') {
    where.OR = [
      { errorMessage: { not: null } },
      { status: ImportPipelineStatus.REJECTED },
    ];
  } else if (filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters.recordType !== 'ALL') {
    where.recordType = filters.recordType;
  }

  if (filters.sheet) {
    where.sourceSheetName = filters.sheet;
  }

  return where;
}

export async function getImportBatchDetail(
  batchId: string,
  rowFilters: ImportBatchRowFilters,
): Promise<ImportBatchDetail> {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      batchKey: true,
      kind: true,
      status: true,
      pipelineStatus: true,
      startedAt: true,
      parsedAt: true,
      validatedAt: true,
      rejectedAt: true,
      publishedAt: true,
      completedAt: true,
      fileCount: true,
      rowCount: true,
      normalizedRowCount: true,
      rejectedRowCount: true,
      publishedRowCount: true,
      templateVersion: true,
      errorMessage: true,
      validationMessages: true,
      importFiles: {
        orderBy: [{ uploadedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          checksum: true,
          status: true,
          kind: true,
          importMode: true,
          source: true,
          originalPath: true,
          uploadedAt: true,
          parsedAt: true,
          validatedAt: true,
          rejectedAt: true,
          publishedAt: true,
          totalRows: true,
          parsedRows: true,
          validatedRows: true,
          rejectedRows: true,
          publishedRows: true,
          warningCount: true,
          errorCount: true,
          sourceSheets: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error('Batch de importacao nao encontrado');
  }

  const rowWhere = buildRowWhere(batchId, rowFilters);
  const [rows, byStatus, byRecordType, bySheet, finalCounts] = await Promise.all([
    db.importRowNormalized.findMany({
      where: rowWhere,
      orderBy: [{ sourceSheetName: 'asc' }, { sourceRowNumber: 'asc' }],
      take: 150,
      select: {
        id: true,
        status: true,
        recordType: true,
        rowKind: true,
        sourceSheetName: true,
        sourceRowNumber: true,
        publishable: true,
        errorMessage: true,
        validationMessages: true,
        publishedRecordId: true,
        publishedAt: true,
      },
    }),
    db.importRowNormalized.groupBy({
      by: ['status'],
      where: { importBatchId: batchId },
      _count: { _all: true },
    }),
    db.importRowNormalized.groupBy({
      by: ['recordType'],
      where: { importBatchId: batchId },
      _count: { _all: true },
    }),
    db.importRowNormalized.groupBy({
      by: ['sourceSheetName'],
      where: { importBatchId: batchId },
      _count: { _all: true },
    }),
    Promise.all([
      db.operationalSnapshot.count({ where: { importBatchId: batchId } }),
      db.financialEntry.count({ where: { importBatchId: batchId } }),
      db.fineRecord.count({ where: { importBatchId: batchId } }),
      db.fineResponsibility.count({ where: { importBatchId: batchId } }),
    ]),
  ]);

  const errorCount = rows.reduce((acc, row) => acc + toValidationMessages(row.validationMessages).filter((msg) => msg.severity === 'ERROR').length, 0);
  const warningCount = rows.reduce((acc, row) => acc + toValidationMessages(row.validationMessages).filter((msg) => msg.severity === 'WARNING').length, 0);

  return {
    batch: {
      id: batch.id,
      batchKey: batch.batchKey,
      kind: batch.kind,
      status: batch.status,
      pipelineStatus: batch.pipelineStatus,
      startedAt: batch.startedAt,
      parsedAt: batch.parsedAt,
      validatedAt: batch.validatedAt,
      rejectedAt: batch.rejectedAt,
      publishedAt: batch.publishedAt,
      completedAt: batch.completedAt,
      fileCount: batch.fileCount,
      rowCount: batch.rowCount,
      normalizedRowCount: batch.normalizedRowCount,
      rejectedRowCount: batch.rejectedRowCount,
      publishedRowCount: batch.publishedRowCount,
      templateVersion: batch.templateVersion,
      errorMessage: batch.errorMessage,
      validationMessages: toValidationMessages(batch.validationMessages),
    },
    files: batch.importFiles.map((file) => ({
      id: file.id,
      name: file.name,
      checksum: file.checksum,
      status: file.status,
      kind: file.kind,
      importMode: file.importMode,
      source: file.source,
      originalPath: file.originalPath,
      uploadedAt: file.uploadedAt,
      parsedAt: file.parsedAt,
      validatedAt: file.validatedAt,
      rejectedAt: file.rejectedAt,
      publishedAt: file.publishedAt,
      totalRows: file.totalRows,
      parsedRows: file.parsedRows,
      validatedRows: file.validatedRows,
      rejectedRows: file.rejectedRows,
      publishedRows: file.publishedRows,
      warningCount: file.warningCount,
      errorCount: file.errorCount,
      sourceSheets: toSheetSummaries(file.sourceSheets),
    })),
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      recordType: row.recordType,
      rowKind: row.rowKind,
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      publishable: row.publishable,
      errorMessage: row.errorMessage,
      validationMessages: toValidationMessages(row.validationMessages),
      publishedRecordId: row.publishedRecordId,
      publishedAt: row.publishedAt,
    })),
    summary: {
      byStatus: byStatus.map((entry) => ({ status: entry.status, count: entry._count._all })),
      byRecordType: byRecordType.map((entry) => ({ recordType: entry.recordType, count: entry._count._all })),
      bySheet: bySheet.map((entry) => ({ sheetName: entry.sourceSheetName, count: entry._count._all })),
      errors: errorCount,
      warnings: warningCount,
      publishableRows: rows.filter((row) => row.publishable).length,
      publishedRows: rows.filter((row) => row.status === ImportPipelineStatus.PUBLISHED).length,
    },
    finalCounts: {
      operationalSnapshots: finalCounts[0],
      financialEntries: finalCounts[1],
      fineRecords: finalCounts[2],
      fineResponsibilities: finalCounts[3],
    },
    rowFilters,
  };
}

export async function reprocessImportBatch(batchId: string): Promise<PublishBatchResult> {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, pipelineStatus: true },
  });

  if (!batch) {
    throw new Error('Batch de importacao nao encontrado');
  }

  if (
    batch.pipelineStatus !== ImportPipelineStatus.VALIDATED &&
    batch.pipelineStatus !== ImportPipelineStatus.PUBLISHED
  ) {
    throw new Error('Somente batches validados ou publicados podem ser reprocessados');
  }

  await db.$transaction(async (tx) => {
    await tx.importRowNormalized.updateMany({
      where: {
        importBatchId: batchId,
        publishable: true,
      },
      data: {
        status: ImportPipelineStatus.VALIDATED,
        publishedRecordId: null,
        publishedAt: null,
      },
    });

    await tx.importFile.updateMany({
      where: { importBatchId: batchId },
      data: {
        status: ImportPipelineStatus.VALIDATED,
        publishedAt: null,
        publishedRows: 0,
      },
    });

    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        pipelineStatus: ImportPipelineStatus.VALIDATED,
        publishedAt: null,
        publishedRowCount: 0,
      },
    });
  });

  return publishImportBatch(batchId);
}

export function getDefaultImportMonitoringFilters(): ImportMonitoringFilters {
  return {
    dateRange: getDefaultDateRange(),
    status: 'ALL',
    kind: 'ALL',
    query: '',
  };
}
