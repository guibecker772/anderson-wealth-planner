import crypto from 'node:crypto';
import path from 'node:path';

import {
  ImportMode,
  ImportPipelineStatus,
  ImportRecordType,
  ImportRowKind,
  Prisma,
  SourceFileKind,
  SourceType,
} from '@prisma/client';
import ExcelJS from 'exceljs';

import { db } from '../db';
import { parseBoolean, parseExcelDate } from '../parsers/common';
import { detectFileKindFromName, normalizeOwnerName } from './localImporter';
import {
  WORKBOOK_SHEET_CONTRACTS,
  WORKBOOK_TEMPLATE_VERSION,
  type WorkbookSheetContract,
} from './workbookTemplateContract';

type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface ImportValidationMessage {
  code: string;
  severity: ValidationSeverity;
  message: string;
  sheetName?: string | null;
  rowNumber?: number | null;
  columnHeader?: string | null;
}

export interface PreparedImportRowRaw {
  recordType: ImportRecordType;
  rowKind: ImportRowKind;
  sourceSheetName: string;
  sourceRowNumber: number;
  headerFingerprint: string;
  rawLineKey: string;
  dedupeKey: string | null;
  businessKey: string | null;
  rawPayload: Prisma.InputJsonValue;
  validationMessages: ImportValidationMessage[];
  errorMessage: string | null;
}

export interface PreparedImportRowNormalized {
  rawLineKey: string;
  recordType: ImportRecordType;
  rowKind: ImportRowKind;
  status: ImportPipelineStatus;
  sourceSheetName: string;
  sourceRowNumber: number;
  normalizedLineKey: string;
  dedupeKey: string | null;
  businessKey: string | null;
  normalizationVersion: string;
  publishable: boolean;
  normalizedPayload: Prisma.InputJsonValue;
  validationMessages: ImportValidationMessage[];
  errorMessage: string | null;
}

export interface PreparedImportFile {
  name: string;
  checksum: string;
  fileExtension: string;
  kind: SourceFileKind;
  importMode: ImportMode;
  source: SourceType;
  templateVersion: string;
  originalPath: string | null;
  status: ImportPipelineStatus;
  uploadedAt: Date;
  parsedAt: Date;
  validatedAt: Date | null;
  rejectedAt: Date | null;
  totalRows: number;
  parsedRows: number;
  validatedRows: number;
  rejectedRows: number;
  publishedRows: number;
  warningCount: number;
  errorCount: number;
  sourceSheets: Prisma.InputJsonValue;
  validationMessages: Prisma.InputJsonValue;
  details: Prisma.InputJsonValue;
}

export interface PreparedWorkbookImport {
  file: PreparedImportFile;
  rawRows: PreparedImportRowRaw[];
  normalizedRows: PreparedImportRowNormalized[];
  validationMessages: ImportValidationMessage[];
}

export interface StageWorkbookImportInput {
  fileName: string;
  buffer: Buffer;
  importMode?: ImportMode;
  source?: SourceType;
  originalPath?: string | null;
  importBatchId?: string;
}

export interface StageWorkbookImportResult {
  batchId: string;
  fileId: string;
  checksum: string;
  status: ImportPipelineStatus;
  reusedExistingFile: boolean;
  totalRows: number;
  parsedRows: number;
  validatedRows: number;
  rejectedRows: number;
  publishedRows: number;
  warningCount: number;
  errorCount: number;
}

const WORKBOOK_SHEET_CONTRACT_MAP = new Map(
  WORKBOOK_SHEET_CONTRACTS.map((contract) => [contract.sheetName, contract]),
);

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

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  if (value instanceof Date) return Number.isNaN(value.getTime())
    ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
    : value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toJsonValue(entry)) as Prisma.InputJsonArray;
  if (typeof value === 'object') {
    const objectValue: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      objectValue[key] = toJsonValue(entry);
    }
    return objectValue as Prisma.InputJsonObject;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
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
  const collapsed = (value || '').replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
}

function stringValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return collapseWhitespace(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return collapseWhitespace(String(value));
}

function getRowValue(rowMap: Record<string, unknown>, header: string): unknown {
  if (Object.prototype.hasOwnProperty.call(rowMap, header)) {
    return rowMap[header];
  }

  const normalizedHeader = normalizeText(header);
  const matchedKey = Object.keys(rowMap).find((key) => normalizeText(key) === normalizedHeader);
  return matchedKey ? rowMap[matchedKey] : null;
}

function titleCase(value: string | null | undefined): string | null {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) return null;
  return collapsed
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) {
      return extractCellValue(value.result as ExcelJS.CellValue);
    }
    if ('text' in value && typeof value.text === 'string') {
      return collapseWhitespace(value.text);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return collapseWhitespace(value.richText.map((part) => part.text).join(''));
    }
  }
  if (typeof value === 'string') return collapseWhitespace(value);
  return value;
}

function normalizePlate(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 7 ? normalized : null;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(/[^\d-]/g, ''));
  return Number.isInteger(parsed) ? parsed : null;
}

function parseCurrencyValue(value: unknown): { value: number | null; error?: string } {
  if (value == null || value === '') return { value: null };
  if (typeof value === 'number' && Number.isFinite(value)) return { value };

  const raw = stringValue(value);
  if (!raw) return { value: null };
  if (raw.includes('#')) return { value: null, error: `Valor monetario invalido (${raw})` };

  const clean = raw.replace(/R\$/gi, '').trim().replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(clean)) {
    return { value: null, error: `Valor monetario invalido (${raw})` };
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed)
    ? { value: parsed }
    : { value: null, error: `Valor monetario invalido (${raw})` };
}

function parseDateValue(value: unknown): { value: string | null; error?: string } {
  if (value == null || value === '') return { value: null };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: value.toISOString() };
  }

  const raw = stringValue(value);
  if (raw) {
    const nativeParsed = new Date(raw);
    if (!Number.isNaN(nativeParsed.getTime())) {
      return { value: nativeParsed.toISOString() };
    }
  }

  const parsed = parseExcelDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { value: null, error: raw ? `Data invalida (${raw})` : 'Data invalida' };
  }
  return { value: parsed.toISOString() };
}

function buildUtcDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function inferYearFromFileName(fileName: string, fallbackDate: Date): number {
  const matches = fileName.match(/20\d{2}/g);
  return matches && matches.length > 0 ? Number(matches[matches.length - 1]) : fallbackDate.getUTCFullYear();
}

function extractMonthNumber(value: unknown): number | null {
  const normalized = normalizeText(stringValue(value));
  if (!normalized) return null;
  for (const [token, month] of Object.entries(MONTH_NAME_MAP)) {
    if (normalized.includes(token)) return month;
  }
  return null;
}

function resolveOperationalDate(rawDate: unknown, rawWeek: unknown, fileName: string, now: Date) {
  const direct = parseDateValue(rawDate);
  if (direct.value) return direct;

  const monthNumber = extractMonthNumber(rawDate);
  if (!monthNumber) return direct.error ? direct : { value: null, error: 'Data operacional invalida' };

  const year = inferYearFromFileName(fileName, now);
  const week = parseInteger(rawWeek);
  const daysByWeek: Record<number, number> = { 1: 1, 2: 8, 3: 15, 4: 22, 5: 29 };
  return { value: buildUtcDate(year, monthNumber, daysByWeek[week || 1] || 1) };
}

function pushMessage(target: ImportValidationMessage[], message: ImportValidationMessage): void {
  target.push(message);
}

function hasError(messages: ImportValidationMessage[]): boolean {
  return messages.some((message) => message.severity === 'ERROR');
}

function countSeverity(messages: ImportValidationMessage[], severity: ValidationSeverity): number {
  return messages.filter((message) => message.severity === severity).length;
}

function mapRecordType(contract: WorkbookSheetContract): ImportRecordType {
  switch (contract.canonicalRecordType) {
    case 'OperationalSnapshot':
      return ImportRecordType.OPERATIONAL_SNAPSHOT;
    case 'FinancialEntry':
      return ImportRecordType.FINANCIAL_ENTRY;
    case 'FineRecord':
      return ImportRecordType.FINE_RECORD;
    case 'FineResponsibility':
      return ImportRecordType.FINE_RESPONSIBILITY;
    default:
      return contract.role === 'RECONCILIATION_ONLY'
        ? ImportRecordType.RECONCILIATION
        : ImportRecordType.UNSUPPORTED;
  }
}

function classifyRowKind(contract: WorkbookSheetContract, rowValues: unknown[], rowMap: Record<string, unknown>): ImportRowKind {
  if (contract.role === 'RECONCILIATION_ONLY') return ImportRowKind.RECONCILIATION;

  const normalizedValues = rowValues.map((entry) => normalizeText(stringValue(entry)));
  if (normalizedValues.some((entry) => entry.includes('subtotal') || entry.includes('total'))) {
    return ImportRowKind.SUBTOTAL;
  }

  if (contract.sheetName === 'Quem Pagou') {
    const nonEmptyCount = rowValues.filter((entry) => entry != null && entry !== '').length;
    const detailMarkers = [
      stringValue(getRowValue(rowMap, 'data Infracao')),
      stringValue(getRowValue(rowMap, 'data do pagamento')),
      stringValue(getRowValue(rowMap, 'VALOR')),
    ].filter(Boolean);

    if (detailMarkers.length === 0 && nonEmptyCount === 1) return ImportRowKind.SECTION_LABEL;
  }

  return ImportRowKind.DETAIL;
}

function determineFileKind(workbook: ExcelJS.Workbook, fileName: string): SourceFileKind {
  const recognizedSheets = workbook.worksheets
    .map((sheet) => sheet.name)
    .filter((sheetName) => WORKBOOK_SHEET_CONTRACT_MAP.has(sheetName));

  if (recognizedSheets.length > 1) return SourceFileKind.WORKBOOK;
  return detectFileKindFromName(fileName) as SourceFileKind;
}

function normalizeFinePaymentState(value: unknown): string | null {
  const normalized = normalizeText(stringValue(value));
  if (!normalized) return null;
  if (normalized === 'sim' || normalized === 'paga' || normalized === 'pago') return 'PAID';
  if (normalized === 'nao' || normalized === 'não') return 'UNPAID';
  if (normalized.includes('parcial')) return 'PARTIAL';
  if (normalized.includes('contest')) return 'CONTESTED';
  if (normalized.includes('cancel')) return 'CANCELLED';
  return 'UNKNOWN';
}

function normalizeResponsibilityType(payeeRaw: unknown, sectionLabelRaw: string | null): string {
  const normalized = `${normalizeText(sectionLabelRaw)} ${normalizeText(stringValue(payeeRaw))}`.trim();
  if (!normalized) return 'UNKNOWN';
  if (normalized.includes('juridico') || normalized.includes('legal')) return 'LEGAL';
  if (normalized.includes('motorista') || normalized.includes('condutor')) return 'DRIVER';
  if (normalized.includes('proprietario') || normalized.includes('investidor')) return 'OWNER';
  if (normalized.includes('clik') || normalized.includes('click') || normalized.includes('empresa')) return 'COMPANY';
  return 'UNKNOWN';
}

function resolveKeyToken(token: string, values: Record<string, unknown>): unknown {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.includes('||')) {
    for (const candidate of trimmed.split('||').map((entry) => entry.trim())) {
      const resolved = resolveKeyToken(candidate, values);
      if (resolved !== null && resolved !== undefined && resolved !== '') return resolved;
    }
    return null;
  }
  return Object.prototype.hasOwnProperty.call(values, trimmed) ? values[trimmed] : trimmed;
}

function buildHashedKey(components: string[], values: Record<string, unknown>): string | null {
  const resolved = components.map((component) => resolveKeyToken(component, values));
  return resolved.every((entry) => entry == null || entry === '') ? null : sha256(stableStringify(resolved));
}

function buildNormalizedLineKey(params: {
  rawLineKey: string;
  normalizationVersion: string;
  recordType: ImportRecordType;
  normalizedPayload: Prisma.InputJsonValue;
}): string {
  return sha256(
    stableStringify({
      rawLineKey: params.rawLineKey,
      normalizationVersion: params.normalizationVersion,
      recordType: params.recordType,
      normalizedPayload: params.normalizedPayload,
    }),
  );
}

function buildRowMap(contract: WorkbookSheetContract, rowValues: unknown[]): Record<string, unknown> {
  const rowMap: Record<string, unknown> = {};
  contract.expectedColumns.forEach((header, index) => {
    rowMap[header] = rowValues[index] ?? null;
  });
  return rowMap;
}

function buildRequiredMessages(contract: WorkbookSheetContract, rowMap: Record<string, unknown>, sourceRowNumber: number): ImportValidationMessage[] {
  const messages: ImportValidationMessage[] = [];
  for (const column of contract.columns.filter((entry) => entry.requirement === 'REQUIRED')) {
    const value = rowMap[column.header];
    if (value == null || value === '') {
      pushMessage(messages, {
        code: 'required-column-missing',
        severity: 'ERROR',
        message: `Coluna obrigatoria ausente: ${column.header}`,
        sheetName: contract.sheetName,
        rowNumber: sourceRowNumber,
        columnHeader: column.header,
      });
    }
  }
  return messages;
}

function buildNormalizedPayload(params: {
  contract: WorkbookSheetContract;
  rowMap: Record<string, unknown>;
  rowKind: ImportRowKind;
  fileName: string;
  now: Date;
  currentSectionLabel: string | null;
  sourceRowNumber: number;
}) {
  const payload: Record<string, unknown> = {
    sourceSheetName: params.contract.sheetName,
    sourceRowNumber: params.sourceRowNumber,
  };
  const messages =
    params.rowKind === ImportRowKind.DETAIL
      ? buildRequiredMessages(params.contract, params.rowMap, params.sourceRowNumber)
      : [];

  if (params.contract.sheetName === 'planilha teste carros') {
    const referenceDate = resolveOperationalDate(
      getRowValue(params.rowMap, 'Data'),
      getRowValue(params.rowMap, 'Semana'),
      params.fileName,
      params.now,
    );
    if (!referenceDate.value && referenceDate.error) {
      pushMessage(messages, {
        code: 'invalid-reference-date',
        severity: 'ERROR',
        message: referenceDate.error,
        sheetName: params.contract.sheetName,
        rowNumber: params.sourceRowNumber,
        columnHeader: 'Data',
      });
    }
    const contractValue = parseCurrencyValue(getRowValue(params.rowMap, 'Valor contrato'));
    const lateFeeAmount = parseCurrencyValue(getRowValue(params.rowMap, 'Multa/atraso'));
    const discountAmount = parseCurrencyValue(getRowValue(params.rowMap, 'Desconto'));
    const amountToCharge = parseCurrencyValue(getRowValue(params.rowMap, 'Valor a Cobrar'));
    const maintenanceByDriverAmount = parseCurrencyValue(getRowValue(params.rowMap, 'Manutencao por motorista'));
    const amountPaidWeek = parseCurrencyValue(getRowValue(params.rowMap, 'Valor Pago (Semana)'));
    [contractValue, lateFeeAmount, discountAmount, amountToCharge, maintenanceByDriverAmount, amountPaidWeek].forEach(
      (result, index) => {
        if (!result.error) return;
        const headers = [
          'Valor contrato',
          'Multa/atraso',
          'Desconto',
          'Valor à Cobrar',
          'Manutenção por motorista',
          'Valor Pago (Semana)',
        ];
        pushMessage(messages, {
          code: 'invalid-currency',
          severity: 'ERROR',
          message: result.error,
          sheetName: params.contract.sheetName,
          rowNumber: params.sourceRowNumber,
          columnHeader: headers[index],
        });
      },
    );

    payload.referenceDate = referenceDate.value;
    payload.referenceYear = referenceDate.value ? new Date(referenceDate.value).getUTCFullYear() : null;
    payload.referenceMonth = referenceDate.value ? new Date(referenceDate.value).getUTCMonth() + 1 : null;
    payload.weekOfMonth = parseInteger(getRowValue(params.rowMap, 'Semana'));
    payload.contractActiveRaw = stringValue(getRowValue(params.rowMap, 'Contrato ativo'));
    payload.contractActive = payload.contractActiveRaw ? parseBoolean(payload.contractActiveRaw) : null;
    payload.vehicleStatusRaw = stringValue(getRowValue(params.rowMap, 'Situacao de veiculo'));
    payload.vehicleStatusNormalized = titleCase(stringValue(getRowValue(params.rowMap, 'Situacao de veiculo')));
    payload.plateRaw = stringValue(getRowValue(params.rowMap, 'Placa'));
    payload.plate = normalizePlate(getRowValue(params.rowMap, 'Placa'));
    payload.modelRaw = stringValue(getRowValue(params.rowMap, 'Modelo'));
    payload.model = titleCase(stringValue(getRowValue(params.rowMap, 'Modelo')));
    payload.investorRaw = stringValue(getRowValue(params.rowMap, 'Proprietario'));
    payload.investorNormalized = normalizeOwnerName(stringValue(getRowValue(params.rowMap, 'Proprietario')));
    payload.driverRaw = stringValue(getRowValue(params.rowMap, 'Motorista'));
    payload.driverNormalized = titleCase(stringValue(getRowValue(params.rowMap, 'Motorista')));
    payload.contractValue = contractValue.value;
    payload.lateFeeAmount = lateFeeAmount.value;
    payload.discountAmount = discountAmount.value;
    payload.amountToCharge = amountToCharge.value;
    payload.maintenanceByDriverAmount = maintenanceByDriverAmount.value;
    payload.amountPaidWeek = amountPaidWeek.value;
  } else if (params.contract.sheetName === 'Receita' || params.contract.sheetName === 'Despesa' || params.contract.sheetName === 'Investimentos') {
    const entryDate = parseDateValue(getRowValue(params.rowMap, 'Data'));
    const amount = parseCurrencyValue(getRowValue(params.rowMap, 'Valor R$'));
    if (!entryDate.value && entryDate.error) {
      pushMessage(messages, {
        code: 'invalid-entry-date',
        severity: 'ERROR',
        message: entryDate.error,
        sheetName: params.contract.sheetName,
        rowNumber: params.sourceRowNumber,
        columnHeader: 'Data',
      });
    }
    if (amount.error) {
      pushMessage(messages, {
        code: 'invalid-currency',
        severity: 'ERROR',
        message: amount.error,
        sheetName: params.contract.sheetName,
        rowNumber: params.sourceRowNumber,
        columnHeader: 'Valor R$',
      });
    }

    const mapping =
      params.contract.sheetName === 'Receita'
        ? { domain: 'REVENUE', direction: 'INFLOW', groupField: 'Origem', accountField: 'Destino' }
        : params.contract.sheetName === 'Despesa'
          ? { domain: 'EXPENSE', direction: 'OUTFLOW', groupField: 'Tipo de Gasto', accountField: 'Fonte' }
          : { domain: 'INVESTMENT', direction: 'OUTFLOW', groupField: 'Investimento', accountField: 'Fonte' };

    payload.domain = mapping.domain;
    payload.direction = mapping.direction;
    payload.groupRaw = stringValue(getRowValue(params.rowMap, mapping.groupField));
    payload.groupNormalized = titleCase(stringValue(getRowValue(params.rowMap, mapping.groupField)));
    payload.detailRaw = stringValue(getRowValue(params.rowMap, 'Detalhamento'));
    payload.categoryRaw = stringValue(getRowValue(params.rowMap, 'Categoria'));
    payload.accountRaw = stringValue(getRowValue(params.rowMap, mapping.accountField));
    payload.amount = amount.value;
    payload.entryDate = entryDate.value;
    payload.referenceYear = entryDate.value ? new Date(entryDate.value).getUTCFullYear() : null;
    payload.referenceMonth = entryDate.value ? new Date(entryDate.value).getUTCMonth() + 1 : null;
  } else if (params.contract.sheetName === 'Multas') {
    const infractionDate = parseDateValue(getRowValue(params.rowMap, 'Data da infracao'));
    const amount = parseCurrencyValue(getRowValue(params.rowMap, 'Valor'));
    if (!infractionDate.value && infractionDate.error) {
      pushMessage(messages, {
        code: 'invalid-infraction-date',
        severity: 'ERROR',
        message: infractionDate.error,
        sheetName: params.contract.sheetName,
        rowNumber: params.sourceRowNumber,
        columnHeader: 'Data da infração',
      });
    }
    if (amount.error) {
      pushMessage(messages, {
        code: 'invalid-currency',
        severity: 'ERROR',
        message: amount.error,
        sheetName: params.contract.sheetName,
        rowNumber: params.sourceRowNumber,
        columnHeader: 'Valor',
      });
    }

    payload.issuingAuthorityRaw = stringValue(getRowValue(params.rowMap, 'Orgao autuador'));
    payload.driverRaw = stringValue(getRowValue(params.rowMap, 'Condutor'));
    payload.driverNormalized = titleCase(stringValue(getRowValue(params.rowMap, 'Condutor')));
    payload.paymentStatusRaw = stringValue(getRowValue(params.rowMap, 'Paga'));
    payload.paymentState = normalizeFinePaymentState(getRowValue(params.rowMap, 'Paga'));
    payload.amount = amount.value;
    payload.plateRaw = stringValue(getRowValue(params.rowMap, 'Placa'));
    payload.plate = normalizePlate(getRowValue(params.rowMap, 'Placa'));
    payload.aitRaw = stringValue(getRowValue(params.rowMap, 'Auto de infracao'));
    payload.ait = stringValue(getRowValue(params.rowMap, 'Auto de infracao'));
    payload.vehicleRaw = stringValue(getRowValue(params.rowMap, 'Veiculo'));
    payload.infractionDate = infractionDate.value;
    payload.referenceYear = infractionDate.value ? new Date(infractionDate.value).getUTCFullYear() : null;
    payload.referenceMonth = infractionDate.value ? new Date(infractionDate.value).getUTCMonth() + 1 : null;
  } else if (params.contract.sheetName === 'Quem Pagou') {
    const infractionDate = parseDateValue(getRowValue(params.rowMap, 'data Infracao'));
    const paymentDate = parseDateValue(getRowValue(params.rowMap, 'data do pagamento'));
    const amount = parseCurrencyValue(getRowValue(params.rowMap, 'VALOR'));
    if (params.rowKind === ImportRowKind.DETAIL) {
      if (!infractionDate.value && infractionDate.error) {
        pushMessage(messages, {
          code: 'invalid-infraction-date',
          severity: 'ERROR',
          message: infractionDate.error,
          sheetName: params.contract.sheetName,
          rowNumber: params.sourceRowNumber,
          columnHeader: 'data Infração',
        });
      }
      if (!paymentDate.value && paymentDate.error) {
        pushMessage(messages, {
          code: 'invalid-payment-date',
          severity: 'ERROR',
          message: paymentDate.error,
          sheetName: params.contract.sheetName,
          rowNumber: params.sourceRowNumber,
          columnHeader: 'data do pagamento',
        });
      }
      if (amount.error) {
        pushMessage(messages, {
          code: 'invalid-currency',
          severity: 'ERROR',
          message: amount.error,
          sheetName: params.contract.sheetName,
          rowNumber: params.sourceRowNumber,
          columnHeader: 'VALOR',
        });
      }
    }

    payload.plateRaw = stringValue(getRowValue(params.rowMap, 'PLACA'));
    payload.plate = normalizePlate(getRowValue(params.rowMap, 'PLACA'));
    payload.infractionDate = infractionDate.value;
    payload.paymentDate = paymentDate.value;
    payload.amount = amount.value;
    payload.payeeRaw = stringValue(getRowValue(params.rowMap, 'Pago para'));
    payload.sectionLabelRaw = params.currentSectionLabel;
    payload.payerContextRaw = params.currentSectionLabel;
    payload.responsibilityType = normalizeResponsibilityType(getRowValue(params.rowMap, 'Pago para'), params.currentSectionLabel);
  } else {
    const totalExpense = parseCurrencyValue(getRowValue(params.rowMap, 'Total Despesa'));
    const totalRevenue = parseCurrencyValue(getRowValue(params.rowMap, 'Total Receita'));
    const profit = parseCurrencyValue(getRowValue(params.rowMap, 'Lucro'));
    payload.totalExpense = totalExpense.value;
    payload.totalRevenue = totalRevenue.value;
    payload.profit = profit.value;
    payload.margin = stringValue(getRowValue(params.rowMap, 'Porcentagem'));
    payload.periodLabel = stringValue(getRowValue(params.rowMap, 'Data'));
  }

  const dedupeKey = buildHashedKey(
    params.contract.keys.find((entry) => entry.kind === 'DEDUPE')?.components || [],
    payload,
  );
  const businessKey = buildHashedKey(
    params.contract.keys.find((entry) => entry.kind === 'BUSINESS')?.components || [],
    payload,
  );

  return { payload, dedupeKey, businessKey, messages };
}

export async function prepareWorkbookImport(params: {
  fileName: string;
  buffer: Buffer;
  importMode?: ImportMode;
  source?: SourceType;
  originalPath?: string | null;
  now?: Date;
}): Promise<PreparedWorkbookImport> {
  const workbook = new ExcelJS.Workbook();
  const workbookData = params.buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0];
  await workbook.xlsx.load(workbookData);

  const now = params.now || new Date();
  const checksum = sha256(params.buffer.toString('base64'));
  const fileName = path.basename(params.fileName);
  const sourceSheets: Array<Record<string, unknown>> = [];
  const rawRows: PreparedImportRowRaw[] = [];
  const normalizedRows: PreparedImportRowNormalized[] = [];
  const fileMessages: ImportValidationMessage[] = [];

  for (const worksheet of workbook.worksheets) {
    const contract = WORKBOOK_SHEET_CONTRACT_MAP.get(worksheet.name);
    if (!contract) continue;

    const actualHeaders = contract.expectedColumns.map((_, index) =>
      stringValue(extractCellValue(worksheet.getRow(1).getCell(index + 1).value)),
    );
    const headerFingerprint = sha256(stableStringify(actualHeaders));
    const headerMatchesContract =
      stableStringify(actualHeaders.map((header) => normalizeText(header))) ===
      stableStringify(contract.expectedColumns.map((header) => normalizeText(header)));

    sourceSheets.push({
      sheetName: worksheet.name,
      headerFingerprint,
      rowCount: Math.max(worksheet.rowCount - 1, 0),
      headerMatchesContract,
    });

    if (!headerMatchesContract) {
      pushMessage(fileMessages, {
        code: 'sheet-header-mismatch',
        severity: 'WARNING',
        message: `Cabecalho inesperado na aba ${worksheet.name}`,
        sheetName: worksheet.name,
      });
    }

    let currentSectionLabel: string | null = null;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const rowValues = contract.expectedColumns.map((_, index) =>
        extractCellValue(worksheet.getRow(rowNumber).getCell(index + 1).value),
      );
      if (rowValues.every((entry) => entry == null || entry === '')) continue;

      const rowMap = buildRowMap(contract, rowValues);
      const rowKind = classifyRowKind(contract, rowValues, rowMap);
      if (rowKind === ImportRowKind.SECTION_LABEL) {
        currentSectionLabel = stringValue(rowValues.find((entry) => entry != null && entry !== ''));
      }

      const normalized = buildNormalizedPayload({
        contract,
        rowMap,
        rowKind,
        fileName,
        now,
        currentSectionLabel,
        sourceRowNumber: rowNumber,
      });
      const recordType = mapRecordType(contract);
      const rawPayload = {
        sheetName: worksheet.name,
        rowNumber,
        rowKind,
        actualHeaders,
        cells: rowMap,
      };
      const rawLineKey = sha256(stableStringify({ checksum, sheetName: worksheet.name, rowNumber, rawPayload }));
      const normalizedPayload = toJsonValue(normalized.payload);
      const normalizedLineKey = buildNormalizedLineKey({
        rawLineKey,
        normalizationVersion: WORKBOOK_TEMPLATE_VERSION,
        recordType,
        normalizedPayload,
      });
      const rowStatus = hasError(normalized.messages)
        ? ImportPipelineStatus.REJECTED
        : rowKind === ImportRowKind.DETAIL
          ? ImportPipelineStatus.VALIDATED
          : ImportPipelineStatus.PARSED;

      rawRows.push({
        recordType,
        rowKind,
        sourceSheetName: worksheet.name,
        sourceRowNumber: rowNumber,
        headerFingerprint,
        rawLineKey,
        dedupeKey: normalized.dedupeKey,
        businessKey: normalized.businessKey,
        rawPayload: toJsonValue(rawPayload),
        validationMessages: normalized.messages,
        errorMessage: hasError(normalized.messages)
          ? normalized.messages.find((message) => message.severity === 'ERROR')?.message || null
          : null,
      });

      normalizedRows.push({
        rawLineKey,
        recordType,
        rowKind,
        status: rowStatus,
        sourceSheetName: worksheet.name,
        sourceRowNumber: rowNumber,
        normalizedLineKey,
        dedupeKey: normalized.dedupeKey,
        businessKey: normalized.businessKey,
        normalizationVersion: WORKBOOK_TEMPLATE_VERSION,
        publishable:
          rowKind === ImportRowKind.DETAIL &&
          contract.role !== 'RECONCILIATION_ONLY' &&
          !hasError(normalized.messages),
        normalizedPayload,
        validationMessages: normalized.messages,
        errorMessage: hasError(normalized.messages)
          ? normalized.messages.find((message) => message.severity === 'ERROR')?.message || null
          : null,
      });
    }
  }

  const dedupeCount = new Map<string, number>();
  normalizedRows.forEach((row) => {
    if (!row.publishable || !row.dedupeKey) return;
    dedupeCount.set(row.dedupeKey, (dedupeCount.get(row.dedupeKey) || 0) + 1);
  });
  normalizedRows.forEach((row) => {
    if (!row.publishable || !row.dedupeKey) return;
    if ((dedupeCount.get(row.dedupeKey) || 0) <= 1) return;
    row.validationMessages.push({
      code: 'duplicate-dedupe-key',
      severity: 'WARNING',
      message: 'Linha duplicada no mesmo arquivo pelo dedupeKey.',
      sheetName: row.sourceSheetName,
      rowNumber: row.sourceRowNumber,
    });
  });

  const validationMessages = [...fileMessages, ...normalizedRows.flatMap((row) => row.validationMessages)];
  const validatedRows = normalizedRows.filter((row) => row.status === ImportPipelineStatus.VALIDATED).length;
  const rejectedRows = normalizedRows.filter((row) => row.status === ImportPipelineStatus.REJECTED).length;
  const errorCount = countSeverity(validationMessages, 'ERROR');
  const warningCount = countSeverity(validationMessages, 'WARNING');
  const status = validatedRows === 0 ? ImportPipelineStatus.REJECTED : ImportPipelineStatus.VALIDATED;

  return {
    file: {
      name: fileName,
      checksum,
      fileExtension: path.extname(fileName).toLowerCase(),
      kind: determineFileKind(workbook, fileName),
      importMode: params.importMode || ImportMode.MANUAL_UPLOAD,
      source: params.source || SourceType.LOCAL,
      templateVersion: WORKBOOK_TEMPLATE_VERSION,
      originalPath: params.originalPath || null,
      status,
      uploadedAt: now,
      parsedAt: now,
      validatedAt: status === ImportPipelineStatus.VALIDATED ? now : null,
      rejectedAt: status === ImportPipelineStatus.REJECTED ? now : null,
      totalRows: rawRows.length,
      parsedRows: rawRows.length,
      validatedRows,
      rejectedRows,
      publishedRows: 0,
      warningCount,
      errorCount,
      sourceSheets: toJsonValue(sourceSheets),
      validationMessages: toJsonValue(validationMessages),
      details: toJsonValue({
        templateVersion: WORKBOOK_TEMPLATE_VERSION,
        contractSheets: WORKBOOK_SHEET_CONTRACTS.map((contract) => contract.sheetName),
      }),
    },
    rawRows,
    normalizedRows,
    validationMessages,
  };
}

function deriveBatchStatus(files: Array<{ status: ImportPipelineStatus }>) {
  if (files.some((file) => file.status === ImportPipelineStatus.REJECTED)) {
    return { pipelineStatus: ImportPipelineStatus.REJECTED, processingStatus: 'ERROR' as const };
  }
  if (files.every((file) => file.status === ImportPipelineStatus.PUBLISHED)) {
    return { pipelineStatus: ImportPipelineStatus.PUBLISHED, processingStatus: 'PROCESSED' as const };
  }
  if (files.every((file) => file.status === ImportPipelineStatus.VALIDATED)) {
    return { pipelineStatus: ImportPipelineStatus.VALIDATED, processingStatus: 'PROCESSED' as const };
  }
  if (files.every((file) => file.status === ImportPipelineStatus.PARSED)) {
    return { pipelineStatus: ImportPipelineStatus.PARSED, processingStatus: 'PENDING' as const };
  }
  return { pipelineStatus: ImportPipelineStatus.UPLOADED, processingStatus: 'PENDING' as const };
}

function buildBatchKey(importMode: ImportMode, startedAt: Date): string {
  return `staging:${importMode.toLowerCase()}:${startedAt.toISOString()}`;
}

export async function stageWorkbookImport(params: StageWorkbookImportInput): Promise<StageWorkbookImportResult> {
  const prepared = await prepareWorkbookImport({
    fileName: params.fileName,
    buffer: params.buffer,
    importMode: params.importMode,
    source: params.source,
    originalPath: params.originalPath,
  });

  return db.$transaction(async (tx) => {
    const existingFile = await tx.importFile.findUnique({
      where: { checksum: prepared.file.checksum },
      select: {
        id: true,
        importBatchId: true,
        checksum: true,
        status: true,
        totalRows: true,
        parsedRows: true,
        validatedRows: true,
        rejectedRows: true,
        publishedRows: true,
        warningCount: true,
        errorCount: true,
      },
    });

    if (existingFile) {
      return {
        batchId: existingFile.importBatchId,
        fileId: existingFile.id,
        checksum: existingFile.checksum,
        status: existingFile.status,
        reusedExistingFile: true,
        totalRows: existingFile.totalRows,
        parsedRows: existingFile.parsedRows,
        validatedRows: existingFile.validatedRows,
        rejectedRows: existingFile.rejectedRows,
        publishedRows: existingFile.publishedRows,
        warningCount: existingFile.warningCount,
        errorCount: existingFile.errorCount,
      };
    }

    const batch =
      params.importBatchId != null
        ? await tx.importBatch.findUniqueOrThrow({
            where: { id: params.importBatchId },
            select: { id: true },
          })
        : await tx.importBatch.create({
            data: {
              batchKey: buildBatchKey(prepared.file.importMode, prepared.file.uploadedAt),
              kind: 'WORKBOOK_MULTI_SHEET',
              status: 'PENDING',
              pipelineStatus: ImportPipelineStatus.UPLOADED,
              startedAt: prepared.file.uploadedAt,
              templateVersion: prepared.file.templateVersion,
              details: prepared.file.details,
            },
            select: { id: true },
          });

    const fileRecord = await tx.importFile.create({
      data: {
        importBatchId: batch.id,
        status: prepared.file.status,
        name: prepared.file.name,
        checksum: prepared.file.checksum,
        fileExtension: prepared.file.fileExtension,
        kind: prepared.file.kind,
        importMode: prepared.file.importMode,
        source: prepared.file.source,
        templateVersion: prepared.file.templateVersion,
        originalPath: prepared.file.originalPath,
        uploadedAt: prepared.file.uploadedAt,
        parsedAt: prepared.file.parsedAt,
        validatedAt: prepared.file.validatedAt,
        rejectedAt: prepared.file.rejectedAt,
        totalRows: prepared.file.totalRows,
        parsedRows: prepared.file.parsedRows,
        validatedRows: prepared.file.validatedRows,
        rejectedRows: prepared.file.rejectedRows,
        publishedRows: prepared.file.publishedRows,
        warningCount: prepared.file.warningCount,
        errorCount: prepared.file.errorCount,
        sourceSheets: prepared.file.sourceSheets,
        validationMessages: prepared.file.validationMessages,
        details: prepared.file.details,
      },
      select: { id: true },
    });

    if (prepared.rawRows.length > 0) {
      await tx.importRowRaw.createMany({
        data: prepared.rawRows.map((row) => ({
          importBatchId: batch.id,
          importFileId: fileRecord.id,
          status: ImportPipelineStatus.PARSED,
          recordType: row.recordType,
          rowKind: row.rowKind,
          sourceSheetName: row.sourceSheetName,
          sourceRowNumber: row.sourceRowNumber,
          headerFingerprint: row.headerFingerprint,
          rawLineKey: row.rawLineKey,
          dedupeKey: row.dedupeKey,
          businessKey: row.businessKey,
          rawPayload: row.rawPayload,
          validationMessages: toJsonValue(row.validationMessages),
          errorMessage: row.errorMessage,
        })),
      });
    }

    const rawRowRecords = await tx.importRowRaw.findMany({
      where: { importFileId: fileRecord.id },
      select: { id: true, rawLineKey: true },
    });
    const rawRowIdByKey = new Map(rawRowRecords.map((row) => [row.rawLineKey, row.id]));

    if (prepared.normalizedRows.length > 0) {
      await tx.importRowNormalized.createMany({
        data: prepared.normalizedRows.map((row) => ({
          importBatchId: batch.id,
          importFileId: fileRecord.id,
          importRowRawId: rawRowIdByKey.get(row.rawLineKey)!,
          status: row.status,
          recordType: row.recordType,
          rowKind: row.rowKind,
          sourceSheetName: row.sourceSheetName,
          sourceRowNumber: row.sourceRowNumber,
          normalizedLineKey: row.normalizedLineKey,
          dedupeKey: row.dedupeKey,
          businessKey: row.businessKey,
          normalizationVersion: row.normalizationVersion,
          publishable: row.publishable,
          normalizedPayload: row.normalizedPayload,
          validationMessages: toJsonValue(row.validationMessages),
          errorMessage: row.errorMessage,
        })),
      });
    }

    const batchFiles = await tx.importFile.findMany({
      where: { importBatchId: batch.id },
      select: { status: true, totalRows: true },
    });
    const normalizedRowCounts = await tx.importRowNormalized.groupBy({
      by: ['status', 'publishable'],
      where: { importBatchId: batch.id },
      _count: { _all: true },
    });
    const derivedStatus = deriveBatchStatus(batchFiles.map((file) => ({ status: file.status })));
    const completedAt = new Date();

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: derivedStatus.processingStatus,
        pipelineStatus: derivedStatus.pipelineStatus,
        parsedAt: completedAt,
        validatedAt: derivedStatus.pipelineStatus === ImportPipelineStatus.VALIDATED ? completedAt : null,
        rejectedAt: derivedStatus.pipelineStatus === ImportPipelineStatus.REJECTED ? completedAt : null,
        completedAt,
        uploadCount: batchFiles.length,
        fileCount: batchFiles.length,
        rowCount: batchFiles.reduce((total, file) => total + file.totalRows, 0),
        normalizedRowCount: normalizedRowCounts.reduce((total, entry) => total + entry._count._all, 0),
        rejectedRowCount: normalizedRowCounts
          .filter((entry) => entry.status === ImportPipelineStatus.REJECTED)
          .reduce((total, entry) => total + entry._count._all, 0),
        publishedRowCount: normalizedRowCounts
          .filter((entry) => entry.publishable)
          .reduce((total, entry) => total + entry._count._all, 0),
        templateVersion: prepared.file.templateVersion,
        validationMessages: prepared.file.validationMessages,
        errorMessage:
          derivedStatus.pipelineStatus === ImportPipelineStatus.REJECTED
            ? prepared.validationMessages.find((message) => message.severity === 'ERROR')?.message || null
            : null,
      },
    });

    return {
      batchId: batch.id,
      fileId: fileRecord.id,
      checksum: prepared.file.checksum,
      status: prepared.file.status,
      reusedExistingFile: false,
      totalRows: prepared.file.totalRows,
      parsedRows: prepared.file.parsedRows,
      validatedRows: prepared.file.validatedRows,
      rejectedRows: prepared.file.rejectedRows,
      publishedRows: prepared.file.publishedRows,
      warningCount: prepared.file.warningCount,
      errorCount: prepared.file.errorCount,
    };
  });
}
