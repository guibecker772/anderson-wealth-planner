import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { parseExcelDate, parseCurrency, parseBoolean } from '../parsers/common';
import {
  buildRawLabel,
} from '../normalization/categoryNormalization';

type TransactionType = 'PAYABLE' | 'RECEIVABLE';
type TransactionStatus = 'PENDING' | 'SETTLED';
type CategorySource = 'RAW' | 'NORMALIZED' | 'MANUAL';
type FinancialEntryDomain = 'REVENUE' | 'EXPENSE' | 'INVESTMENT';
type FinancialEntryDirection = 'INFLOW' | 'OUTFLOW';
type FinePaymentState = 'UNKNOWN' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CONTESTED' | 'CANCELLED';
export type ImportMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD';
export type EffectiveSourceMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD' | 'DEVICE_FOLDER';
export type SourceFileKind = 'OPERATIONAL' | 'FINES' | 'FINANCIAL' | 'WORKBOOK' | 'UNKNOWN';
type FinePayer = 'COMPANY' | 'OWNER' | 'DRIVER' | 'UNKNOWN';

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xlsm']);
const OFFICIAL_WORKBOOK_SHEETS = {
  operational: 'planilha teste carros',
  revenue: 'Receita',
  expense: 'Despesa',
  investment: 'Investimentos',
  fines: 'Multas',
  responsibility: 'Quem Pagou',
  reconciliation: 'Lucro',
} as const;
const IGNORED_SHEET_TOKENS = ['grafico', 'gráfico', 'resumo', 'dashboard', 'total', 'apoio', 'auxiliar', 'planilha4'];
const PREFERRED_OPERATIONAL_SHEET_TOKENS = ['planilha teste carros'];
const PREFERRED_FINE_SHEET_TOKENS = ['pagina1', 'pagina 1', 'página1', 'página 1'];
const VEHICLE_OPERATIONAL_CATEGORY = 'Locação de Veículo';

const OPERATIONAL_PAYABLE_KEYWORDS = ['pagar', 'despesa', 'fornecedor', 'pagamentos', 'payable', 'saida', 'saidas'];
const OPERATIONAL_RECEIVABLE_KEYWORDS = [
  'receber',
  'receita',
  'cliente',
  'entradas',
  'faturamento',
  'income',
  'receivable',
  'carro',
  'carros',
  'veiculo',
  'veiculos',
  'frota',
];
const FINES_KEYWORDS = ['multa', 'multas', 'infracao', 'infração', 'ait', 'detran', 'correios', 'relatorio de infracao', 'relatório de infração'];

const MONTH_NAME_MAP: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const OPERATIONAL_FIELD_ALIASES: Record<string, string[]> = {
  externalId: ['lancamento', 'numero do lancamento', 'numero lancamento', 'numero', 'documento', 'id'],
  category: ['categoria', 'classe', 'classificacao', 'classificação'],
  counterparty: ['fornecedor', 'cliente', 'favorecido', 'nome', 'sacado'],
  description: ['descricao', 'descrição', 'historico', 'histórico', 'observacao', 'observação', 'detalhe', 'memo'],
  unit: ['unidade', 'centro de custo'],
  plate: ['placa', 'veiculo', 'veículo'],
  owner: ['proprietario', 'proprietário', 'investidor'],
  driver: ['motorista', 'condutor'],
  plannedDate: ['data prevista', 'competencia', 'competência', 'data', 'prevista'],
  dueDate: ['vencimento', 'data vencimento'],
  actualDate: ['pagamento', 'recebimento', 'data pagamento', 'data recebimento', 'data baixa', 'baixado em', 'liquidacao', 'liquidação'],
  plannedAmount: ['valor previsto', 'valor do titulo', 'valor do título', 'valor original', 'valor', 'previsto', 'total'],
  actualAmount: ['valor pago', 'valor recebido', 'valor realizado', 'valor baixado'],
  feesInterest: ['juros'],
  feesFine: ['multa'],
  discount: ['desconto'],
  grossAmount: ['valor bruto', 'bruto'],
  status: ['status', 'situacao', 'situação'],
  isPaid: ['pago', 'recebido', 'baixado', 'liquidado'],
  week: ['semana'],
  contractActive: ['contrato ativo'],
  vehicleStatus: ['situacao de veiculo', 'situação de veículo'],
  model: ['modelo'],
  contractValue: ['valor contrato'],
  lateFine: ['multa atraso', 'multa/atraso'],
  amountToCharge: ['valor a cobrar', 'valor à cobrar'],
  maintenanceByDriver: ['manutencao por motorista', 'manutenção por motorista'],
  paidWeekValue: ['valor pago semana', 'valor pago (semana)'],
  fineComponent: ['multa'],
};

const FINE_FIELD_ALIASES: Record<string, string[]> = {
  infractionDate: ['data infracao', 'data infração', 'data autuacao', 'data autuação', 'data multa', 'data ocorrência', 'data ocorrencia', 'data'],
  dueDate: ['vencimento', 'prazo', 'data vencimento'],
  actualDate: ['pagamento', 'data pagamento', 'quitacao', 'quitação'],
  amount: ['valor multa', 'valor', 'valor original', 'total', 'valor devido'],
  actualAmount: ['valor pago', 'valor quitado'],
  plate: ['placa', 'veiculo', 'veículo'],
  owner: ['proprietario', 'proprietário', 'investidor'],
  driver: ['motorista', 'condutor'],
  ait: ['ait', 'auto de infracao', 'auto de infração', 'numero ait', 'n ait', 'codigo ait', 'código ait'],
  payer: ['pago por', 'pagador', 'responsavel', 'responsável', 'quem pagou', 'pago para', 'pago para?'],
  status: ['status', 'situacao', 'situação', 'quitado'],
  counterparty: ['orgao', 'órgão', 'emissor', 'local', 'cidade', 'origem'],
  description: ['descricao', 'descrição', 'motivo', 'detalhe', 'observacao', 'observação', 'enquadramento', 'historico', 'histórico'],
  vehicle: ['veiculo'],
  renavam: ['renavam'],
};
FINE_FIELD_ALIASES.status.push('paga');

const FINANCIAL_FIELD_ALIASES: Record<string, string[]> = {
  group: ['origem', 'tipo de gasto', 'investimento'],
  amount: ['valor r$', 'valor', 'valor rs'],
  account: ['destino', 'fonte'],
  entryDate: ['data'],
  month: ['mes', 'mÃªs'],
  year: ['ano'],
  detail: ['detalhamento'],
  category: ['categoria'],
};

export interface ImportLogEntry {
  id: string;
  name: string;
  hash: string;
  status: 'PENDING' | 'PROCESSED' | 'ERROR';
  processedAt: Date | null;
  kind: SourceFileKind;
  importMode: ImportMode;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorCount: number;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
}

export interface FolderStatus {
  configured: boolean;
  configSource: 'IMPORT_ROOT_FOLDER' | 'LOCAL_IMPORT_FOLDER' | 'UNCONFIGURED';
  requiresSecret: boolean;
  exists: boolean;
  path: string | null;
  folders: {
    root: string | null;
    inbox: string | null;
    processed: string | null;
    error: string | null;
    archive: string | null;
  };
  inboxCount: number;
  processedCount: number;
  errorCount: number;
  archiveCount: number;
  lastRun: Date | null;
  lastFileName: string | null;
  recentFiles: ImportLogEntry[];
}

export interface ImportFileReport {
  file: string;
  hash: string;
  kind: SourceFileKind;
  importMode: ImportMode;
  effectiveSourceMode: EffectiveSourceMode;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorCount: number;
  archivePeriod: string | null;
  status: 'PROCESSED' | 'ERROR' | 'SKIPPED';
  message: string;
  warnings: string[];
}

export interface ImportSummary {
  ok: boolean;
  importedFiles: number;
  importedRows: number;
  skippedFiles: number;
  skippedRows: number;
  errors: { file: string; message: string }[];
  files: ImportFileReport[];
}

interface ParsedRow {
  externalId: string | null;
  category: string | null;
  counterparty: string | null;
  description: string | null;
  unit: string | null;
  plannedDate: Date | null;
  dueDate: Date | null;
  actualDate: Date | null;
  plannedAmount: number;
  actualAmount: number | null;
  feesInterest: number | null;
  feesFine: number | null;
  discount: number | null;
  grossAmount: number | null;
  status: TransactionStatus;
  type: TransactionType;
  rawJson: Record<string, unknown>;
  rowHash: string;
  rawLabel: string | null;
  categorySource: CategorySource;
  normalizedByRuleId: string | null;
  normalizedAt: Date | null;
  sourceRowNumber: number;
  sheetName: string;
  operationalSnapshot: ParsedOperationalSnapshotRow | null;
}

export interface ParsedOperationalSnapshotRow {
  operationalKey: string;
  sheetName: string;
  sourceRowNumber: number;
  referenceDate: Date;
  referenceYear: number;
  referenceMonth: number;
  weekOfMonth: number | null;
  contractActiveRaw: string | null;
  contractActive: boolean | null;
  vehicleStatusRaw: string | null;
  vehicleStatusNormalized: string | null;
  paymentStatusRaw: string | null;
  paymentState: 'UNKNOWN' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  plateRaw: string | null;
  plate: string;
  modelRaw: string | null;
  model: string | null;
  investorRaw: string | null;
  investorNormalized: string | null;
  driverRaw: string | null;
  driverNormalized: string | null;
  contractValue: number | null;
  lateFeeAmount: number | null;
  discountAmount: number | null;
  amountToCharge: number | null;
  maintenanceByDriverAmount: number | null;
  amountPaidWeek: number | null;
  openAmount: number | null;
  rawJson: Record<string, unknown>;
}

interface NumericCellResult {
  value: number | null;
  raw: unknown;
  invalid: boolean;
  missing: boolean;
}

type OperationalQualityStatus = 'OK' | 'WARNING' | 'REVIEW_REQUIRED';

interface OperationalQualityAssessment {
  status: OperationalQualityStatus;
  reasons: string[];
  recommendedAggregateHandling: 'include_with_flag';
}

interface UploadedImportInput {
  fileName: string;
  buffer: Buffer;
  lastModified?: Date | null;
  clientContext?: UploadClientContext | null;
}

interface ImportRootConfig {
  basePath: string | null;
  source: 'IMPORT_ROOT_FOLDER' | 'LOCAL_IMPORT_FOLDER' | 'UNCONFIGURED';
}

interface ImportFolders {
  root: string;
  inbox: string;
  processed: string;
  error: string;
  archive: string;
}

interface WorksheetCandidate {
  worksheet: ExcelJS.Worksheet;
  headerRowIndex: number;
  headers: string[];
  normalizedHeaders: string[];
  operationalMap: Record<string, number>;
  finesMap: Record<string, number>;
  financialMap: Record<string, number>;
  operationalScore: number;
  finesScore: number;
  financialScore: number;
  kind: SourceFileKind;
}

export interface ParsedFinancialEntryRow {
  entryKey: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  domain: FinancialEntryDomain;
  direction: FinancialEntryDirection;
  entryDate: Date;
  referenceYear: number;
  referenceMonth: number;
  groupRaw: string | null;
  groupNormalized: string | null;
  detailRaw: string | null;
  categoryRaw: string | null;
  accountRaw: string | null;
  amount: number;
  rawJson: Record<string, unknown>;
}

export interface ParsedFineRecordRow {
  fineKey: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  infractionDate: Date;
  referenceYear: number;
  referenceMonth: number;
  issuingAuthorityRaw: string | null;
  driverRaw: string | null;
  driverNormalized: string | null;
  paymentStatusRaw: string | null;
  paymentState: FinePaymentState;
  amount: number | null;
  plateRaw: string | null;
  plate: string;
  aitRaw: string | null;
  ait: string | null;
  vehicleRaw: string | null;
  rawJson: Record<string, unknown>;
}

export interface SheetImportSummary {
  sheetName: string;
  domain: 'OPERATIONAL' | 'FINANCIAL' | 'FINES' | 'RESPONSIBILITY' | 'RECONCILIATION';
  totalRowsRead: number;
  parsedRows: number;
  warnings: string[];
  importedRows?: number;
  skippedRows?: number;
  note?: string | null;
}

export interface ParseWorkbookResult {
  rows: ParsedRow[];
  operationalRows: ParsedOperationalSnapshotRow[];
  financialRows: ParsedFinancialEntryRow[];
  fineRows: ParsedFineRecordRow[];
  kind: SourceFileKind;
  sheetNames: string[];
  warnings: string[];
  totalRowsRead: number;
  archivePeriod: string;
  detectionReasons: string[];
  sheetSummaries: SheetImportSummary[];
  deferredSheets: Array<{ sheetName: string; reason: string }>;
}

interface UploadClientContext {
  effectiveSourceMode?: EffectiveSourceMode;
  rootLabel?: string | null;
  relativePath?: string | null;
}

interface ImportBatchContext {
  id: string;
  batchKey: string;
  startedAt: Date;
}

interface YearHint {
  year: number;
  source: 'file-name' | 'worksheet-context' | 'import-batch';
}

interface OperationalDateResolution {
  date: Date | null;
  metadata: Record<string, unknown>;
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collapseWhitespace(value: string | null | undefined): string | null {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeDisplayName(value: string | null | undefined): string | null {
  const clean = collapseWhitespace(value);
  return clean ? toTitleCase(clean) : null;
}

export function normalizeOwnerName(value: string | null | undefined): string | null {
  const clean = collapseWhitespace(value);
  if (!clean) return null;

  const parts = clean
    .split(/[\/|]/)
    .map((part) => collapseWhitespace(part))
    .filter((part): part is string => Boolean(part));

  const normalizedParts = parts.map((part) => normalizeText(part));
  const nonCompanyPart = parts.find((part, index) => {
    const normalized = normalizedParts[index];
    return !normalized.includes('clikcar') && !normalized.includes('clickcar');
  });

  if (nonCompanyPart) {
    return toTitleCase(nonCompanyPart);
  }

  if (normalizeText(clean) === 'clikcar victor' || normalizeText(clean) === 'clickcar victor') {
    return 'Victor';
  }

  return toTitleCase(clean);
}

function normalizePlate(value: string | null | undefined): string | null {
  const clean = collapseWhitespace(value);
  if (!clean) return null;
  const normalized = clean.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 7 ? normalized : null;
}

function parseWeekNumber(value: unknown): number | null {
  const raw = String(getCellValue(value) || '').trim();
  if (!raw) return null;

  const numericValue = Number(raw);
  if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 5) {
    return numericValue;
  }

  const match = raw.match(/([1-5])/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return parsed >= 1 && parsed <= 5 ? parsed : null;
}

function extractMonthNumber(value: string | null): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  for (const [token, month] of Object.entries(MONTH_NAME_MAP)) {
    if (normalized.includes(token)) {
      return month;
    }
  }

  return null;
}

function inferYearFromFileName(fileName: string): number | null {
  const matches = fileName.match(/20\d{2}/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  return Number(matches[matches.length - 1]);
}

function inferYearFromWorksheetContext(candidate: WorksheetCandidate): number | null {
  const maxRows = Math.min(candidate.worksheet.rowCount, Math.max(candidate.headerRowIndex + 3, 20));

  for (let rowIndex = 1; rowIndex <= maxRows; rowIndex += 1) {
    const row = candidate.worksheet.getRow(rowIndex);
    const values = (row.values as unknown[]).slice(1, 21);

    for (const value of values) {
      const cellValue = getCellValue(value);
      if (cellValue instanceof Date && !Number.isNaN(cellValue.getTime())) {
        return cellValue.getFullYear();
      }

      const text = String(cellValue || '').trim();
      if (!text) continue;

      const explicitYear = text.match(/20\d{2}/);
      if (explicitYear) {
        return Number(explicitYear[0]);
      }

      const parsedDate = parseExcelDate(text);
      if (parsedDate) {
        return parsedDate.getFullYear();
      }
    }
  }

  return null;
}

function inferYearHint(fileName: string, candidate: WorksheetCandidate, importDate: Date): YearHint {
  const fromFileName = inferYearFromFileName(fileName);
  if (fromFileName) {
    return { year: fromFileName, source: 'file-name' };
  }

  const fromWorksheet = inferYearFromWorksheetContext(candidate);
  if (fromWorksheet) {
    return { year: fromWorksheet, source: 'worksheet-context' };
  }

  return {
    year: importDate.getFullYear(),
    source: 'import-batch',
  };
}

function buildDateInferenceMetadata(params: {
  originalDate: unknown;
  originalWeek: unknown;
  date: Date | null;
  inferred: boolean;
  strategy: string;
  yearSource: YearHint['source'] | null;
  monthText?: string | null;
  weekNumber?: number | null;
}): Record<string, unknown> {
  return {
    originalDate: params.originalDate ?? null,
    originalWeek: params.originalWeek ?? null,
    resolvedDate: params.date ? params.date.toISOString().slice(0, 10) : null,
    inferred: params.inferred,
    strategy: params.strategy,
    yearSource: params.yearSource,
    monthText: params.monthText || null,
    weekNumber: params.weekNumber ?? null,
  };
}

export function resolveOperationalDate(params: {
  rawDate: unknown;
  rawWeek: unknown;
  fileName: string;
  candidate: WorksheetCandidate;
  importDate: Date;
}): OperationalDateResolution {
  const parsedDate = parseExcelDate(params.rawDate);
  if (parsedDate) {
    return {
      date: parsedDate,
      metadata: buildDateInferenceMetadata({
        originalDate: params.rawDate,
        originalWeek: params.rawWeek,
        date: parsedDate,
        inferred: false,
        strategy: 'direct-date',
        yearSource: null,
      }),
    };
  }

  const rawDateText = stringValue(params.rawDate);
  const monthNumber = extractMonthNumber(rawDateText);
  if (!monthNumber) {
    return {
      date: null,
      metadata: buildDateInferenceMetadata({
        originalDate: params.rawDate,
        originalWeek: params.rawWeek,
        date: null,
        inferred: false,
        strategy: 'unresolved',
        yearSource: null,
      }),
    };
  }

  const yearHint = inferYearHint(params.fileName, params.candidate, params.importDate);
  const weekNumber = parseWeekNumber(params.rawWeek);
  const dayByWeek = weekNumber ? ({ 1: 1, 2: 8, 3: 15, 4: 22, 5: 29 } as const)[weekNumber] : 1;
  const inferredDate = new Date(yearHint.year, monthNumber - 1, dayByWeek ?? 1);

  return {
    date: inferredDate,
    metadata: buildDateInferenceMetadata({
      originalDate: params.rawDate,
      originalWeek: params.rawWeek,
      date: inferredDate,
      inferred: true,
      strategy: weekNumber ? 'month-text-plus-week' : 'month-text-fallback-first-day',
      yearSource: yearHint.source,
      monthText: rawDateText,
      weekNumber,
    }),
  };
}

function normalizeFinePayer(value: string | null | undefined): FinePayer {
  const normalized = normalizeText(value);
  if (!normalized) return 'UNKNOWN';
  if (normalized.includes('motorista') || normalized.includes('condutor')) return 'DRIVER';
  if (normalized.includes('proprietario') || normalized.includes('investidor') || normalized.includes('locador')) {
    return 'OWNER';
  }
  if (normalized.includes('clikcar') || normalized.includes('clickcar') || normalized.includes('empresa')) {
    return 'COMPANY';
  }
  return 'UNKNOWN';
}

function finePayerLabel(value: FinePayer): string {
  switch (value) {
    case 'COMPANY':
      return 'Clickcar';
    case 'OWNER':
      return 'Proprietário';
    case 'DRIVER':
      return 'Motorista';
    default:
      return 'Indefinido';
  }
}

export function resolveImportRoot(explicitBasePath?: string | null): ImportRootConfig {
  if (explicitBasePath) {
    return {
      basePath: path.normalize(explicitBasePath),
      source: 'IMPORT_ROOT_FOLDER',
    };
  }

  if (process.env.IMPORT_ROOT_FOLDER) {
    return {
      basePath: path.normalize(process.env.IMPORT_ROOT_FOLDER),
      source: 'IMPORT_ROOT_FOLDER',
    };
  }

  if (process.env.LOCAL_IMPORT_FOLDER) {
    return {
      basePath: path.normalize(process.env.LOCAL_IMPORT_FOLDER),
      source: 'LOCAL_IMPORT_FOLDER',
    };
  }

  return {
    basePath: null,
    source: 'UNCONFIGURED',
  };
}

function getFolders(basePath: string): ImportFolders {
  const root = path.normalize(basePath);
  return {
    root,
    inbox: path.join(root, 'inbox'),
    processed: path.join(root, 'processed'),
    error: path.join(root, 'error'),
    archive: path.join(root, 'archive'),
  };
}

export async function ensureFolders(basePath: string): Promise<void> {
  const folders = getFolders(basePath);
  await Promise.all(
    Object.values(folders).map(async (folderPath) => {
      await fs.mkdir(folderPath, { recursive: true });
    })
  );
}

function isSupportedImportFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext) && !fileName.startsWith('~$');
}

async function countFilesInFolder(folderPath: string, recursive = false): Promise<number> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          count += await countFilesInFolder(fullPath, true);
        }
        continue;
      }

      if (isSupportedImportFile(entry.name)) {
        count += 1;
      }
    }

    return count;
  } catch {
    return 0;
  }
}

export async function listInboxFiles(basePath: string): Promise<string[]> {
  const folders = getFolders(basePath);

  try {
    const files = await fs.readdir(folders.inbox);
    return files
      .filter((fileName) => isSupportedImportFile(fileName))
      .map((fileName) => path.join(folders.inbox, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function computeFileHashFromBuffer(buffer: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return computeFileHashFromBuffer(buffer);
}

function getCellValue(rawValue: unknown): unknown {
  if (rawValue == null) return null;

  if (typeof rawValue === 'object') {
    const candidate = rawValue as {
      result?: unknown;
      text?: string;
      richText?: Array<{ text?: string }>;
    };

    if (candidate.result !== undefined) return candidate.result;
    if (candidate.text !== undefined) return candidate.text;
    if (candidate.richText) {
      return candidate.richText.map((part) => part.text || '').join('');
    }
  }

  return rawValue;
}

function isRowEmpty(values: unknown[]): boolean {
  return values.every((value) => collapseWhitespace(String(getCellValue(value) || '')) === null);
}

function looksLikeTotalRow(firstCell: unknown): boolean {
  const normalized = normalizeText(String(getCellValue(firstCell) || ''));
  return normalized === 'total' || normalized.startsWith('subtotal');
}

function normalizeHeaderValue(value: unknown): string {
  return normalizeText(String(getCellValue(value) || ''));
}

function buildHeaderMap(headers: string[], aliases: Record<string, string[]>): Record<string, number> {
  const map: Record<string, number> = {};

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const normalizedAliases = fieldAliases.map((alias) => normalizeText(alias));
    const exactIndex = headers.findIndex((header) => normalizedAliases.includes(header));
    const containsIndex =
      exactIndex >= 0
        ? exactIndex
        : headers.findIndex((header) => normalizedAliases.some((alias) => (header || '').includes(alias)));
    const index = containsIndex;
    if (index >= 0) {
      map[field] = index;
    }
  }

  return map;
}

function scoreOperationalMap(map: Record<string, number>, fileName: string, sheetName: string): number {
  let score = 0;
  const criticalFields = [
    'plannedAmount',
    'description',
    'counterparty',
    'plannedDate',
    'dueDate',
    'actualDate',
    'category',
    'plate',
    'owner',
    'driver',
    'contractValue',
    'amountToCharge',
    'paidWeekValue',
  ];
  for (const field of criticalFields) {
    if (map[field] !== undefined) score += 1;
  }

  const descriptor = `${normalizeText(fileName)} ${normalizeText(sheetName)}`;
  if (OPERATIONAL_PAYABLE_KEYWORDS.some((keyword) => descriptor.includes(keyword))) score += 1;
  if (OPERATIONAL_RECEIVABLE_KEYWORDS.some((keyword) => descriptor.includes(keyword))) score += 1;
  if (PREFERRED_OPERATIONAL_SHEET_TOKENS.some((token) => descriptor.includes(normalizeText(token)))) score += 3;

  return score;
}

function scoreFineMap(map: Record<string, number>, fileName: string, sheetName: string): number {
  let score = 0;
  const criticalFields = ['amount', 'plate', 'ait', 'owner', 'driver', 'description', 'infractionDate', 'renavam', 'payer'];
  for (const field of criticalFields) {
    if (map[field] !== undefined) score += 1;
  }

  const descriptor = `${normalizeText(fileName)} ${normalizeText(sheetName)}`;
  if (FINES_KEYWORDS.some((keyword) => descriptor.includes(keyword))) score += 2;
  if (PREFERRED_FINE_SHEET_TOKENS.some((token) => descriptor.includes(normalizeText(token)))) score += 3;

  return score;
}

function scoreFinancialMap(map: Record<string, number>, sheetName: string): number {
  let score = 0;
  const criticalFields = ['group', 'amount', 'account', 'entryDate', 'month', 'year'];
  for (const field of criticalFields) {
    if (map[field] !== undefined) score += 1;
  }

  const normalizedSheet = normalizeText(sheetName);
  const hasCanonicalFinancialShape = map.group !== undefined && map.amount !== undefined && map.account !== undefined;
  if (
    hasCanonicalFinancialShape &&
    [OFFICIAL_WORKBOOK_SHEETS.revenue, OFFICIAL_WORKBOOK_SHEETS.expense, OFFICIAL_WORKBOOK_SHEETS.investment].some(
      (name) => normalizedSheet === normalizeText(name)
    )
  ) {
    score += 4;
  }

  return score;
}

function shouldIgnoreSheet(sheetName: string): boolean {
  const normalized = normalizeText(sheetName);
  return IGNORED_SHEET_TOKENS.some((token) => normalized.includes(token));
}

function isVehicleOperationalLayout(candidate: WorksheetCandidate): boolean {
  const requiredFields = ['plate', 'owner', 'driver'];
  const hasRequiredFields = requiredFields.every((field) => candidate.operationalMap[field] !== undefined);

  if (!hasRequiredFields) {
    return false;
  }

  const hasVehicleAmounts =
    candidate.operationalMap.contractValue !== undefined ||
    candidate.operationalMap.amountToCharge !== undefined ||
    candidate.operationalMap.paidWeekValue !== undefined;

  const normalizedSheet = normalizeText(candidate.worksheet.name);
  return (
    hasVehicleAmounts ||
    PREFERRED_OPERATIONAL_SHEET_TOKENS.some((token) => normalizedSheet.includes(normalizeText(token)))
  );
}

function detectOperationalTransactionType(
  fileName: string,
  sheetName: string,
  headers: string[],
  candidate?: WorksheetCandidate
): TransactionType | null {
  if (candidate && isVehicleOperationalLayout(candidate)) {
    return 'RECEIVABLE';
  }

  const descriptor = `${normalizeText(fileName)} ${normalizeText(sheetName)} ${headers.join(' ')}`;

  if (descriptor.includes('cliente') || OPERATIONAL_RECEIVABLE_KEYWORDS.some((keyword) => descriptor.includes(keyword))) {
    return 'RECEIVABLE';
  }

  if (descriptor.includes('fornecedor') || OPERATIONAL_PAYABLE_KEYWORDS.some((keyword) => descriptor.includes(keyword))) {
    return 'PAYABLE';
  }

  return null;
}

export function detectFileKindFromName(fileName: string): SourceFileKind {
  const normalized = normalizeText(fileName);
  if (FINES_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'FINES';
  }

  if (
    OPERATIONAL_PAYABLE_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    OPERATIONAL_RECEIVABLE_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    PREFERRED_OPERATIONAL_SHEET_TOKENS.some((token) => normalized.includes(normalizeText(token)))
  ) {
    return 'OPERATIONAL';
  }

  return 'UNKNOWN';
}

function analyzeWorksheet(fileName: string, worksheet: ExcelJS.Worksheet): WorksheetCandidate | null {
  if (shouldIgnoreSheet(worksheet.name)) {
    return null;
  }

  let bestCandidate: WorksheetCandidate | null = null;

  for (let rowIndex = 1; rowIndex <= Math.min(worksheet.rowCount, 30); rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values = (row.values as unknown[]).slice(1);
    if (isRowEmpty(values)) continue;

    const normalizedHeaders = values.map((value) => normalizeHeaderValue(value));
    const headers = values.map((value) => String(getCellValue(value) || '').trim());
    const operationalMap = buildHeaderMap(normalizedHeaders, OPERATIONAL_FIELD_ALIASES);
    const finesMap = buildHeaderMap(normalizedHeaders, FINE_FIELD_ALIASES);
    const financialMap = buildHeaderMap(normalizedHeaders, FINANCIAL_FIELD_ALIASES);
    const operationalScore = scoreOperationalMap(operationalMap, fileName, worksheet.name);
    const finesScore = scoreFineMap(finesMap, fileName, worksheet.name);
    const financialScore = scoreFinancialMap(financialMap, worksheet.name);
    const bestScore = Math.max(operationalScore, finesScore, financialScore);
    const kind =
      bestScore === financialScore && financialScore > 0
        ? 'FINANCIAL'
        : finesScore > operationalScore
          ? 'FINES'
          : operationalScore > 0
            ? 'OPERATIONAL'
            : 'UNKNOWN';

    const score = bestScore;
    if (score < 3) {
      continue;
    }

    if (
      !bestCandidate ||
      score > Math.max(bestCandidate.operationalScore, bestCandidate.finesScore, bestCandidate.financialScore)
    ) {
      bestCandidate = {
        worksheet,
        headerRowIndex: rowIndex,
        headers,
        normalizedHeaders,
        operationalMap,
        finesMap,
        financialMap,
        operationalScore,
        finesScore,
        financialScore,
        kind,
      };
    }
  }

  return bestCandidate;
}

function detectWorkbookKind(fileName: string, candidates: WorksheetCandidate[]) {
  const reasons: string[] = [];
  const nameKind = detectFileKindFromName(fileName);
  let operationalScore = nameKind === 'OPERATIONAL' ? 2 : 0;
  let finesScore = nameKind === 'FINES' ? 3 : 0;
  let financialScore = nameKind === 'FINANCIAL' ? 3 : 0;

  if (nameKind !== 'UNKNOWN') {
    reasons.push(`Nome do arquivo sugere ${nameKind.toLowerCase()}`);
  }

  for (const candidate of candidates) {
    operationalScore += candidate.operationalScore;
    finesScore += candidate.finesScore;
    financialScore += candidate.financialScore;
    reasons.push(
      `Aba ${candidate.worksheet.name}: operacional=${candidate.operationalScore} multas=${candidate.finesScore} financeiro=${candidate.financialScore}`
    );
  }

  const candidateKinds = new Set(candidates.map((candidate) => candidate.kind));
  if (
    candidateKinds.has('OPERATIONAL') &&
    (candidateKinds.has('FINANCIAL') || candidateKinds.has('FINES'))
  ) {
    return {
      kind: 'WORKBOOK' as SourceFileKind,
      reasons,
    };
  }

  if (candidateKinds.has('FINANCIAL') && !candidateKinds.has('OPERATIONAL') && !candidateKinds.has('FINES')) {
    return {
      kind: 'FINANCIAL' as SourceFileKind,
      reasons,
    };
  }

  if (finesScore > operationalScore && finesScore >= 4) {
    return {
      kind: 'FINES' as SourceFileKind,
      reasons,
    };
  }

  if (operationalScore >= 4) {
    return {
      kind: 'OPERATIONAL' as SourceFileKind,
      reasons,
    };
  }

  if (financialScore >= 4) {
    return {
      kind: 'FINANCIAL' as SourceFileKind,
      reasons,
    };
  }

  return {
    kind: candidates.length === 1 ? candidates[0].kind : 'UNKNOWN',
    reasons,
  };
}

function selectOperationalCandidates(candidates: WorksheetCandidate[]): WorksheetCandidate[] {
  const preferredCandidates = candidates.filter(
    (candidate) =>
      candidate.kind === 'OPERATIONAL' &&
      PREFERRED_OPERATIONAL_SHEET_TOKENS.some((token) =>
        normalizeText(candidate.worksheet.name).includes(normalizeText(token))
      )
  );

  return preferredCandidates.slice(0, 1);
}

function findCandidateByOfficialSheetName(candidates: WorksheetCandidate[], sheetName: string): WorksheetCandidate | null {
  const target = normalizeText(sheetName);
  return candidates.find((candidate) => normalizeText(candidate.worksheet.name) === target) || null;
}

function stringValue(value: unknown): string | null {
  return collapseWhitespace(String(getCellValue(value) || ''));
}

function amountValue(value: unknown): number | null {
  const amount = parseCurrency(getCellValue(value));
  return Number.isFinite(amount) && amount !== 0 ? amount : null;
}

function parseNumericCell(value: unknown, options?: { preserveZero?: boolean }): NumericCellResult {
  const raw = getCellValue(value);

  if (raw == null) {
    return {
      value: null,
      raw,
      invalid: false,
      missing: true,
    };
  }

  if (typeof raw === 'number') {
    return {
      value: raw,
      raw,
      invalid: false,
      missing: false,
    };
  }

  const text = String(raw).trim();
  if (!text) {
    return {
      value: null,
      raw,
      invalid: false,
      missing: true,
    };
  }

  if (text.startsWith('#')) {
    return {
      value: null,
      raw: text,
      invalid: true,
      missing: false,
    };
  }

  const normalizedNumericText = text.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalizedNumericText)) {
    return {
      value: null,
      raw: text,
      invalid: true,
      missing: false,
    };
  }

  const parsed = parseCurrency(text);
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      raw: text,
      invalid: true,
      missing: false,
    };
  }

  if (parsed === 0 && !options?.preserveZero) {
    return {
      value: null,
      raw,
      invalid: false,
      missing: false,
    };
  }

  return {
    value: parsed,
    raw,
    invalid: false,
    missing: false,
  };
}

function decimalToString(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toFixed(2);
}

function normalizeVehicleStatus(value: string | null | undefined): string | null {
  const clean = collapseWhitespace(value);
  if (!clean) return null;

  const normalized = normalizeText(clean);
  if (normalized.includes('ativo')) return 'ATIVO';
  if (normalized.includes('manut')) return 'MANUTENCAO';
  if (normalized.includes('inativo')) return 'INATIVO';
  if (normalized.includes('vend')) return 'VENDIDO';
  return toTitleCase(clean);
}

function resolveOperationalPaymentState(params: {
  amountPaidWeek: number | null;
  amountToCharge: number | null;
  contractValue: number | null;
}): 'UNKNOWN' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' {
  const amountDue = params.amountToCharge ?? params.contractValue;
  const amountPaid = params.amountPaidWeek ?? 0;

  if (amountPaid > 0 && amountDue !== null) {
    if (amountPaid > amountDue) return 'OVERPAID';
    if (amountPaid < amountDue) return 'PARTIAL';
    return 'PAID';
  }

  if (amountDue !== null && amountDue > 0) {
    return amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
  }

  return amountPaid > 0 ? 'PAID' : 'UNKNOWN';
}

function parseMonthNumberFromCell(value: unknown): number | null {
  const raw = getCellValue(value);
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 12) {
    return raw;
  }

  const text = collapseWhitespace(String(raw || ''));
  if (!text) return null;

  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric;
  }

  return extractMonthNumber(text);
}

function parseYearNumberFromCell(value: unknown): number | null {
  const raw = getCellValue(value);
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 2000 && raw <= 2100) {
    return raw;
  }

  const text = collapseWhitespace(String(raw || ''));
  if (!text) return null;

  const match = text.match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function resolveFinancialEntryDate(params: {
  rawDate: unknown;
  rawMonth: unknown;
  rawYear: unknown;
  fileName: string;
  candidate: WorksheetCandidate;
  importDate: Date;
}): { date: Date | null; metadata: Record<string, unknown> } {
  const directDate = parseExcelDate(params.rawDate);
  if (directDate) {
    return {
      date: directDate,
      metadata: {
        strategy: 'direct-date',
        originalDate: getCellValue(params.rawDate) ?? null,
        originalMonth: getCellValue(params.rawMonth) ?? null,
        originalYear: getCellValue(params.rawYear) ?? null,
        inferred: false,
      },
    };
  }

  const month = parseMonthNumberFromCell(params.rawMonth);
  const year = parseYearNumberFromCell(params.rawYear) ?? inferYearHint(params.fileName, params.candidate, params.importDate).year;
  if (month && year) {
    const inferredDate = new Date(year, month - 1, 1);
    return {
      date: inferredDate,
      metadata: {
        strategy: 'month-year-fallback',
        originalDate: getCellValue(params.rawDate) ?? null,
        originalMonth: getCellValue(params.rawMonth) ?? null,
        originalYear: getCellValue(params.rawYear) ?? null,
        inferred: true,
      },
    };
  }

  return {
    date: null,
    metadata: {
      strategy: 'unresolved',
      originalDate: getCellValue(params.rawDate) ?? null,
      originalMonth: getCellValue(params.rawMonth) ?? null,
      originalYear: getCellValue(params.rawYear) ?? null,
      inferred: false,
    },
  };
}

function resolveFinePaymentState(value: unknown): FinePaymentState {
  const normalized = normalizeText(String(getCellValue(value) || ''));
  if (!normalized) return 'UNKNOWN';
  if (normalized.includes('nao') || normalized.includes('não')) return 'UNPAID';
  if (normalized.includes('parcial')) return 'PARTIAL';
  if (normalized.includes('contest')) return 'CONTESTED';
  if (normalized.includes('cancel')) return 'CANCELLED';
  if (normalized.includes('sim') || normalized.includes('paga') || normalized.includes('pago') || normalized.includes('quit')) {
    return 'PAID';
  }
  return 'UNKNOWN';
}

function classifyOperationalQuality(params: {
  contractValue: number | null;
  amountToCharge: number | null;
  amountPaidWeek: number | null;
  lateFeeAmount: number | null;
  discountAmount: number | null;
  maintenanceByDriverAmount: number | null;
  openAmount: number | null;
  paymentState: 'UNKNOWN' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  invalidCells?: Record<string, unknown> | null;
}): OperationalQualityAssessment {
  const reasons: string[] = [];
  const dueAmount = params.amountToCharge ?? params.contractValue ?? 0;
  const paidAmount = params.amountPaidWeek ?? 0;
  const overpaidExcess = paidAmount > dueAmount ? paidAmount - dueAmount : 0;
  const invalidCells = params.invalidCells || {};
  const invalidCellEntries = Object.entries(invalidCells).filter(([, value]) => value !== null && value !== undefined);

  if (invalidCellEntries.length > 0) {
    reasons.push(`invalid_numeric_cells:${invalidCellEntries.map(([key]) => key).join(',')}`);
  }

  if (paidAmount > Math.max(5000, dueAmount * 2.5, (params.contractValue ?? 0) * 2.5)) {
    reasons.push('amount_paid_week_extreme');
  } else if (paidAmount > Math.max(2500, dueAmount * 1.5, (params.contractValue ?? 0) * 1.5)) {
    reasons.push('amount_paid_week_high');
  }

  if ((params.amountToCharge ?? 0) > Math.max(5000, (params.contractValue ?? 0) * 2.2)) {
    reasons.push('amount_to_charge_extreme');
  } else if ((params.amountToCharge ?? 0) > Math.max(2500, (params.contractValue ?? 0) * 1.5)) {
    reasons.push('amount_to_charge_high');
  }

  if ((params.maintenanceByDriverAmount ?? 0) > 3000) {
    reasons.push('maintenance_extreme');
  } else if ((params.maintenanceByDriverAmount ?? 0) > 1500) {
    reasons.push('maintenance_high');
  }

  if ((params.lateFeeAmount ?? 0) > 1000) {
    reasons.push('late_fee_extreme');
  } else if ((params.lateFeeAmount ?? 0) > 300) {
    reasons.push('late_fee_high');
  }

  if ((params.discountAmount ?? 0) > Math.max(1500, (params.contractValue ?? 0) * 1.2)) {
    reasons.push('discount_extreme');
  } else if ((params.discountAmount ?? 0) > Math.max(800, (params.contractValue ?? 0))) {
    reasons.push('discount_high');
  }

  if (params.paymentState === 'OVERPAID') {
    if (overpaidExcess > Math.max(500, dueAmount * 0.5)) {
      reasons.push('overpaid_extreme');
    } else if (overpaidExcess > Math.max(50, dueAmount * 0.1)) {
      reasons.push('overpaid_warning');
    }
  }

  if ((params.openAmount ?? 0) > Math.max(1500, dueAmount * 0.75)) {
    reasons.push('open_amount_high');
  }

  let status: OperationalQualityStatus = 'OK';
  if (
    reasons.some((reason) =>
      [
        'invalid_numeric_cells:amountToCharge',
        'invalid_numeric_cells:paidWeekValue',
        'amount_paid_week_extreme',
        'amount_to_charge_extreme',
        'maintenance_extreme',
        'late_fee_extreme',
        'discount_extreme',
        'overpaid_extreme',
      ].includes(reason)
    ) || reasons.some((reason) => reason.startsWith('invalid_numeric_cells:'))
  ) {
    status = 'REVIEW_REQUIRED';
  } else if (reasons.length > 0) {
    status = 'WARNING';
  }

  return {
    status,
    reasons,
    recommendedAggregateHandling: 'include_with_flag',
  };
}

function statusFromRow(data: {
  statusValue: unknown;
  paidFlagValue: unknown;
  actualDate: Date | null;
  actualAmount: number | null;
}): TransactionStatus {
  const normalizedStatus = normalizeText(String(getCellValue(data.statusValue) || ''));

  if (
    parseBoolean(data.paidFlagValue) ||
    normalizedStatus.includes('pago') ||
    normalizedStatus.includes('recebido') ||
    normalizedStatus.includes('liquidado') ||
    normalizedStatus.includes('quitado') ||
    data.actualDate !== null ||
    (data.actualAmount !== null && data.actualAmount > 0)
  ) {
    return 'SETTLED';
  }

  return 'PENDING';
}

function computeStableRowHash(parts: Array<string | number | null | undefined>): string {
  const normalizedParts = parts.map((part) => normalizeText(part == null ? '' : String(part)));
  return crypto.createHash('sha256').update(normalizedParts.join('|')).digest('hex').slice(0, 32);
}

function determineArchivePeriod(rows: ParsedRow[]): string {
  for (const row of rows) {
    const date = row.dueDate || row.plannedDate || row.actualDate;
    if (date) {
      return date.toISOString().slice(0, 7);
    }
  }

  return 'sem-periodo';
}

function sumAmounts(...values: Array<number | null>): number | null {
  const total = values.reduce<number>((acc, value) => acc + (value ?? 0), 0);
  return total !== 0 ? total : null;
}

function buildVehicleOperationalDescription(params: {
  plate: string | null;
  owner: string | null;
  driver: string | null;
  model: string | null;
}): string {
  const segments = [VEHICLE_OPERATIONAL_CATEGORY];
  if (params.plate) segments.push(`Placa ${params.plate}`);
  if (params.owner) segments.push(`Proprietário ${params.owner}`);
  if (params.driver) segments.push(`Motorista ${params.driver}`);
  if (params.model) segments.push(`Modelo ${params.model}`);
  return segments.join(' | ');
}

function detectFineCategory(fileName: string, sheetName: string, counterparty: string | null): string {
  const descriptor = `${normalizeText(fileName)} ${normalizeText(sheetName)} ${normalizeText(counterparty)}`;
  if (descriptor.includes('correios')) return 'Multas - Correios';
  if (descriptor.includes('detran')) return 'Multas - Detran';
  return 'Multas';
}

function buildFineDescription(params: {
  originalDescription: string | null;
  plate: string | null;
  ait: string | null;
  owner: string | null;
  driver: string | null;
  paidByLabel: string;
}): string {
  const segments = ['Multa'];
  if (params.ait) segments.push(`AIT ${params.ait}`);
  if (params.plate) segments.push(`Placa ${params.plate}`);
  if (params.owner) segments.push(`Proprietário ${params.owner}`);
  if (params.driver) segments.push(`Motorista ${params.driver}`);
  if (params.paidByLabel !== 'Indefinido') segments.push(`Pago por ${params.paidByLabel}`);
  if (params.originalDescription) segments.push(params.originalDescription);
  return segments.join(' | ');
}

function createRawJson(
  headers: string[],
  rowValues: unknown[],
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const rowData = Object.fromEntries(
    headers.map((header, index) => [header || `COL_${index + 1}`, getCellValue(rowValues[index])])
  );

  return {
    ...rowData,
    __import: metadata,
  };
}

function toJsonValue(value: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseOperationalSheet(
  fileName: string,
  candidate: WorksheetCandidate,
  warnings: string[],
  importDate: Date
): { rows: ParsedRow[]; totalRowsRead: number } {
  const transactionType = detectOperationalTransactionType(
    fileName,
    candidate.worksheet.name,
    candidate.normalizedHeaders,
    candidate
  );
  const usesVehicleLayout = isVehicleOperationalLayout(candidate);

  if (!transactionType) {
    warnings.push(`Aba ${candidate.worksheet.name}: tipo operacional não identificado com segurança`);
    return { rows: [], totalRowsRead: 0 };
  }

  const rows: ParsedRow[] = [];
  let totalRowsRead = 0;
  const exactOperationalRowSignatures = new Set<string>();

  for (let rowIndex = candidate.headerRowIndex + 1; rowIndex <= candidate.worksheet.rowCount; rowIndex += 1) {
    const row = candidate.worksheet.getRow(rowIndex);
    const values = (row.values as unknown[]).slice(1);

    if (isRowEmpty(values) || looksLikeTotalRow(values[0])) {
      continue;
    }

    totalRowsRead += 1;

    const read = (field: string) => {
      const index = candidate.operationalMap[field];
      return index === undefined ? null : getCellValue(values[index]);
    };

    const plate = normalizePlate(stringValue(read('plate')) || stringValue(read('unit')));
    const ownerRaw = stringValue(read('owner'));
    const owner = normalizeOwnerName(ownerRaw);
    const driverRaw = stringValue(read('driver'));
    const driver = normalizeDisplayName(driverRaw);
    const externalId = stringValue(read('externalId')) || (plate ? `${plate}-${rowIndex}` : null);
    // The official operational sheet does not contain "Situacao de pagamento".
    const paymentStatus = null;
    const contractActive = stringValue(read('contractActive'));
    const vehicleStatus = stringValue(read('vehicleStatus'));
    const vehicleStatusNormalized = normalizeVehicleStatus(vehicleStatus);
    const modelRaw = stringValue(read('model'));
    const model = normalizeDisplayName(modelRaw);
    const rawDate = read('plannedDate');
    const rawWeek = read('week');
    const weekNumber = parseWeekNumber(rawWeek);
    const operationalDate = usesVehicleLayout
      ? resolveOperationalDate({
          rawDate,
          rawWeek,
          fileName,
          candidate,
          importDate,
        })
      : null;
    const contractValueCell = parseNumericCell(read('contractValue'), { preserveZero: true });
    const amountToChargeCell = parseNumericCell(read('amountToCharge'), { preserveZero: true });
    const paidWeekValueCell = parseNumericCell(read('paidWeekValue'), { preserveZero: true });
    const lateFineCell = parseNumericCell(read('lateFine'), { preserveZero: true });
    const extraFineCell = parseNumericCell(read('fineComponent'), { preserveZero: true });
    const maintenanceByDriverCell = parseNumericCell(read('maintenanceByDriver'), { preserveZero: true });
    const discountCell = parseNumericCell(read('discount'), { preserveZero: true });
    const contractValue = contractValueCell.value;
    const amountToCharge = amountToChargeCell.value;
    const paidWeekValue = paidWeekValueCell.value;
    const lateFine = lateFineCell.value;
    const extraFine = extraFineCell.value;
    const maintenanceByDriver = maintenanceByDriverCell.value;
    const genericPlannedDate = parseExcelDate(read('plannedDate'));
    const genericDueDate = parseExcelDate(read('dueDate')) || genericPlannedDate;
    const genericActualDate = parseExcelDate(read('actualDate'));
    const genericPlannedAmount = parseCurrency(read('plannedAmount') ?? read('actualAmount'));
    const genericActualAmountRaw = amountValue(read('actualAmount'));
    const genericFeesInterest = amountValue(read('feesInterest'));
    const genericFeesFine = amountValue(read('feesFine'));
    const genericDiscount = amountValue(read('discount'));
    const genericGrossAmount = amountValue(read('grossAmount'));
    const category = usesVehicleLayout
      ? VEHICLE_OPERATIONAL_CATEGORY
      : stringValue(read('category')) || collapseWhitespace(candidate.worksheet.name);
    const counterparty = usesVehicleLayout ? owner || driver || plate : stringValue(read('counterparty'));
    const description = usesVehicleLayout
      ? buildVehicleOperationalDescription({
          plate,
          owner,
          driver,
          model,
        })
      : stringValue(read('description'));
    const plannedDate = usesVehicleLayout ? operationalDate?.date || null : genericPlannedDate;
    const dueDate = usesVehicleLayout ? operationalDate?.date || null : genericDueDate;
    const actualDate = usesVehicleLayout
      ? paidWeekValue && paidWeekValue > 0
        ? operationalDate?.date || null
        : null
      : genericActualDate;
    const plannedAmount = usesVehicleLayout ? amountToCharge ?? contractValue ?? 0 : genericPlannedAmount;
    const actualAmountRaw = usesVehicleLayout ? paidWeekValue : genericActualAmountRaw;
    const feesInterest = usesVehicleLayout ? null : genericFeesInterest;
    const feesFine = usesVehicleLayout ? sumAmounts(lateFine, extraFine) : genericFeesFine;
    const discount = usesVehicleLayout ? discountCell.value : genericDiscount;
    const grossAmount = usesVehicleLayout ? contractValue : genericGrossAmount;
    const paymentState = usesVehicleLayout
      ? resolveOperationalPaymentState({
          amountPaidWeek: paidWeekValue,
          amountToCharge,
          contractValue,
        })
      : 'UNKNOWN';
    const status = usesVehicleLayout
      ? paymentState === 'PAID' || paymentState === 'OVERPAID' || paymentState === 'PARTIAL'
        ? 'SETTLED'
        : 'PENDING'
      : statusFromRow({
          statusValue: read('status'),
          paidFlagValue: read('isPaid'),
          actualDate,
          actualAmount: actualAmountRaw,
        });
    const actualAmount = status === 'SETTLED' ? actualAmountRaw ?? (plannedAmount || null) : null;

    const hasMeaningfulContent =
      plannedAmount !== 0 || actualAmount !== null || Boolean(externalId) || Boolean(description) || Boolean(counterparty);

    if (!hasMeaningfulContent) {
      totalRowsRead -= 1;
      continue;
    }

    if (!dueDate && !plannedDate && !actualDate) {
      warnings.push(`Aba ${candidate.worksheet.name}, linha ${rowIndex}: sem data útil`);
      continue;
    }

    const exactOperationalRowSignature =
      usesVehicleLayout && plate
        ? computeStableRowHash([
            candidate.worksheet.name,
            dueDate?.toISOString(),
            plate,
            owner,
            driver,
            model,
            contractActive,
            vehicleStatus,
            contractValue?.toFixed(2),
            lateFine?.toFixed(2),
            extraFine?.toFixed(2),
            discount?.toFixed(2),
            amountToCharge?.toFixed(2),
            maintenanceByDriver?.toFixed(2),
            paidWeekValue?.toFixed(2),
          ])
        : null;

    if (exactOperationalRowSignature && exactOperationalRowSignatures.has(exactOperationalRowSignature)) {
      warnings.push(`Aba ${candidate.worksheet.name}, linha ${rowIndex}: duplicata exata da origem ignorada`);
      totalRowsRead -= 1;
      continue;
    }

    if (exactOperationalRowSignature) {
      exactOperationalRowSignatures.add(exactOperationalRowSignature);
    }

    const rawLabel = buildRawLabel({
      counterparty,
      description,
      category,
    });

    const rawJson = createRawJson(candidate.headers, values, {
      sheetName: candidate.worksheet.name,
      sourceRowNumber: rowIndex,
      fileKind: 'OPERATIONAL',
      transactionType,
      plate,
      ownerOriginal: ownerRaw,
      ownerNormalized: owner,
      driverOriginal: driverRaw,
      driverNormalized: driver,
      model,
      modelOriginal: modelRaw,
      paymentStatus: null,
      contractActive,
      vehicleStatus,
      weekOriginal: rawWeek ?? null,
      contractValue,
      amountToCharge,
      paidWeekValue,
      maintenanceByDriver,
      lateFine,
      extraFine,
      invalidCells: {
        contractValue: contractValueCell.invalid ? contractValueCell.raw : null,
        amountToCharge: amountToChargeCell.invalid ? amountToChargeCell.raw : null,
        paidWeekValue: paidWeekValueCell.invalid ? paidWeekValueCell.raw : null,
        lateFine: lateFineCell.invalid ? lateFineCell.raw : null,
        extraFine: extraFineCell.invalid ? extraFineCell.raw : null,
        maintenanceByDriver: maintenanceByDriverCell.invalid ? maintenanceByDriverCell.raw : null,
        discount: discountCell.invalid ? discountCell.raw : null,
      },
      dateInference: operationalDate?.metadata || null,
    });

    if (amountToChargeCell.invalid) {
      warnings.push(
        `Aba ${candidate.worksheet.name}, linha ${rowIndex}: Valor à Cobrar inválido (${String(amountToChargeCell.raw)})`
      );
    }

    if (discountCell.invalid) {
      warnings.push(`Aba ${candidate.worksheet.name}, linha ${rowIndex}: Desconto inválido (${String(discountCell.raw)})`);
    }

    let operationalSnapshot: ParsedOperationalSnapshotRow | null = null;

    if (usesVehicleLayout && operationalDate?.date && plate) {
      const referenceDate = operationalDate.date;
      const amountDue = amountToCharge ?? contractValue;
      const openAmount =
        amountDue === null ? null : Number(Math.max(amountDue - (paidWeekValue ?? 0), 0).toFixed(2));
      const quality = classifyOperationalQuality({
        contractValue,
        amountToCharge,
        amountPaidWeek: paidWeekValue,
        lateFeeAmount: sumAmounts(lateFine, extraFine),
        discountAmount: discount,
        maintenanceByDriverAmount: maintenanceByDriver,
        openAmount,
        paymentState,
        invalidCells: ((rawJson.__import as Record<string, unknown>)?.invalidCells as Record<string, unknown> | null) || null,
      });

      (rawJson as Record<string, unknown>).__quality = quality;

      operationalSnapshot = {
        operationalKey: computeStableRowHash([
          plate,
          referenceDate.toISOString().slice(0, 10),
          weekNumber,
          owner,
          driver,
        ]),
        sheetName: candidate.worksheet.name,
        sourceRowNumber: rowIndex,
        referenceDate,
        referenceYear: referenceDate.getFullYear(),
        referenceMonth: referenceDate.getMonth() + 1,
        weekOfMonth: weekNumber,
        contractActiveRaw: contractActive,
        contractActive: parseBoolean(contractActive),
        vehicleStatusRaw: vehicleStatus,
        vehicleStatusNormalized,
        paymentStatusRaw: paymentStatus,
        paymentState,
        plateRaw: stringValue(read('plate')) || stringValue(read('unit')),
        plate,
        modelRaw,
        model,
        investorRaw: ownerRaw,
        investorNormalized: owner,
        driverRaw,
        driverNormalized: driver,
        contractValue,
        lateFeeAmount: sumAmounts(lateFine, extraFine),
        discountAmount: discount,
        amountToCharge,
        maintenanceByDriverAmount: maintenanceByDriver,
        amountPaidWeek: paidWeekValue,
        openAmount,
        rawJson,
      };
    }

    rows.push({
      externalId,
      category,
      counterparty,
      description,
      unit: usesVehicleLayout ? plate : stringValue(read('unit')),
      plannedDate,
      dueDate,
      actualDate,
      plannedAmount,
      actualAmount,
      feesInterest,
      feesFine,
      discount,
      grossAmount,
      status,
      type: transactionType,
      rawJson,
      rowHash: computeStableRowHash([
        'OPERATIONAL',
        transactionType,
        externalId,
        dueDate?.toISOString(),
        actualDate?.toISOString(),
        plannedAmount.toFixed(2),
        actualAmount?.toFixed(2),
        category,
        counterparty,
        description,
        plate,
        owner,
        driver,
        model,
        paymentStatus,
        contractActive,
        vehicleStatus,
        rawWeek == null ? null : String(getCellValue(rawWeek)),
        contractValue?.toFixed(2),
        amountToCharge?.toFixed(2),
        paidWeekValue?.toFixed(2),
        lateFine?.toFixed(2),
        extraFine?.toFixed(2),
        maintenanceByDriver?.toFixed(2),
      ]),
      rawLabel: rawLabel || null,
      categorySource: 'RAW',
      normalizedByRuleId: null,
      normalizedAt: null,
      sourceRowNumber: rowIndex,
      sheetName: candidate.worksheet.name,
      operationalSnapshot,
    });
  }

  return { rows, totalRowsRead };
}

function parseFinancialSheet(
  fileName: string,
  candidate: WorksheetCandidate,
  warnings: string[],
  importDate: Date
): { rows: ParsedFinancialEntryRow[]; totalRowsRead: number; sheetWarnings: string[] } {
  const sheetWarnings: string[] = [];
  const rows: ParsedFinancialEntryRow[] = [];
  let totalRowsRead = 0;
  const exactFinancialSignatures = new Set<string>();
  const normalizedSheetName = normalizeText(candidate.worksheet.name);
  const domain: FinancialEntryDomain =
    normalizedSheetName === normalizeText(OFFICIAL_WORKBOOK_SHEETS.revenue)
      ? 'REVENUE'
      : normalizedSheetName === normalizeText(OFFICIAL_WORKBOOK_SHEETS.expense)
        ? 'EXPENSE'
        : 'INVESTMENT';
  const direction: FinancialEntryDirection = domain === 'REVENUE' ? 'INFLOW' : 'OUTFLOW';

  for (let rowIndex = candidate.headerRowIndex + 1; rowIndex <= candidate.worksheet.rowCount; rowIndex += 1) {
    const row = candidate.worksheet.getRow(rowIndex);
    const values = (row.values as unknown[]).slice(1);

    if (isRowEmpty(values) || looksLikeTotalRow(values[0])) {
      continue;
    }

    totalRowsRead += 1;

    const read = (field: string) => {
      const index = candidate.financialMap[field];
      return index === undefined ? null : getCellValue(values[index]);
    };

    const groupRaw = stringValue(read('group'));
    const detailRaw = stringValue(read('detail'));
    const categoryRaw = stringValue(read('category'));
    const accountRaw = stringValue(read('account'));
    const amountCell = parseNumericCell(read('amount'), { preserveZero: true });
    const entryDateResolution = resolveFinancialEntryDate({
      rawDate: read('entryDate'),
      rawMonth: read('month'),
      rawYear: read('year'),
      fileName,
      candidate,
      importDate,
    });
    const amount = amountCell.value;

    if (!groupRaw && !detailRaw && !categoryRaw && !accountRaw && amount === null) {
      totalRowsRead -= 1;
      continue;
    }

    if (amountCell.invalid) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: Valor inválido (${String(amountCell.raw)})`;
      warnings.push(message);
      sheetWarnings.push(message);
      continue;
    }

    if (amount === null || amount === 0) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: Valor ausente ou zero não canônico`;
      warnings.push(message);
      sheetWarnings.push(message);
      continue;
    }

    if (!entryDateResolution.date) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: sem data financeira resolvida`;
      warnings.push(message);
      sheetWarnings.push(message);
      continue;
    }

    const exactSignature = computeStableRowHash([
      candidate.worksheet.name,
      domain,
      entryDateResolution.date.toISOString().slice(0, 10),
      amount.toFixed(2),
      groupRaw,
      detailRaw,
      categoryRaw,
      accountRaw,
    ]);

    if (exactFinancialSignatures.has(exactSignature)) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: duplicata exata da origem ignorada`;
      warnings.push(message);
      sheetWarnings.push(message);
      totalRowsRead -= 1;
      continue;
    }
    exactFinancialSignatures.add(exactSignature);

    const rawJson = createRawJson(candidate.headers, values, {
      sheetName: candidate.worksheet.name,
      sourceRowNumber: rowIndex,
      fileKind: 'FINANCIAL',
      financialDomain: domain,
      direction,
      dateResolution: entryDateResolution.metadata,
    });

    rows.push({
      entryKey: computeStableRowHash([
        domain,
        entryDateResolution.date.toISOString().slice(0, 10),
        amount.toFixed(2),
        groupRaw,
        detailRaw,
        categoryRaw,
        accountRaw,
      ]),
      sourceSheetName: candidate.worksheet.name,
      sourceRowNumber: rowIndex,
      domain,
      direction,
      entryDate: entryDateResolution.date,
      referenceYear: entryDateResolution.date.getFullYear(),
      referenceMonth: entryDateResolution.date.getMonth() + 1,
      groupRaw,
      groupNormalized: groupRaw ? normalizeText(groupRaw) : null,
      detailRaw,
      categoryRaw,
      accountRaw,
      amount,
      rawJson,
    });
  }

  return { rows, totalRowsRead, sheetWarnings };
}

function parseFineSheet(
  fileName: string,
  candidate: WorksheetCandidate,
  warnings: string[]
): { rows: ParsedRow[]; fineRows: ParsedFineRecordRow[]; totalRowsRead: number; sheetWarnings: string[] } {
  const sheetWarnings: string[] = [];
  const rows: ParsedRow[] = [];
  const fineRows: ParsedFineRecordRow[] = [];
  let totalRowsRead = 0;
  const exactFineSignatures = new Set<string>();

  for (let rowIndex = candidate.headerRowIndex + 1; rowIndex <= candidate.worksheet.rowCount; rowIndex += 1) {
    const row = candidate.worksheet.getRow(rowIndex);
    const values = (row.values as unknown[]).slice(1);

    if (isRowEmpty(values) || looksLikeTotalRow(values[0])) {
      continue;
    }

    totalRowsRead += 1;

    const read = (field: string) => {
      const index = candidate.finesMap[field];
      return index === undefined ? null : getCellValue(values[index]);
    };

    const plate = normalizePlate(stringValue(read('plate')));
    const owner = normalizeOwnerName(stringValue(read('owner')));
    const driver = stringValue(read('driver'));
    const ait = collapseWhitespace(stringValue(read('ait')) || '');
    const renavam = collapseWhitespace(stringValue(read('renavam')) || '');
    const originalDescription = stringValue(read('description'));
    const counterparty = stringValue(read('counterparty'));
    const infractionDate = parseExcelDate(read('infractionDate'));
    const dueDate = parseExcelDate(read('dueDate')) || infractionDate;
    const actualDate = parseExcelDate(read('actualDate'));
    const amount = parseCurrency(read('amount') ?? read('actualAmount'));
    const actualAmountRaw = amountValue(read('actualAmount'));
    const payerOriginal = stringValue(read('payer'));
    const payerNormalized = normalizeFinePayer(payerOriginal);
    const payerLabel = finePayerLabel(payerNormalized);
    const paymentStatusRaw = stringValue(read('status'));
    const paymentState =
      resolveFinePaymentState(read('status')) !== 'UNKNOWN'
        ? resolveFinePaymentState(read('status'))
        : actualDate || actualAmountRaw
          ? 'PAID'
          : 'UNKNOWN';
    const status = statusFromRow({
      statusValue: read('status'),
      paidFlagValue: read('status'),
      actualDate,
      actualAmount: actualAmountRaw,
    });
    const actualAmount = status === 'SETTLED' ? actualAmountRaw ?? (amount || null) : null;

    if (amount === 0 && !plate && !ait && !originalDescription) {
      totalRowsRead -= 1;
      continue;
    }

    if (!dueDate && !infractionDate) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: multa sem data`;
      warnings.push(message);
      sheetWarnings.push(message);
      continue;
    }

    if (!plate) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: multa sem placa válida`;
      warnings.push(message);
      sheetWarnings.push(message);
      continue;
    }

    const exactFineSignature = computeStableRowHash([
      candidate.worksheet.name,
      ait,
      plate,
      infractionDate?.toISOString(),
      amount.toFixed(2),
      counterparty,
      driver,
    ]);
    if (exactFineSignatures.has(exactFineSignature)) {
      const message = `Aba ${candidate.worksheet.name}, linha ${rowIndex}: duplicata exata da origem ignorada`;
      warnings.push(message);
      sheetWarnings.push(message);
      totalRowsRead -= 1;
      continue;
    }
    exactFineSignatures.add(exactFineSignature);

    const category = detectFineCategory(fileName, candidate.worksheet.name, counterparty);
    const description = buildFineDescription({
      originalDescription,
      plate,
      ait,
      owner,
      driver,
      paidByLabel: payerLabel,
    });

    const rawJson = createRawJson(candidate.headers, values, {
      sheetName: candidate.worksheet.name,
      sourceRowNumber: rowIndex,
      fileKind: 'FINES',
      plate,
      ownerOriginal: stringValue(read('owner')),
      ownerNormalized: owner,
      driver,
      aitCode: ait,
      renavam: renavam || null,
      paidByOriginal: payerOriginal,
      paidByNormalized: payerNormalized,
      paidByDisplay: payerLabel,
      paymentState,
    });

    rows.push({
      externalId: ait || null,
      category,
      counterparty,
      description,
      unit: plate,
      plannedDate: infractionDate,
      dueDate,
      actualDate,
      plannedAmount: amount,
      actualAmount,
      feesInterest: null,
      feesFine: null,
      discount: null,
      grossAmount: null,
      status,
      type: 'PAYABLE',
      rawJson,
      rowHash: computeStableRowHash([
        'FINES',
        ait,
        dueDate?.toISOString(),
        amount.toFixed(2),
        category,
        counterparty,
        description,
        plate,
        owner,
        driver,
        renavam,
        payerNormalized,
      ]),
      rawLabel: description,
      categorySource: 'RAW',
      normalizedByRuleId: null,
      normalizedAt: null,
      sourceRowNumber: rowIndex,
      sheetName: candidate.worksheet.name,
      operationalSnapshot: null,
    });

    fineRows.push({
      fineKey: computeStableRowHash([
        ait || `fallback:${plate}:${(infractionDate || dueDate)?.toISOString() || 'sem-data'}:${amount.toFixed(2)}:${counterparty || ''}`,
      ]),
      sourceSheetName: candidate.worksheet.name,
      sourceRowNumber: rowIndex,
      infractionDate: infractionDate || dueDate!,
      referenceYear: (infractionDate || dueDate!).getFullYear(),
      referenceMonth: (infractionDate || dueDate!).getMonth() + 1,
      issuingAuthorityRaw: counterparty,
      driverRaw: driver,
      driverNormalized: normalizeDisplayName(driver),
      paymentStatusRaw,
      paymentState,
      amount,
      plateRaw: stringValue(read('plate')),
      plate,
      aitRaw: ait,
      ait,
      vehicleRaw: stringValue(read('vehicle')) || stringValue(read('description')),
      rawJson,
    });
  }

  return { rows, fineRows, totalRowsRead, sheetWarnings };
}

export async function parseWorkbookBuffer(buffer: Buffer, fileName: string, importDate = new Date()): Promise<ParseWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  const workbookData = buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0];
  await workbook.xlsx.load(workbookData);

  const candidates = workbook.worksheets
    .map((worksheet) => analyzeWorksheet(fileName, worksheet))
    .filter((candidate): candidate is WorksheetCandidate => Boolean(candidate));

  const detection = detectWorkbookKind(fileName, candidates);
  const warnings: string[] = [];

  if (detection.kind === 'UNKNOWN') {
    throw new Error('Não foi possível identificar o tipo do arquivo pelas abas e colunas');
  }

  const operationalCandidates = selectOperationalCandidates(candidates);

  if ((detection.kind === 'OPERATIONAL' || detection.kind === 'WORKBOOK') && operationalCandidates.length === 0) {
    throw new Error('Aba operacional oficial "planilha teste carros" não encontrada');
  }

  const rows: ParsedRow[] = [];
  const operationalRows: ParsedOperationalSnapshotRow[] = [];
  const financialRows: ParsedFinancialEntryRow[] = [];
  const fineRows: ParsedFineRecordRow[] = [];
  let totalRowsRead = 0;
  const usedSheetNames: string[] = [];
  const sheetSummaries: SheetImportSummary[] = [];
  const deferredSheets: Array<{ sheetName: string; reason: string }> = [];

  const operationalToParse =
    detection.kind === 'OPERATIONAL' || detection.kind === 'WORKBOOK' ? operationalCandidates : [];
  for (const candidate of operationalToParse) {
    usedSheetNames.push(candidate.worksheet.name);
    const parsed = parseOperationalSheet(fileName, candidate, warnings, importDate);
    rows.push(...parsed.rows);
    operationalRows.push(
      ...parsed.rows.map((row) => row.operationalSnapshot).filter((row): row is ParsedOperationalSnapshotRow => Boolean(row))
    );
    totalRowsRead += parsed.totalRowsRead;
    sheetSummaries.push({
      sheetName: candidate.worksheet.name,
      domain: 'OPERATIONAL',
      totalRowsRead: parsed.totalRowsRead,
      parsedRows: parsed.rows.length,
      warnings: warnings.filter((warning) => warning.includes(`Aba ${candidate.worksheet.name},`)),
    });
  }

  const financialToParse =
    detection.kind === 'WORKBOOK' || detection.kind === 'FINANCIAL'
      ? [
          findCandidateByOfficialSheetName(candidates, OFFICIAL_WORKBOOK_SHEETS.revenue),
          findCandidateByOfficialSheetName(candidates, OFFICIAL_WORKBOOK_SHEETS.expense),
          findCandidateByOfficialSheetName(candidates, OFFICIAL_WORKBOOK_SHEETS.investment),
        ].filter((candidate): candidate is WorksheetCandidate => Boolean(candidate))
      : [];

  for (const candidate of financialToParse) {
    usedSheetNames.push(candidate.worksheet.name);
    const parsed = parseFinancialSheet(fileName, candidate, warnings, importDate);
    financialRows.push(...parsed.rows);
    totalRowsRead += parsed.totalRowsRead;
    sheetSummaries.push({
      sheetName: candidate.worksheet.name,
      domain: 'FINANCIAL',
      totalRowsRead: parsed.totalRowsRead,
      parsedRows: parsed.rows.length,
      warnings: parsed.sheetWarnings,
    });
  }

  const finesToParse =
    detection.kind === 'WORKBOOK'
      ? [findCandidateByOfficialSheetName(candidates, OFFICIAL_WORKBOOK_SHEETS.fines)].filter(
          (candidate): candidate is WorksheetCandidate => Boolean(candidate)
        )
      : detection.kind === 'FINES'
        ? candidates.filter((candidate) => candidate.kind === 'FINES')
        : [];

  for (const candidate of finesToParse) {
    usedSheetNames.push(candidate.worksheet.name);
    const parsed = parseFineSheet(fileName, candidate, warnings);
    rows.push(...parsed.rows);
    fineRows.push(...parsed.fineRows);
    totalRowsRead += parsed.totalRowsRead;
    sheetSummaries.push({
      sheetName: candidate.worksheet.name,
      domain: 'FINES',
      totalRowsRead: parsed.totalRowsRead,
      parsedRows: parsed.fineRows.length,
      warnings: parsed.sheetWarnings,
    });
  }

  const responsibilitySheet = workbook.getWorksheet(OFFICIAL_WORKBOOK_SHEETS.responsibility);
  if (responsibilitySheet) {
    deferredSheets.push({
      sheetName: responsibilitySheet.name,
      reason: 'Aba identificada, mas parser final ainda não implementado por presença de seções e subtotais.',
    });
    sheetSummaries.push({
      sheetName: responsibilitySheet.name,
      domain: 'RESPONSIBILITY',
      totalRowsRead: 0,
      parsedRows: 0,
      warnings: [],
      note: 'Preparada para subetapa própria; sem persistência canônica nesta etapa.',
    });
  }

  const reconciliationSheet = workbook.getWorksheet(OFFICIAL_WORKBOOK_SHEETS.reconciliation);
  if (reconciliationSheet) {
    deferredSheets.push({
      sheetName: reconciliationSheet.name,
      reason: 'Aba de conferência; não é fonte canônica primária.',
    });
    sheetSummaries.push({
      sheetName: reconciliationSheet.name,
      domain: 'RECONCILIATION',
      totalRowsRead: 0,
      parsedRows: 0,
      warnings: [],
      note: 'Mantida apenas para reconciliação.',
    });
  }

  if (rows.length === 0 && operationalRows.length === 0 && financialRows.length === 0 && fineRows.length === 0) {
    throw new Error('Nenhuma linha válida encontrada nas abas principais do arquivo');
  }

  const archiveDateCandidates = [
    ...operationalRows.map((row) => row.referenceDate),
    ...financialRows.map((row) => row.entryDate),
    ...fineRows.map((row) => row.infractionDate),
  ].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  return {
    rows,
    operationalRows,
    financialRows,
    fineRows,
    kind: detection.kind,
    sheetNames: [...new Set([...usedSheetNames, ...deferredSheets.map((sheet) => sheet.sheetName)])],
    warnings,
    totalRowsRead,
    archivePeriod:
      archiveDateCandidates.length > 0
        ? archiveDateCandidates.sort((a, b) => a.getTime() - b.getTime())[0].toISOString().slice(0, 7)
        : determineArchivePeriod(rows),
    detectionReasons: detection.reasons,
    sheetSummaries,
    deferredSheets,
  };
}

export async function parseWorkbookBufferForTest(
  buffer: Buffer,
  fileName: string
): Promise<ParseWorkbookResult> {
  return await parseWorkbookBuffer(buffer, fileName);
}

export async function parseWorkbook(
  filePath: string,
  _fileHash: string
): Promise<{ transactions: ParsedRow[]; errors: string[] }> {
  const buffer = await fs.readFile(filePath);
  const parsed = await parseWorkbookBuffer(buffer, path.basename(filePath));
  return {
    transactions: parsed.rows,
    errors: parsed.warnings,
  };
}

async function getUniqueFilePath(folderPath: string, fileName: string): Promise<string> {
  const safeFileName = fileName.replace(/[<>:"/\\|?*]+/g, '-');
  const ext = path.extname(safeFileName);
  const baseName = path.basename(safeFileName, ext);

  let candidate = path.join(folderPath, safeFileName);
  let attempt = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(folderPath, `${baseName}_${attempt}${ext}`);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
}

async function persistSuccessfulCopy(params: {
  basePath: string | null;
  fileName: string;
  sourcePath?: string;
  buffer?: Buffer;
  kind: SourceFileKind;
  archivePeriod: string;
}): Promise<{ processedPath: string | null; archivePath: string | null }> {
  if (!params.basePath) {
    return { processedPath: null, archivePath: null };
  }

  const folders = getFolders(params.basePath);
  await ensureFolders(params.basePath);

  const processedPath = await getUniqueFilePath(folders.processed, params.fileName);

  if (params.sourcePath) {
    await fs.rename(params.sourcePath, processedPath);
  } else if (params.buffer) {
    await fs.writeFile(processedPath, params.buffer);
  }

  const archiveFolder = path.join(folders.archive, params.kind.toLowerCase(), params.archivePeriod);
  await fs.mkdir(archiveFolder, { recursive: true });
  const archivePath = await getUniqueFilePath(archiveFolder, params.fileName);
  await fs.copyFile(processedPath, archivePath);

  return { processedPath, archivePath };
}

async function persistErrorCopy(params: {
  basePath: string | null;
  fileName: string;
  sourcePath?: string;
  buffer?: Buffer;
}): Promise<string | null> {
  if (!params.basePath) {
    return null;
  }

  const folders = getFolders(params.basePath);
  await ensureFolders(params.basePath);
  const errorPath = await getUniqueFilePath(folders.error, params.fileName);

  if (params.sourcePath) {
    await fs.rename(params.sourcePath, errorPath);
  } else if (params.buffer) {
    await fs.writeFile(errorPath, params.buffer);
  }

  return errorPath;
}

async function getRecentFiles(limit = 6): Promise<ImportLogEntry[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const files = await db.sourceFile.findMany({
    orderBy: [{ processedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      driveFileId: true,
      status: true,
      processedAt: true,
      kind: true,
      importMode: true,
      totalRows: true,
      importedRows: true,
      skippedRows: true,
      errorCount: true,
      errorMessage: true,
      details: true,
    },
  });

  return files.map((file) => ({
    id: file.id,
    name: file.name,
    hash: file.driveFileId,
    status: file.status,
    processedAt: file.processedAt,
    kind: file.kind as SourceFileKind,
    importMode: file.importMode as ImportMode,
    totalRows: file.totalRows,
    importedRows: file.importedRows,
    skippedRows: file.skippedRows,
    errorCount: file.errorCount,
    errorMessage: file.errorMessage,
    details: (file.details as Record<string, unknown> | null) || null,
  }));
}

export async function getFolderStatus(explicitBasePath?: string | null): Promise<FolderStatus> {
  const config = resolveImportRoot(explicitBasePath);
  const basePath = config.basePath;
  const recentFiles = await getRecentFiles();

  if (!basePath) {
    return {
      configured: false,
      configSource: config.source,
      requiresSecret: Boolean(process.env.CRON_SECRET),
      exists: false,
      path: null,
      folders: {
        root: null,
        inbox: null,
        processed: null,
        error: null,
        archive: null,
      },
      inboxCount: 0,
      processedCount: 0,
      errorCount: 0,
      archiveCount: 0,
      lastRun: recentFiles[0]?.processedAt || null,
      lastFileName: recentFiles[0]?.name || null,
      recentFiles,
    };
  }

  const folders = getFolders(basePath);
  let exists = false;

  try {
    await fs.access(basePath);
    exists = true;
    await ensureFolders(basePath);
  } catch {
    exists = false;
  }

  return {
    configured: true,
    configSource: config.source,
    requiresSecret: Boolean(process.env.CRON_SECRET),
    exists,
    path: basePath,
    folders,
    inboxCount: exists ? await countFilesInFolder(folders.inbox) : 0,
    processedCount: exists ? await countFilesInFolder(folders.processed) : 0,
    errorCount: exists ? await countFilesInFolder(folders.error) : 0,
    archiveCount: exists ? await countFilesInFolder(folders.archive, true) : 0,
    lastRun: recentFiles[0]?.processedAt || null,
    lastFileName: recentFiles[0]?.name || null,
    recentFiles,
  };
}

function buildImportDetails(params: {
  kind?: SourceFileKind;
  sheetNames: string[];
  warnings: string[];
  archivePeriod: string;
  detectionReasons: string[];
  sheetSummaries?: SheetImportSummary[];
  deferredSheets?: Array<{ sheetName: string; reason: string }>;
  effectiveSourceMode: EffectiveSourceMode;
  batchId?: string | null;
  batchKey?: string | null;
  qualitySummary?: Record<string, unknown> | null;
  rootLabel?: string | null;
  relativePath?: string | null;
  processedPath?: string | null;
  archivePath?: string | null;
  errorPath?: string | null;
}): Record<string, unknown> {
  return {
    kind: params.kind || 'UNKNOWN',
    sheetNames: params.sheetNames,
    primarySheetName: params.sheetNames[0] || null,
    warnings: params.warnings,
    archivePeriod: params.archivePeriod,
    detectionReasons: params.detectionReasons,
    sheetSummaries: params.sheetSummaries || [],
    deferredSheets: params.deferredSheets || [],
    effectiveSourceMode: params.effectiveSourceMode,
    batchId: params.batchId || null,
    batchKey: params.batchKey || null,
    qualitySummary: params.qualitySummary || null,
    rootLabel: params.rootLabel || null,
    relativePath: params.relativePath || null,
    processedPath: params.processedPath || null,
    archivePath: params.archivePath || null,
    errorPath: params.errorPath || null,
  };
}

function resolveEffectiveSourceMode(params: {
  importMode: ImportMode;
  clientContext?: UploadClientContext | null;
}): EffectiveSourceMode {
  if (params.importMode === 'AUTO_FOLDER') {
    return 'AUTO_FOLDER';
  }

  if (params.clientContext?.effectiveSourceMode === 'DEVICE_FOLDER') {
    return 'DEVICE_FOLDER';
  }

  return 'MANUAL_UPLOAD';
}

async function ensureImportBatch(params: {
  importMode: ImportMode;
  effectiveSourceMode: EffectiveSourceMode;
  batchKind?: 'OPERATIONAL_SNAPSHOT' | 'FINANCIAL_LEDGER' | 'FINE_LEDGER' | 'WORKBOOK_MULTI_SHEET';
  batchContext?: ImportBatchContext | null;
}): Promise<ImportBatchContext | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (params.batchContext) {
    return params.batchContext;
  }

  const startedAt = new Date();
  const batchKey = `import:${params.importMode.toLowerCase()}:${params.effectiveSourceMode.toLowerCase()}:${startedAt.toISOString()}`;
  const batch = await db.importBatch.create({
    data: {
      batchKey,
      kind: params.batchKind || 'OPERATIONAL_SNAPSHOT',
      status: 'PENDING',
      startedAt,
      details: toJsonValue({
        importMode: params.importMode,
        effectiveSourceMode: params.effectiveSourceMode,
        batchKind: params.batchKind || 'OPERATIONAL_SNAPSHOT',
      }),
    },
    select: {
      id: true,
      batchKey: true,
      startedAt: true,
    },
  });

  return batch;
}

function buildPersistedRowHash(fileHash: string, row: Pick<ParsedRow, 'sheetName' | 'sourceRowNumber' | 'rowHash'>): string {
  return computeStableRowHash([fileHash, row.sheetName, row.sourceRowNumber, row.rowHash]);
}

function resolveBatchKind(parsed: ParseWorkbookResult): 'OPERATIONAL_SNAPSHOT' | 'FINANCIAL_LEDGER' | 'FINE_LEDGER' | 'WORKBOOK_MULTI_SHEET' {
  if (parsed.kind === 'WORKBOOK') return 'WORKBOOK_MULTI_SHEET';
  if (parsed.financialRows.length > 0 && parsed.operationalRows.length === 0 && parsed.fineRows.length === 0) {
    return 'FINANCIAL_LEDGER';
  }
  if (parsed.fineRows.length > 0 && parsed.operationalRows.length === 0 && parsed.financialRows.length === 0) {
    return 'FINE_LEDGER';
  }
  return 'OPERATIONAL_SNAPSHOT';
}

async function ensureOperationalRelations(rows: ParsedOperationalSnapshotRow[]) {
  const investorNames = [...new Set(rows.map((row) => row.investorNormalized).filter(Boolean) as string[])];
  const driverNames = [...new Set(rows.map((row) => row.driverNormalized).filter(Boolean) as string[])];
  const plates = [...new Set(rows.map((row) => row.plate).filter(Boolean))];

  if (investorNames.length > 0) {
    await db.investor.createMany({
      data: investorNames.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  if (driverNames.length > 0) {
    await db.driver.createMany({
      data: driverNames.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  if (plates.length > 0) {
    await db.vehicle.createMany({
      data: plates.map((plate) => ({
        plate,
        plateDisplay: plate,
      })),
      skipDuplicates: true,
    });
  }

  const [investors, drivers, vehicles] = await Promise.all([
    investorNames.length > 0
      ? db.investor.findMany({
          where: { normalizedName: { in: investorNames.map((name) => normalizeText(name)) } },
          select: { id: true, normalizedName: true },
        })
      : Promise.resolve([]),
    driverNames.length > 0
      ? db.driver.findMany({
          where: { normalizedName: { in: driverNames.map((name) => normalizeText(name)) } },
          select: { id: true, normalizedName: true },
        })
      : Promise.resolve([]),
    plates.length > 0
      ? db.vehicle.findMany({
          where: { plate: { in: plates } },
          select: { id: true, plate: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    investorByNormalizedName: new Map(investors.map((item) => [item.normalizedName, item.id])),
    driverByNormalizedName: new Map(drivers.map((item) => [item.normalizedName, item.id])),
    vehicleByPlate: new Map(vehicles.map((item) => [item.plate, item.id])),
  };
}

async function ensureFinancialAccounts(rows: ParsedFinancialEntryRow[]) {
  const accountNames = [...new Set(rows.map((row) => row.accountRaw).filter(Boolean) as string[])];

  if (accountNames.length > 0) {
    await db.financialAccount.createMany({
      data: accountNames.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  const accounts =
    accountNames.length > 0
      ? await db.financialAccount.findMany({
          where: { normalizedName: { in: accountNames.map((name) => normalizeText(name)) } },
          select: { id: true, normalizedName: true },
        })
      : [];

  return {
    accountByNormalizedName: new Map(accounts.map((item) => [item.normalizedName, item.id])),
  };
}

async function ensureFineRelations(rows: ParsedFineRecordRow[]) {
  const driverNames = [...new Set(rows.map((row) => row.driverNormalized).filter(Boolean) as string[])];
  const plates = [...new Set(rows.map((row) => row.plate).filter(Boolean))];

  if (driverNames.length > 0) {
    await db.driver.createMany({
      data: driverNames.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  if (plates.length > 0) {
    await db.vehicle.createMany({
      data: plates.map((plate) => ({
        plate,
        plateDisplay: plate,
      })),
      skipDuplicates: true,
    });
  }

  const [drivers, vehicles] = await Promise.all([
    driverNames.length > 0
      ? db.driver.findMany({
          where: { normalizedName: { in: driverNames.map((name) => normalizeText(name)) } },
          select: { id: true, normalizedName: true },
        })
      : Promise.resolve([]),
    plates.length > 0
      ? db.vehicle.findMany({
          where: { plate: { in: plates } },
          select: { id: true, plate: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    driverByNormalizedName: new Map(drivers.map((item) => [item.normalizedName, item.id])),
    vehicleByPlate: new Map(vehicles.map((item) => [item.plate, item.id])),
  };
}

async function finalizeImportBatch(
  batchContext: ImportBatchContext | null | undefined,
  params: { ok: boolean; errorMessage?: string | null; summary?: ImportSummary | null }
) {
  if (!batchContext || !process.env.DATABASE_URL) {
    return;
  }

  await db.importBatch.update({
    where: { id: batchContext.id },
    data: {
      status: params.ok ? 'PROCESSED' : 'ERROR',
      completedAt: new Date(),
      errorMessage: params.ok ? null : params.errorMessage || null,
      details: toJsonValue({
        batchKey: batchContext.batchKey,
        summary: params.summary || null,
        errorMessage: params.ok ? null : params.errorMessage || null,
      }),
    },
  });
}

async function importBufferInternal(params: {
  fileName: string;
  buffer: Buffer;
  importMode: ImportMode;
  sourcePath?: string;
  lastModified?: Date | null;
  explicitBasePath?: string | null;
  clientContext?: UploadClientContext | null;
  batchContext?: ImportBatchContext | null;
}): Promise<ImportFileReport> {
  const ext = path.extname(params.fileName).toLowerCase();
  const effectiveSourceMode = resolveEffectiveSourceMode(params);
  const originalPath = params.clientContext?.relativePath || params.sourcePath || null;
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      file: params.fileName,
      hash: '',
      kind: 'UNKNOWN',
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorCount: 1,
      archivePeriod: null,
      status: 'ERROR',
      message: 'Formato não suportado. Use .xlsx ou .xlsm',
      warnings: [],
    };
  }

  const rootConfig = resolveImportRoot(params.explicitBasePath);
  const fileHash = await computeFileHashFromBuffer(params.buffer);
  const modifiedTime = params.lastModified || new Date();
  let activeBatchContext: ImportBatchContext | null = params.batchContext || null;

  const alreadyProcessed = process.env.DATABASE_URL
    ? await db.sourceFile.findUnique({
        where: { driveFileId: fileHash },
        select: {
          status: true,
          kind: true,
          totalRows: true,
          details: true,
        },
      })
    : null;

  if (alreadyProcessed?.status === 'PROCESSED') {
    let parsedForArchive: ParseWorkbookResult | null = null;

    if (params.sourcePath) {
      parsedForArchive = await parseWorkbookBuffer(params.buffer, params.fileName).catch(() => null);
      await persistSuccessfulCopy({
        basePath: rootConfig.basePath,
        fileName: params.fileName,
        sourcePath: params.sourcePath,
        kind: parsedForArchive?.kind || 'UNKNOWN',
        archivePeriod: parsedForArchive?.archivePeriod || 'sem-periodo',
      }).catch(() => null);
    }

    return {
      file: params.fileName,
      hash: fileHash,
      kind: alreadyProcessed.kind || parsedForArchive?.kind || 'UNKNOWN',
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: alreadyProcessed.totalRows || 0,
      importedRows: 0,
      skippedRows: 0,
      errorCount: 0,
      archivePeriod:
        parsedForArchive?.archivePeriod ||
        (alreadyProcessed.details &&
        typeof alreadyProcessed.details === 'object' &&
        !Array.isArray(alreadyProcessed.details) &&
        typeof (alreadyProcessed.details as Record<string, unknown>).archivePeriod === 'string'
          ? ((alreadyProcessed.details as Record<string, unknown>).archivePeriod as string)
          : 'sem-periodo'),
      status: 'SKIPPED',
      message: 'Arquivo já havia sido importado anteriormente',
      warnings: [],
    };
  }

  if (!process.env.DATABASE_URL) {
    if (params.sourcePath) {
      await persistErrorCopy({
        basePath: rootConfig.basePath,
        fileName: params.fileName,
        sourcePath: params.sourcePath,
      }).catch(() => null);
    }

    return {
      file: params.fileName,
      hash: fileHash,
      kind: 'UNKNOWN',
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorCount: 1,
      archivePeriod: null,
      status: 'ERROR',
      message: 'DATABASE_URL não configurado',
      warnings: [],
    };
  }

  try {
    const parsed = await parseWorkbookBuffer(params.buffer, params.fileName, modifiedTime);
    activeBatchContext = await ensureImportBatch({
      importMode: params.importMode,
      effectiveSourceMode,
      batchKind: resolveBatchKind(parsed),
      batchContext: params.batchContext,
    });

    const sourceFile = await db.sourceFile.upsert({
      where: { driveFileId: fileHash },
      update: {
        importBatchId: activeBatchContext?.id || null,
        name: params.fileName,
        modifiedTime,
        status: 'PENDING',
        errorMessage: null,
        source: 'LOCAL',
        importMode: params.importMode,
        kind: parsed.kind,
        originalPath,
        totalRows: parsed.totalRowsRead,
        importedRows: 0,
        skippedRows: 0,
        errorCount: 0,
        details: toJsonValue(
          buildImportDetails({
            kind: parsed.kind,
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            sheetSummaries: parsed.sheetSummaries,
            deferredSheets: parsed.deferredSheets,
            effectiveSourceMode,
            batchId: activeBatchContext?.id || null,
            batchKey: activeBatchContext?.batchKey || null,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
          })
        ),
      },
      create: {
        driveFileId: fileHash,
        importBatchId: activeBatchContext?.id || null,
        name: params.fileName,
        modifiedTime,
        checksum: fileHash,
        status: 'PENDING',
        source: 'LOCAL',
        importMode: params.importMode,
        kind: parsed.kind,
        originalPath,
        totalRows: parsed.totalRowsRead,
        importedRows: 0,
        skippedRows: 0,
        errorCount: 0,
        details: toJsonValue(
          buildImportDetails({
            kind: parsed.kind,
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            sheetSummaries: parsed.sheetSummaries,
            deferredSheets: parsed.deferredSheets,
            effectiveSourceMode,
            batchId: activeBatchContext?.id || null,
            batchKey: activeBatchContext?.batchKey || null,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
          })
        ),
      },
    });
    let importedRows = 0;
    let skippedRows = 0;
    let qualitySummary: Record<string, unknown> | null = null;
    const sheetSummaryMap = new Map(parsed.sheetSummaries.map((summary) => [summary.sheetName, { ...summary }]));

    if (parsed.operationalRows.length > 0) {
      const qualityCounts = parsed.operationalRows.reduce<Record<string, number>>((acc, row) => {
        const status = String((row.rawJson.__quality as Record<string, unknown> | undefined)?.status || 'UNCLASSIFIED');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const operationalRows = parsed.operationalRows.map((row) => ({
        ...row,
        rowHash: buildPersistedRowHash(fileHash, {
          sheetName: row.sheetName,
          sourceRowNumber: row.sourceRowNumber,
          rowHash: row.operationalKey,
        }),
      }));

      const existingRowHashes = operationalRows.length
        ? await db.operationalSnapshot.findMany({
            where: { rowHash: { in: operationalRows.map((row) => row.rowHash) } },
            select: { rowHash: true },
          })
        : [];

      const existingHashSet = new Set(existingRowHashes.map((row) => row.rowHash));
      const pendingRows = operationalRows.filter((row) => !existingHashSet.has(row.rowHash));
      const skippedOperationalRows = operationalRows.length - pendingRows.length;
      skippedRows += skippedOperationalRows;

      if (pendingRows.length > 0) {
        const relations = await ensureOperationalRelations(pendingRows);
        const createManyResult = await db.operationalSnapshot.createMany({
          data: pendingRows.map((row) => ({
            sourceFileId: sourceFile.id,
            importBatchId: activeBatchContext?.id || null,
            investorId: row.investorNormalized
              ? relations.investorByNormalizedName.get(normalizeText(row.investorNormalized)) || null
              : null,
            vehicleId: relations.vehicleByPlate.get(row.plate) || null,
            driverId: row.driverNormalized
              ? relations.driverByNormalizedName.get(normalizeText(row.driverNormalized)) || null
              : null,
            rowHash: row.rowHash,
            operationalKey: row.operationalKey,
            sheetName: row.sheetName,
            sourceRowNumber: row.sourceRowNumber,
            referenceDate: row.referenceDate,
            referenceYear: row.referenceYear,
            referenceMonth: row.referenceMonth,
            weekOfMonth: row.weekOfMonth,
            contractActiveRaw: row.contractActiveRaw,
            contractActive: row.contractActive,
            vehicleStatusRaw: row.vehicleStatusRaw,
            vehicleStatusNormalized: row.vehicleStatusNormalized,
            paymentStatusRaw: row.paymentStatusRaw,
            paymentState: row.paymentState,
            plateRaw: row.plateRaw,
            plate: row.plate,
            modelRaw: row.modelRaw,
            model: row.model,
            investorRaw: row.investorRaw,
            investorNormalized: row.investorNormalized,
            driverRaw: row.driverRaw,
            driverNormalized: row.driverNormalized,
            contractValue: decimalToString(row.contractValue),
            lateFeeAmount: decimalToString(row.lateFeeAmount),
            discountAmount: decimalToString(row.discountAmount),
            amountToCharge: decimalToString(row.amountToCharge),
            maintenanceByDriverAmount: decimalToString(row.maintenanceByDriverAmount),
            amountPaidWeek: decimalToString(row.amountPaidWeek),
            openAmount: decimalToString(row.openAmount),
            rawJson: toJsonValue(row.rawJson),
          })),
          skipDuplicates: true,
        });
        importedRows += createManyResult.count;
      }

      const summary = sheetSummaryMap.get(OFFICIAL_WORKBOOK_SHEETS.operational);
      if (summary) {
        summary.importedRows = operationalRows.length - skippedOperationalRows;
        summary.skippedRows = skippedOperationalRows;
        sheetSummaryMap.set(summary.sheetName, summary);
      }

      qualitySummary = {
        ...(qualitySummary || {}),
        operational: {
          totalAssessedRows: parsed.operationalRows.length,
          byStatus: qualityCounts,
          aggregateRecommendation: 'include_with_flag',
        },
      };
    }

    if (parsed.financialRows.length > 0) {
      const financialRows = parsed.financialRows.map((row) => ({
        ...row,
        rowHash: computeStableRowHash([fileHash, row.sourceSheetName, row.sourceRowNumber, row.entryKey]),
      }));

      const existingRowHashes = financialRows.length
        ? await db.financialEntry.findMany({
            where: { rowHash: { in: financialRows.map((row) => row.rowHash) } },
            select: { rowHash: true },
          })
        : [];

      const existingHashSet = new Set(existingRowHashes.map((row) => row.rowHash));
      const pendingRows = financialRows.filter((row) => !existingHashSet.has(row.rowHash));
      const skippedFinancialRows = financialRows.length - pendingRows.length;
      skippedRows += skippedFinancialRows;

      if (pendingRows.length > 0) {
        const relations = await ensureFinancialAccounts(pendingRows);
        const createManyResult = await db.financialEntry.createMany({
          data: pendingRows.map((row) => ({
            sourceFileId: sourceFile.id,
            importBatchId: activeBatchContext?.id || null,
            financialAccountId: row.accountRaw
              ? relations.accountByNormalizedName.get(normalizeText(row.accountRaw)) || null
              : null,
            rowHash: row.rowHash,
            entryKey: row.entryKey,
            sourceSheetName: row.sourceSheetName,
            sourceRowNumber: row.sourceRowNumber,
            domain: row.domain,
            direction: row.direction,
            entryDate: row.entryDate,
            referenceYear: row.referenceYear,
            referenceMonth: row.referenceMonth,
            groupRaw: row.groupRaw,
            groupNormalized: row.groupNormalized,
            detailRaw: row.detailRaw,
            categoryRaw: row.categoryRaw,
            accountRaw: row.accountRaw,
            amount: decimalToString(row.amount)!,
            rawJson: toJsonValue(row.rawJson),
          })),
          skipDuplicates: true,
        });
        importedRows += createManyResult.count;
      }

      for (const summary of sheetSummaryMap.values()) {
        if (summary.domain !== 'FINANCIAL') continue;
        const totalSheetRows = financialRows.filter((row) => row.sourceSheetName === summary.sheetName).length;
        const pendingSheetRows = pendingRows.filter((row) => row.sourceSheetName === summary.sheetName).length;
        summary.importedRows = pendingSheetRows;
        summary.skippedRows = totalSheetRows - pendingSheetRows;
        sheetSummaryMap.set(summary.sheetName, summary);
      }

      qualitySummary = {
        ...(qualitySummary || {}),
        financial: {
          totalRows: parsed.financialRows.length,
          byDomain: parsed.financialRows.reduce<Record<string, number>>((acc, row) => {
            acc[row.domain] = (acc[row.domain] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    }

    if (parsed.fineRows.length > 0) {
      const fineRows = parsed.fineRows.map((row) => ({
        ...row,
        rowHash: computeStableRowHash([fileHash, row.sourceSheetName, row.sourceRowNumber, row.fineKey]),
      }));

      const existingRowHashes = fineRows.length
        ? await db.fineRecord.findMany({
            where: { rowHash: { in: fineRows.map((row) => row.rowHash) } },
            select: { rowHash: true },
          })
        : [];

      const existingHashSet = new Set(existingRowHashes.map((row) => row.rowHash));
      const pendingRows = fineRows.filter((row) => !existingHashSet.has(row.rowHash));
      const skippedFineRows = fineRows.length - pendingRows.length;
      skippedRows += skippedFineRows;

      if (pendingRows.length > 0) {
        const relations = await ensureFineRelations(pendingRows);
        const createManyResult = await db.fineRecord.createMany({
          data: pendingRows.map((row) => ({
            sourceFileId: sourceFile.id,
            importBatchId: activeBatchContext?.id || null,
            vehicleId: relations.vehicleByPlate.get(row.plate) || null,
            driverId: row.driverNormalized
              ? relations.driverByNormalizedName.get(normalizeText(row.driverNormalized)) || null
              : null,
            rowHash: row.rowHash,
            fineKey: row.fineKey,
            sourceSheetName: row.sourceSheetName,
            sourceRowNumber: row.sourceRowNumber,
            infractionDate: row.infractionDate,
            referenceYear: row.referenceYear,
            referenceMonth: row.referenceMonth,
            issuingAuthorityRaw: row.issuingAuthorityRaw,
            driverRaw: row.driverRaw,
            driverNormalized: row.driverNormalized,
            paymentStatusRaw: row.paymentStatusRaw,
            paymentState: row.paymentState,
            amount: row.amount !== null ? decimalToString(row.amount) : null,
            plateRaw: row.plateRaw,
            plate: row.plate,
            aitRaw: row.aitRaw,
            ait: row.ait,
            vehicleRaw: row.vehicleRaw,
            rawJson: toJsonValue(row.rawJson),
          })),
          skipDuplicates: true,
        });
        importedRows += createManyResult.count;
      }

      for (const summary of sheetSummaryMap.values()) {
        if (summary.domain !== 'FINES') continue;
        const totalSheetRows = fineRows.filter((row) => row.sourceSheetName === summary.sheetName).length;
        const pendingSheetRows = pendingRows.filter((row) => row.sourceSheetName === summary.sheetName).length;
        summary.importedRows = pendingSheetRows;
        summary.skippedRows = totalSheetRows - pendingSheetRows;
        sheetSummaryMap.set(summary.sheetName, summary);
      }

      qualitySummary = {
        ...(qualitySummary || {}),
        fines: {
          totalRows: parsed.fineRows.length,
          byPaymentState: parsed.fineRows.reduce<Record<string, number>>((acc, row) => {
            acc[row.paymentState] = (acc[row.paymentState] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    }

    qualitySummary = {
      ...(qualitySummary || {}),
      domainTotals: {
        operationalRows: parsed.operationalRows.length,
        financialRows: parsed.financialRows.length,
        fineRows: parsed.fineRows.length,
      },
      deferredSheets: parsed.deferredSheets,
    };

    const finalSheetSummaries = Array.from(sheetSummaryMap.values()).map((summary) => ({
      ...summary,
      importedRows: summary.importedRows ?? 0,
      skippedRows: summary.skippedRows ?? 0,
    }));

    const successfulPersistence = await persistSuccessfulCopy({
      basePath: rootConfig.basePath,
      fileName: params.fileName,
      sourcePath: params.sourcePath,
      buffer: params.sourcePath ? undefined : params.buffer,
      kind: parsed.kind,
      archivePeriod: parsed.archivePeriod,
    });

    await db.sourceFile.update({
      where: { id: sourceFile.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null,
        totalRows: parsed.totalRowsRead,
        importedRows,
        skippedRows,
        errorCount: parsed.warnings.length,
        details: toJsonValue(
          buildImportDetails({
            kind: parsed.kind,
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            sheetSummaries: finalSheetSummaries,
            deferredSheets: parsed.deferredSheets,
            effectiveSourceMode,
            batchId: activeBatchContext?.id || null,
            batchKey: activeBatchContext?.batchKey || null,
            qualitySummary,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
            processedPath: successfulPersistence.processedPath,
            archivePath: successfulPersistence.archivePath,
          })
        ),
      },
    });

    if (!params.batchContext && activeBatchContext) {
      await finalizeImportBatch(activeBatchContext, {
        ok: true,
        summary: {
          ok: true,
          importedFiles: importedRows > 0 ? 1 : 0,
          importedRows,
          skippedFiles: importedRows > 0 ? 0 : 1,
          skippedRows,
          errors: [],
          files: [],
        },
      });
    }

    return {
      file: params.fileName,
      hash: fileHash,
      kind: parsed.kind,
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: parsed.totalRowsRead,
      importedRows,
      skippedRows,
      errorCount: parsed.warnings.length,
      archivePeriod: parsed.archivePeriod,
      status: importedRows > 0 ? 'PROCESSED' : 'SKIPPED',
      message:
        importedRows > 0
          ? `${importedRows} linha(s) importada(s)`
          : 'Nenhuma linha nova para importar',
      warnings: parsed.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao importar arquivo';
    if (!params.batchContext && activeBatchContext) {
      await finalizeImportBatch(activeBatchContext, { ok: false, errorMessage: message });
    }
    const errorPath = await persistErrorCopy({
      basePath: rootConfig.basePath,
      fileName: params.fileName,
      sourcePath: params.sourcePath,
      buffer: params.sourcePath ? undefined : params.buffer,
    }).catch(() => null);

    if (process.env.DATABASE_URL) {
      const existing = await db.sourceFile.findUnique({
        where: { driveFileId: fileHash },
        select: { id: true },
      });

      if (existing) {
        await db.sourceFile.update({
          where: { id: existing.id },
          data: {
            status: 'ERROR',
            processedAt: new Date(),
            errorMessage: message,
            errorCount: 1,
            details: toJsonValue(
              buildImportDetails({
                kind: 'UNKNOWN',
                sheetNames: [],
                warnings: [message],
                archivePeriod: 'sem-periodo',
                detectionReasons: [],
                effectiveSourceMode,
                batchId: activeBatchContext?.id || null,
                batchKey: activeBatchContext?.batchKey || null,
                rootLabel: params.clientContext?.rootLabel || null,
                relativePath: params.clientContext?.relativePath || null,
                errorPath,
              })
            ),
          },
        });
      } else {
        await db.sourceFile.create({
          data: {
            driveFileId: fileHash,
            name: params.fileName,
            modifiedTime,
            checksum: fileHash,
            status: 'ERROR',
            source: 'LOCAL',
            importMode: params.importMode,
            kind: 'UNKNOWN',
            originalPath,
            totalRows: 0,
            importedRows: 0,
            skippedRows: 0,
            errorCount: 1,
            errorMessage: message,
            processedAt: new Date(),
            details: toJsonValue(
              buildImportDetails({
                kind: 'UNKNOWN',
                sheetNames: [],
                warnings: [message],
                archivePeriod: 'sem-periodo',
                detectionReasons: [],
                effectiveSourceMode,
                batchId: activeBatchContext?.id || null,
                batchKey: activeBatchContext?.batchKey || null,
                rootLabel: params.clientContext?.rootLabel || null,
                relativePath: params.clientContext?.relativePath || null,
                errorPath,
              })
            ),
          },
        });
      }
    }

    return {
      file: params.fileName,
      hash: fileHash,
      kind: 'UNKNOWN',
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorCount: 1,
      archivePeriod: null,
      status: 'ERROR',
      message,
      warnings: [],
    };
  }
}

export async function importFile(
  filePath: string,
  explicitBasePath?: string | null
): Promise<{ success: boolean; importedRows: number; skippedRows: number; error?: string }> {
  const buffer = await fs.readFile(filePath);
  const result = await importBufferInternal({
    fileName: path.basename(filePath),
    buffer,
    importMode: 'AUTO_FOLDER',
    sourcePath: filePath,
    explicitBasePath,
  });

  return {
    success: result.status !== 'ERROR',
    importedRows: result.importedRows,
    skippedRows: result.skippedRows,
    error: result.status === 'ERROR' ? result.message : undefined,
  };
}

export async function runImport(explicitBasePath?: string | null): Promise<ImportSummary> {
  const config = resolveImportRoot(explicitBasePath);

  if (!config.basePath) {
    return {
      ok: false,
      importedFiles: 0,
      importedRows: 0,
      skippedFiles: 0,
      skippedRows: 0,
      errors: [{ file: 'general', message: 'IMPORT_ROOT_FOLDER/LOCAL_IMPORT_FOLDER não configurado' }],
      files: [],
    };
  }

  await ensureFolders(config.basePath);
  const files = await listInboxFiles(config.basePath);

  const summary: ImportSummary = {
    ok: true,
    importedFiles: 0,
    importedRows: 0,
    skippedFiles: 0,
    skippedRows: 0,
    errors: [],
    files: [],
  };

  for (const filePath of files) {
    const buffer = await fs.readFile(filePath);
    const result = await importBufferInternal({
      fileName: path.basename(filePath),
      buffer,
      importMode: 'AUTO_FOLDER',
      sourcePath: filePath,
      explicitBasePath: config.basePath,
    });

    summary.files.push(result);

    if (result.status === 'ERROR') {
      summary.ok = false;
      summary.errors.push({ file: result.file, message: result.message });
    } else if (result.status === 'SKIPPED') {
      summary.skippedFiles += 1;
      summary.skippedRows += result.skippedRows;
    } else {
      summary.importedFiles += 1;
      summary.importedRows += result.importedRows;
      summary.skippedRows += result.skippedRows;
    }
  }

  return summary;
}

export async function importUploadedFiles(
  inputs: UploadedImportInput[],
  explicitBasePath?: string | null
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    ok: true,
    importedFiles: 0,
    importedRows: 0,
    skippedFiles: 0,
    skippedRows: 0,
    errors: [],
    files: [],
  };

  for (const input of inputs) {
    const result = await importBufferInternal({
      fileName: input.fileName,
      buffer: input.buffer,
      importMode: 'MANUAL_UPLOAD',
      lastModified: input.lastModified,
      explicitBasePath,
      clientContext: input.clientContext,
    });

    summary.files.push(result);

    if (result.status === 'ERROR') {
      summary.ok = false;
      summary.errors.push({ file: result.file, message: result.message });
    } else if (result.status === 'SKIPPED') {
      summary.skippedFiles += 1;
      summary.skippedRows += result.skippedRows;
    } else {
      summary.importedFiles += 1;
      summary.importedRows += result.importedRows;
      summary.skippedRows += result.skippedRows;
    }
  }

  return summary;
}
