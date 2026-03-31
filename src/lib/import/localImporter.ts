import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { parseExcelDate, parseCurrency, parseBoolean } from '../parsers/common';
import {
  buildRawLabel,
  loadActiveRules,
  resolveCategoryByRules,
  type NormalizationRule,
} from '../normalization/categoryNormalization';

type TransactionType = 'PAYABLE' | 'RECEIVABLE';
type TransactionStatus = 'PENDING' | 'SETTLED';
type CategorySource = 'RAW' | 'NORMALIZED' | 'MANUAL';
export type ImportMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD';
export type EffectiveSourceMode = 'AUTO_FOLDER' | 'MANUAL_UPLOAD' | 'DEVICE_FOLDER';
export type SourceFileKind = 'OPERATIONAL' | 'FINES' | 'UNKNOWN';
type FinePayer = 'COMPANY' | 'OWNER' | 'DRIVER' | 'UNKNOWN';

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xlsm']);
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
  paymentStatus: ['situacao de pagamento', 'situação de pagamento', 'status pagamento'],
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
  renavam: ['renavam'],
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
  operationalScore: number;
  finesScore: number;
  kind: SourceFileKind;
}

interface ParseWorkbookResult {
  rows: ParsedRow[];
  kind: SourceFileKind;
  sheetNames: string[];
  warnings: string[];
  totalRowsRead: number;
  archivePeriod: string;
  detectionReasons: string[];
}

interface UploadClientContext {
  effectiveSourceMode?: EffectiveSourceMode;
  rootLabel?: string | null;
  relativePath?: string | null;
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
    const operationalScore = scoreOperationalMap(operationalMap, fileName, worksheet.name);
    const finesScore = scoreFineMap(finesMap, fileName, worksheet.name);
    const kind =
      finesScore > operationalScore ? 'FINES' : operationalScore > 0 ? 'OPERATIONAL' : 'UNKNOWN';

    const score = Math.max(operationalScore, finesScore);
    if (score < 3) {
      continue;
    }

    if (!bestCandidate || score > Math.max(bestCandidate.operationalScore, bestCandidate.finesScore)) {
      bestCandidate = {
        worksheet,
        headerRowIndex: rowIndex,
        headers,
        normalizedHeaders,
        operationalMap,
        finesMap,
        operationalScore,
        finesScore,
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

  if (nameKind !== 'UNKNOWN') {
    reasons.push(`Nome do arquivo sugere ${nameKind.toLowerCase()}`);
  }

  for (const candidate of candidates) {
    operationalScore += candidate.operationalScore;
    finesScore += candidate.finesScore;
    reasons.push(
      `Aba ${candidate.worksheet.name}: operacional=${candidate.operationalScore} multas=${candidate.finesScore}`
    );
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

  return {
    kind: candidates.length === 1 ? candidates[0].kind : 'UNKNOWN',
    reasons,
  };
}

function stringValue(value: unknown): string | null {
  return collapseWhitespace(String(getCellValue(value) || ''));
}

function amountValue(value: unknown): number | null {
  const amount = parseCurrency(getCellValue(value));
  return Number.isFinite(amount) && amount !== 0 ? amount : null;
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
  paymentStatus: string | null;
}): string {
  const segments = [VEHICLE_OPERATIONAL_CATEGORY];
  if (params.plate) segments.push(`Placa ${params.plate}`);
  if (params.owner) segments.push(`Proprietário ${params.owner}`);
  if (params.driver) segments.push(`Motorista ${params.driver}`);
  if (params.model) segments.push(`Modelo ${params.model}`);
  if (params.paymentStatus) segments.push(`Situação ${params.paymentStatus}`);
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
  warnings: string[]
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
    const owner = normalizeOwnerName(stringValue(read('owner')));
    const driver = stringValue(read('driver'));
    const externalId = stringValue(read('externalId')) || (plate ? `${plate}-${rowIndex}` : null);
    const paymentStatus = stringValue(read('paymentStatus'));
    const contractActive = stringValue(read('contractActive'));
    const vehicleStatus = stringValue(read('vehicleStatus'));
    const model = stringValue(read('model'));
    const rawDate = read('plannedDate');
    const rawWeek = read('week');
    const operationalDate = usesVehicleLayout
      ? resolveOperationalDate({
          rawDate,
          rawWeek,
          fileName,
          candidate,
          importDate: new Date(),
        })
      : null;
    const contractValue = amountValue(read('contractValue'));
    const amountToCharge = amountValue(read('amountToCharge'));
    const paidWeekValue = amountValue(read('paidWeekValue'));
    const lateFine = amountValue(read('lateFine'));
    const extraFine = amountValue(read('fineComponent'));
    const maintenanceByDriver = amountValue(read('maintenanceByDriver'));
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
          paymentStatus,
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
    const discount = usesVehicleLayout ? amountValue(read('discount')) : genericDiscount;
    const grossAmount = usesVehicleLayout ? contractValue : genericGrossAmount;
    const status = usesVehicleLayout
      ? actualAmountRaw && actualAmountRaw > 0
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

    const rawLabel = buildRawLabel({
      counterparty,
      description,
      category,
    });

    const rawJson = createRawJson(candidate.headers, values, {
      sheetName: candidate.worksheet.name,
      fileKind: 'OPERATIONAL',
      transactionType,
      plate,
      ownerOriginal: stringValue(read('owner')),
      ownerNormalized: owner,
      driver,
      model,
      paymentStatus,
      contractActive,
      vehicleStatus,
      weekOriginal: rawWeek ?? null,
      contractValue,
      amountToCharge,
      paidWeekValue,
      maintenanceByDriver,
      lateFine,
      extraFine,
      dateInference: operationalDate?.metadata || null,
    });

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
    });
  }

  return { rows, totalRowsRead };
}

function parseFineSheet(
  fileName: string,
  candidate: WorksheetCandidate,
  warnings: string[]
): { rows: ParsedRow[]; totalRowsRead: number } {
  const rows: ParsedRow[] = [];
  let totalRowsRead = 0;

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
      warnings.push(`Aba ${candidate.worksheet.name}, linha ${rowIndex}: multa sem data`);
      continue;
    }

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
    });
  }

  return { rows, totalRowsRead };
}

async function parseWorkbookBuffer(buffer: Buffer, fileName: string): Promise<ParseWorkbookResult> {
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

  const rows: ParsedRow[] = [];
  let totalRowsRead = 0;

  for (const candidate of candidates) {
    if (candidate.kind !== detection.kind) {
      continue;
    }

    const parsed =
      detection.kind === 'FINES'
        ? parseFineSheet(fileName, candidate, warnings)
        : parseOperationalSheet(fileName, candidate, warnings);

    rows.push(...parsed.rows);
    totalRowsRead += parsed.totalRowsRead;
  }

  if (rows.length === 0) {
    throw new Error('Nenhuma linha válida encontrada nas abas principais do arquivo');
  }

  return {
    rows,
    kind: detection.kind,
    sheetNames: candidates.map((candidate) => candidate.worksheet.name),
    warnings,
    totalRowsRead,
    archivePeriod: determineArchivePeriod(rows),
    detectionReasons: detection.reasons,
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
  sheetNames: string[];
  warnings: string[];
  archivePeriod: string;
  detectionReasons: string[];
  effectiveSourceMode: EffectiveSourceMode;
  rootLabel?: string | null;
  relativePath?: string | null;
  processedPath?: string | null;
  archivePath?: string | null;
  errorPath?: string | null;
}): Record<string, unknown> {
  return {
    sheetNames: params.sheetNames,
    warnings: params.warnings,
    archivePeriod: params.archivePeriod,
    detectionReasons: params.detectionReasons,
    effectiveSourceMode: params.effectiveSourceMode,
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

async function importBufferInternal(params: {
  fileName: string;
  buffer: Buffer;
  importMode: ImportMode;
  sourcePath?: string;
  lastModified?: Date | null;
  explicitBasePath?: string | null;
  clientContext?: UploadClientContext | null;
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

  const alreadyProcessed = process.env.DATABASE_URL
    ? await db.sourceFile.findUnique({
        where: { driveFileId: fileHash },
        select: { status: true },
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
      kind: 'UNKNOWN',
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorCount: 0,
      archivePeriod: parsedForArchive?.archivePeriod || 'sem-periodo',
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
    const parsed = await parseWorkbookBuffer(params.buffer, params.fileName);

    const sourceFile = await db.sourceFile.upsert({
      where: { driveFileId: fileHash },
      update: {
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
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            effectiveSourceMode,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
          })
        ),
      },
      create: {
        driveFileId: fileHash,
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
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            effectiveSourceMode,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
          })
        ),
      },
    });

    const existingRowHashes = await db.transaction.findMany({
      where: { rowHash: { in: parsed.rows.map((row) => row.rowHash) } },
      select: { rowHash: true },
    });

    const existingHashSet = new Set(existingRowHashes.map((row) => row.rowHash).filter(Boolean));
    const pendingRows = parsed.rows.filter((row) => !existingHashSet.has(row.rowHash));
    const skippedRows = parsed.rows.length - pendingRows.length;

    const normalizationRules = await loadActiveRules(db);
    const normalizationAppliedAt = new Date();

    const rowsToInsert = pendingRows.map((row) => {
      if (parsed.kind === 'OPERATIONAL' && row.rawLabel && normalizationRules.length > 0) {
        const scope = row.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
        const resolved = resolveCategoryByRules(normalizationRules as NormalizationRule[], {
          rawLabel: row.rawLabel,
          scope,
        });

        if (resolved.ruleId && resolved.categoryId) {
          return {
            ...row,
            category: resolved.categoryId,
            categorySource: 'NORMALIZED' as CategorySource,
            normalizedByRuleId: resolved.ruleId,
            normalizedAt: normalizationAppliedAt,
          };
        }
      }

      return row;
    });

    const createManyResult =
      rowsToInsert.length > 0
        ? await db.transaction.createMany({
            data: rowsToInsert.map((row) => ({
              sourceFileId: sourceFile.id,
              type: row.type,
              externalId: row.externalId,
              rowHash: row.rowHash,
              category: row.category,
              counterparty: row.counterparty,
              description: row.description,
              unit: row.unit,
              plannedDate: row.plannedDate,
              dueDate: row.dueDate,
              actualDate: row.actualDate,
              plannedAmount: String(row.plannedAmount || 0),
              actualAmount: row.actualAmount !== null ? String(row.actualAmount) : null,
              feesInterest: row.feesInterest !== null ? String(row.feesInterest) : null,
              feesFine: row.feesFine !== null ? String(row.feesFine) : null,
              discount: row.discount !== null ? String(row.discount) : null,
              grossAmount: row.grossAmount !== null ? String(row.grossAmount) : null,
              status: row.status,
              rawJson: toJsonValue(row.rawJson),
              rawLabel: row.rawLabel,
              categorySource: row.categorySource,
              normalizedByRuleId: row.normalizedByRuleId,
              normalizedAt: row.normalizedAt,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

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
        importedRows: createManyResult.count,
        skippedRows,
        errorCount: parsed.warnings.length,
        details: toJsonValue(
          buildImportDetails({
            sheetNames: parsed.sheetNames,
            warnings: parsed.warnings,
            archivePeriod: parsed.archivePeriod,
            detectionReasons: parsed.detectionReasons,
            effectiveSourceMode,
            rootLabel: params.clientContext?.rootLabel || null,
            relativePath: params.clientContext?.relativePath || null,
            processedPath: successfulPersistence.processedPath,
            archivePath: successfulPersistence.archivePath,
          })
        ),
      },
    });

    return {
      file: params.fileName,
      hash: fileHash,
      kind: parsed.kind,
      importMode: params.importMode,
      effectiveSourceMode,
      totalRows: parsed.totalRowsRead,
      importedRows: createManyResult.count,
      skippedRows,
      errorCount: parsed.warnings.length,
      archivePeriod: parsed.archivePeriod,
      status: createManyResult.count > 0 ? 'PROCESSED' : 'SKIPPED',
      message:
        createManyResult.count > 0
          ? `${createManyResult.count} linha(s) importada(s)`
          : 'Nenhuma linha nova para importar',
      warnings: parsed.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao importar arquivo';
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
                sheetNames: [],
                warnings: [message],
                archivePeriod: 'sem-periodo',
                detectionReasons: [],
                effectiveSourceMode,
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
                sheetNames: [],
                warnings: [message],
                archivePeriod: 'sem-periodo',
                detectionReasons: [],
                effectiveSourceMode,
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
