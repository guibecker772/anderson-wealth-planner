import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { prepareWorkbookImport, stageWorkbookImport as persistWorkbookImport } from './ingestion';
import {
  ensureFolders,
  listInboxFiles,
  resolveImportRoot,
  type EffectiveSourceMode,
  type ImportMode,
  type ParseWorkbookResult,
  type SourceFileKind,
} from './localImporter';

type ImportPipelineStatusValue = 'UPLOADED' | 'PARSED' | 'VALIDATED' | 'REJECTED' | 'PUBLISHED';

export interface StagingUploadInput {
  fileName: string;
  buffer: Buffer;
  lastModified?: Date | null;
  clientContext?: {
    effectiveSourceMode?: 'DEVICE_FOLDER' | 'MANUAL_UPLOAD' | 'AUTO_FOLDER';
    rootLabel?: string | null;
    relativePath?: string | null;
  } | null;
}

export interface StagingFileReport {
  file: string;
  hash: string;
  kind: SourceFileKind;
  importMode: ImportMode;
  effectiveSourceMode: EffectiveSourceMode;
  totalRows: number;
  parsedRows: number;
  validatedRows: number;
  rejectedRows: number;
  importedRows: number;
  skippedRows: number;
  warningCount: number;
  errorCount: number;
  archivePeriod: string | null;
  status: 'PROCESSED' | 'ERROR' | 'SKIPPED';
  reusedExistingFile: boolean;
  message: string;
  warnings: string[];
}

export interface StagingImportSummary {
  ok: boolean;
  importedFiles: number;
  importedRows: number;
  skippedFiles: number;
  skippedRows: number;
  rejectedRows: number;
  errors: Array<{ file: string; message: string }>;
  files: StagingFileReport[];
}

export interface StageWorkbookImportResult {
  batchId: string;
  batchKey: string;
  fileId: string;
  fileChecksum: string;
  kind: SourceFileKind;
  status: ImportPipelineStatusValue;
  totalRowsRead: number;
  stagedRawRows: number;
  stagedNormalizedRows: number;
  parsedRows: number;
  validatedRows: number;
  rejectedRows: number;
  warningCount: number;
  errorCount: number;
  idempotentSkip: boolean;
}

export interface ValidationMessage {
  level: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface RawStagingRowDraft {
  recordType: string;
  rowKind: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  headerFingerprint: string | null;
  rawLineKey: string;
  dedupeKey: string | null;
  businessKey: string | null;
  rawPayload: Record<string, unknown>;
  validationMessages: ValidationMessage[];
  status: 'PARSED' | 'VALIDATED' | 'REJECTED';
  errorMessage: string | null;
}

export interface StagingRowDraft {
  recordType: 'OPERATIONAL_SNAPSHOT' | 'FINANCIAL_ENTRY' | 'FINE_RECORD';
  rowKind: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  rawLineKey: string;
  normalizedLineKey: string;
  dedupeKey: string;
  businessKey: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  validationMessages: ValidationMessage[];
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value ?? null;
}

function uniqueMessages(messages: ValidationMessage[]): ValidationMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = JSON.stringify([message.level, message.code, message.message, message.meta ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toValidationMessage(message: Awaited<ReturnType<typeof prepareWorkbookImport>>['validationMessages'][number]): ValidationMessage {
  return {
    level: message.severity,
    code: message.code,
    message: message.message,
    meta: {
      sheetName: message.sheetName || null,
      rowNumber: message.rowNumber || null,
      columnHeader: message.columnHeader || null,
    },
  };
}

export function buildRawLineKey(
  sourceFileChecksum: string,
  sourceSheetName: string,
  sourceRowNumber: number,
  rawPayload: Record<string, unknown>,
): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([sourceFileChecksum, sourceSheetName, sourceRowNumber, stableValue(rawPayload)]))
    .digest('hex');
}

export function buildNormalizedLineKey(
  rawLineKey: string,
  normalizedPayload: Record<string, unknown>,
  recordType?: string,
): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([rawLineKey, recordType || null, stableValue(normalizedPayload)]))
    .digest('hex');
}

function toEffectiveSourceMode(input?: StagingUploadInput | null, automatic = false): EffectiveSourceMode {
  if (automatic) return 'AUTO_FOLDER';
  return input?.clientContext?.effectiveSourceMode === 'DEVICE_FOLDER' ? 'DEVICE_FOLDER' : 'MANUAL_UPLOAD';
}

function resultToReport(
  fileName: string,
  result: StageWorkbookImportResult,
  importMode: ImportMode,
  effectiveSourceMode: EffectiveSourceMode,
): StagingFileReport {
  return {
    file: fileName,
    hash: result.fileChecksum,
    kind: result.kind,
    importMode,
    effectiveSourceMode,
    totalRows: result.totalRowsRead,
    parsedRows: result.parsedRows,
    validatedRows: result.validatedRows,
    rejectedRows: result.rejectedRows,
    importedRows: result.stagedNormalizedRows,
    skippedRows: result.idempotentSkip ? result.totalRowsRead : Math.max(result.stagedRawRows - result.stagedNormalizedRows, 0),
    warningCount: result.warningCount,
    errorCount: result.errorCount,
    archivePeriod: null,
    status: result.idempotentSkip ? 'SKIPPED' : result.status === 'REJECTED' ? 'ERROR' : 'PROCESSED',
    reusedExistingFile: result.idempotentSkip,
    message: result.idempotentSkip
      ? 'Arquivo ja processado anteriormente em staging'
      : result.status === 'REJECTED'
        ? 'Arquivo rejeitado na validacao de staging'
        : `${result.stagedNormalizedRows} linha(s) validada(s) em staging`,
    warnings: [],
  };
}

function appendSummary(summary: StagingImportSummary, report: StagingFileReport) {
  summary.files.push(report);

  if (report.status === 'SKIPPED') {
    summary.skippedFiles += 1;
    summary.skippedRows += report.skippedRows;
    return;
  }

  if (report.status === 'ERROR') {
    summary.ok = false;
    summary.rejectedRows += report.rejectedRows;
    summary.errors.push({ file: report.file, message: report.message });
    return;
  }

  summary.importedFiles += 1;
  summary.importedRows += report.importedRows;
  summary.rejectedRows += report.rejectedRows;
  summary.skippedRows += report.skippedRows;
}

export async function extractRawWorkbookRowsForTest(buffer: Buffer, checksum: string) {
  const prepared = await prepareWorkbookImport({
    fileName: 'staging-test-workbook.xlsm',
    buffer,
  });

  return {
    fileMessages: [],
    rawRows: prepared.rawRows.map<RawStagingRowDraft>((row) => ({
      recordType: row.recordType,
      rowKind: row.rowKind,
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      headerFingerprint: row.headerFingerprint,
      rawLineKey: row.rawLineKey || buildRawLineKey(checksum, row.sourceSheetName, row.sourceRowNumber, row.rawPayload as Record<string, unknown>),
      dedupeKey: row.dedupeKey,
      businessKey: row.businessKey,
      rawPayload: row.rawPayload as Record<string, unknown>,
      validationMessages: row.validationMessages.map(toValidationMessage),
      status: row.errorMessage ? 'REJECTED' : 'PARSED',
      errorMessage: row.errorMessage,
    })),
  };
}

export function buildStagingRowsFromParsedWorkbook(
  _parsed: ParseWorkbookResult,
  _checksum: string,
  rawRows: RawStagingRowDraft[],
): StagingRowDraft[] {
  return rawRows
    .filter(
      (row) =>
        row.status !== 'REJECTED' &&
        row.rowKind === 'DETAIL' &&
        (row.recordType === 'OPERATIONAL_SNAPSHOT' ||
          row.recordType === 'FINANCIAL_ENTRY' ||
          row.recordType === 'FINE_RECORD'),
    )
    .map((row) => ({
      recordType: row.recordType as 'OPERATIONAL_SNAPSHOT' | 'FINANCIAL_ENTRY' | 'FINE_RECORD',
      rowKind: row.rowKind,
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      rawLineKey: row.rawLineKey,
      normalizedLineKey: buildNormalizedLineKey(row.rawLineKey, row.rawPayload, row.recordType),
      dedupeKey: row.dedupeKey || '',
      businessKey: row.businessKey || '',
      rawPayload: row.rawPayload,
      normalizedPayload: row.rawPayload,
      validationMessages: row.validationMessages,
    }));
}

export function reconcileStagingDraftsForTest(rawRows: RawStagingRowDraft[], normalizedRows: StagingRowDraft[]) {
  const normalizedLineKeys = new Set(normalizedRows.map((row) => row.rawLineKey));

  return {
    normalizedRows,
    rawRows: rawRows.map<RawStagingRowDraft>((row) => {
      if (normalizedLineKeys.has(row.rawLineKey)) {
        return { ...row, status: 'VALIDATED' };
      }

      if (row.rowKind === 'SECTION_LABEL' || row.rowKind === 'SUBTOTAL' || row.rowKind === 'RECONCILIATION') {
        return { ...row, status: 'PARSED' };
      }

      return {
        ...row,
        status: 'REJECTED',
        validationMessages: uniqueMessages([
          ...row.validationMessages,
          {
            level: 'ERROR',
            code: 'raw-only-row',
            message: 'Linha permaneceu apenas no staging bruto.',
          },
        ]),
      };
    }),
  };
}

export async function stageWorkbookImport(params: {
  fileName: string;
  buffer: Buffer;
  importMode: ImportMode;
  batchKey?: string | null;
  originalPath?: string | null;
  lastModified?: Date | null;
}): Promise<StageWorkbookImportResult> {
  const prepared = await prepareWorkbookImport({
    fileName: params.fileName,
    buffer: params.buffer,
    importMode: params.importMode,
    originalPath: params.originalPath,
    now: params.lastModified || undefined,
  });
  const persisted = await persistWorkbookImport({
    fileName: params.fileName,
    buffer: params.buffer,
    importMode: params.importMode,
    originalPath: params.originalPath,
  });

  return {
    batchId: persisted.batchId,
    batchKey: params.batchKey || `staging:${params.importMode.toLowerCase()}`,
    fileId: persisted.fileId,
    fileChecksum: persisted.checksum,
    kind: prepared.file.kind,
    status: persisted.status,
    totalRowsRead: prepared.file.totalRows,
    stagedRawRows: prepared.rawRows.length,
    stagedNormalizedRows: prepared.normalizedRows.filter((row) => row.publishable).length,
    parsedRows: prepared.file.parsedRows,
    validatedRows: prepared.file.validatedRows,
    rejectedRows: prepared.file.rejectedRows,
    warningCount: prepared.file.warningCount,
    errorCount: prepared.file.errorCount,
    idempotentSkip: persisted.reusedExistingFile,
  };
}

export async function stageUploadedFiles(inputs: StagingUploadInput[]): Promise<StagingImportSummary> {
  const summary: StagingImportSummary = {
    ok: true,
    importedFiles: 0,
    importedRows: 0,
    skippedFiles: 0,
    skippedRows: 0,
    rejectedRows: 0,
    errors: [],
    files: [],
  };

  for (const input of inputs) {
    const result = await stageWorkbookImport({
      fileName: input.fileName,
      buffer: input.buffer,
      importMode: 'MANUAL_UPLOAD',
      originalPath: input.clientContext?.relativePath || null,
    });

    appendSummary(summary, resultToReport(input.fileName, result, 'MANUAL_UPLOAD', toEffectiveSourceMode(input)));
  }

  return summary;
}

export async function runStagingImport(explicitBasePath?: string | null): Promise<StagingImportSummary> {
  const config = resolveImportRoot(explicitBasePath);
  const summary: StagingImportSummary = {
    ok: true,
    importedFiles: 0,
    importedRows: 0,
    skippedFiles: 0,
    skippedRows: 0,
    rejectedRows: 0,
    errors: [],
    files: [],
  };

  if (!config.basePath) {
    summary.ok = false;
    summary.errors.push({ file: 'general', message: 'IMPORT_ROOT_FOLDER/LOCAL_IMPORT_FOLDER nao configurado' });
    return summary;
  }

  await ensureFolders(config.basePath);
  const files = await listInboxFiles(config.basePath);

  for (const filePath of files) {
    const buffer = await fs.readFile(filePath);
    const result = await stageWorkbookImport({
      fileName: path.basename(filePath),
      buffer,
      importMode: 'AUTO_FOLDER' as ImportMode,
      originalPath: filePath,
    });

    appendSummary(summary, resultToReport(path.basename(filePath), result, 'AUTO_FOLDER', toEffectiveSourceMode(null, true)));
  }

  return summary;
}

export { prepareWorkbookImport };
