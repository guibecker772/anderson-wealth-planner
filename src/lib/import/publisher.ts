import {
  FinePaymentState,
  FinancialEntryDirection,
  FinancialEntryDomain,
  ImportPipelineStatus,
  OperationalPaymentState,
  Prisma,
  ProcessingStatus,
  ResponsibilityType,
} from '@prisma/client';

import { db } from '../db';

type JsonRecord = Record<string, unknown>;

type PublishableNormalizedRow = {
  id: string;
  importBatchId: string;
  importFileId: string;
  recordType: 'OPERATIONAL_SNAPSHOT' | 'FINANCIAL_ENTRY' | 'FINE_RECORD' | 'FINE_RESPONSIBILITY';
  sourceSheetName: string;
  sourceRowNumber: number;
  normalizedLineKey: string;
  dedupeKey: string | null;
  businessKey: string | null;
  normalizedPayload: Prisma.JsonValue;
  publishedRecordId: string | null;
  publishedAt: Date | null;
  status: ImportPipelineStatus;
};

type ImportFileContext = {
  id: string;
  checksum: string;
  name: string;
  kind: 'OPERATIONAL' | 'FINES' | 'FINANCIAL' | 'WORKBOOK' | 'UNKNOWN';
  importMode: 'AUTO_FOLDER' | 'MANUAL_UPLOAD';
  source: 'DRIVE' | 'LOCAL';
  externalFileId: string | null;
  externalModifiedTime: Date | null;
  driveImportFolderId: string | null;
  originalPath: string | null;
  uploadedAt: Date;
  parsedRows: number;
  validatedRows: number;
  rejectedRows: number;
  warningCount: number;
  errorCount: number;
};

export interface PublishBatchResult {
  batchId: string;
  publishedRows: number;
  reusedRows: number;
  skippedRows: number;
  sourceFiles: number;
  operationalSnapshots: number;
  financialEntries: number;
  fineRecords: number;
  fineResponsibilities: number;
  status: 'PUBLISHED' | 'NOOP';
}

function asRecord(value: Prisma.JsonValue): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = asString(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimalString(value: unknown): string | null {
  const numeric = asNumber(value);
  return numeric == null ? null : numeric.toFixed(2);
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleCase(value: string | null | undefined): string | null {
  const text = asString(value);
  if (!text) return null;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizePlate(value: string | null | undefined): string | null {
  const text = asString(value);
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 7 ? normalized : null;
}

function resolveOperationalPaymentState(params: {
  amountPaidWeek: number | null;
  amountToCharge: number | null;
  contractValue: number | null;
}): OperationalPaymentState {
  const amountDue = params.amountToCharge ?? params.contractValue;
  const amountPaid = params.amountPaidWeek ?? 0;

  if (amountPaid > 0 && amountDue !== null) {
    if (amountPaid > amountDue) return OperationalPaymentState.OVERPAID;
    if (amountPaid < amountDue) return OperationalPaymentState.PARTIAL;
    return OperationalPaymentState.PAID;
  }

  if (amountDue !== null && amountDue > 0) {
    return amountPaid > 0 ? OperationalPaymentState.PARTIAL : OperationalPaymentState.UNPAID;
  }

  return amountPaid > 0 ? OperationalPaymentState.PAID : OperationalPaymentState.UNKNOWN;
}

function normalizeFinePaymentState(value: unknown): FinePaymentState {
  const normalized = normalizeText(asString(value));
  if (!normalized) return FinePaymentState.UNKNOWN;
  if (normalized.includes('parcial')) return FinePaymentState.PARTIAL;
  if (normalized.includes('contest')) return FinePaymentState.CONTESTED;
  if (normalized.includes('cancel')) return FinePaymentState.CANCELLED;
  if (normalized.includes('nao')) return FinePaymentState.UNPAID;
  if (normalized.includes('sim') || normalized.includes('paga') || normalized.includes('pago')) return FinePaymentState.PAID;
  return FinePaymentState.UNKNOWN;
}

function normalizeResponsibilityType(value: unknown): ResponsibilityType {
  const normalized = normalizeText(asString(value));
  if (!normalized) return ResponsibilityType.UNKNOWN;
  if (normalized.includes('legal') || normalized.includes('jurid')) return ResponsibilityType.LEGAL;
  if (normalized.includes('motorista') || normalized.includes('condutor') || normalized.includes('driver')) {
    return ResponsibilityType.DRIVER;
  }
  if (normalized.includes('propriet') || normalized.includes('investidor') || normalized.includes('owner')) {
    return ResponsibilityType.OWNER;
  }
  if (normalized.includes('empresa') || normalized.includes('clik') || normalized.includes('click')) {
    return ResponsibilityType.COMPANY;
  }
  return ResponsibilityType.UNKNOWN;
}

function withImportTrace(row: PublishableNormalizedRow, payload: Prisma.JsonValue): Prisma.InputJsonValue {
  const source = asRecord(payload);

  return {
    ...source,
    __importTrace: {
      importBatchId: row.importBatchId,
      importFileId: row.importFileId,
      importRowNormalizedId: row.id,
      normalizedLineKey: row.normalizedLineKey,
      dedupeKey: row.dedupeKey,
      businessKey: row.businessKey,
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
    },
  } as Prisma.InputJsonObject;
}

function responsibilityLookupKeys(payload: JsonRecord): string[] {
  const plate = asString(payload.plate);
  const infractionDate = asString(payload.infractionDate);
  const amount = toDecimalString(payload.amount);
  const keys: string[] = [];
  if (plate && infractionDate && amount) keys.push(`${plate}|${infractionDate}|${amount}`);
  if (plate && infractionDate) keys.push(`${plate}|${infractionDate}`);
  return keys;
}

async function ensureSourceFiles(
  tx: Prisma.TransactionClient,
  batchId: string,
  files: ImportFileContext[],
) {
  const now = new Date();
  const pairs = await Promise.all(
    files.map(async (file) => {
      const details = {
        pipeline: 'published',
        importFileId: file.id,
        publishedAt: now.toISOString(),
      } as Prisma.InputJsonObject;
      const driveIdentifier = file.source === 'DRIVE' && file.externalFileId ? file.externalFileId : file.checksum;
      const parentFolderId = file.driveImportFolderId;
      const modifiedTime = file.externalModifiedTime || file.uploadedAt;

      const sourceFile = await tx.sourceFile.upsert({
        where: { driveFileId: driveIdentifier },
        update: {
          importBatchId: batchId,
          name: file.name,
          parentFolderId,
          modifiedTime,
          checksum: file.checksum,
          processedAt: now,
          status: ProcessingStatus.PROCESSED,
          errorMessage: null,
          source: file.source,
          importMode: file.importMode,
          kind: file.kind,
          originalPath: file.originalPath,
          totalRows: file.parsedRows,
          importedRows: file.validatedRows,
          skippedRows: Math.max(file.parsedRows - file.validatedRows, 0),
          errorCount: file.errorCount,
          details,
        },
        create: {
          driveFileId: driveIdentifier,
          importBatchId: batchId,
          name: file.name,
          parentFolderId,
          modifiedTime,
          checksum: file.checksum,
          processedAt: now,
          status: ProcessingStatus.PROCESSED,
          errorMessage: null,
          source: file.source,
          importMode: file.importMode,
          kind: file.kind,
          originalPath: file.originalPath,
          totalRows: file.parsedRows,
          importedRows: file.validatedRows,
          skippedRows: Math.max(file.parsedRows - file.validatedRows, 0),
          errorCount: file.errorCount,
          details,
        },
        select: { id: true },
      });

      return [file.id, sourceFile.id] as const;
    }),
  );

  return new Map(pairs);
}

async function ensureInvestors(tx: Prisma.TransactionClient, names: string[]) {
  const unique = Array.from(new Set(names.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))));

  if (unique.length > 0) {
    await tx.investor.createMany({
      data: unique.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  const rows = unique.length > 0
    ? await tx.investor.findMany({
        where: { normalizedName: { in: unique.map((name) => normalizeText(name)) } },
        select: { id: true, normalizedName: true },
      })
    : [];

  return new Map(rows.map((row) => [row.normalizedName, row.id]));
}

async function ensureDrivers(tx: Prisma.TransactionClient, names: string[]) {
  const unique = Array.from(new Set(names.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))));

  if (unique.length > 0) {
    await tx.driver.createMany({
      data: unique.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  const rows = unique.length > 0
    ? await tx.driver.findMany({
        where: { normalizedName: { in: unique.map((name) => normalizeText(name)) } },
        select: { id: true, normalizedName: true },
      })
    : [];

  return new Map(rows.map((row) => [row.normalizedName, row.id]));
}

async function ensureVehicles(
  tx: Prisma.TransactionClient,
  vehicles: Array<{ plate: string; plateDisplay?: string | null; model?: string | null }>,
) {
  const uniqueByPlate = new Map<string, { plate: string; plateDisplay?: string | null; model?: string | null }>();

  for (const vehicle of vehicles) {
    if (!vehicle.plate) continue;
    if (!uniqueByPlate.has(vehicle.plate)) uniqueByPlate.set(vehicle.plate, vehicle);
  }

  const unique = Array.from(uniqueByPlate.values());
  if (unique.length > 0) {
    await Promise.all(
      unique.map((vehicle) =>
        tx.vehicle.upsert({
          where: { plate: vehicle.plate },
          update: {
            plateDisplay: vehicle.plateDisplay || vehicle.plate,
            modelLatest: vehicle.model || undefined,
          },
          create: {
            plate: vehicle.plate,
            plateDisplay: vehicle.plateDisplay || vehicle.plate,
            modelLatest: vehicle.model || null,
          },
        }),
      ),
    );
  }

  const rows = unique.length > 0
    ? await tx.vehicle.findMany({
        where: { plate: { in: unique.map((vehicle) => vehicle.plate) } },
        select: { id: true, plate: true },
      })
    : [];

  return new Map(rows.map((row) => [row.plate, row.id]));
}

async function ensureFinancialAccounts(tx: Prisma.TransactionClient, names: string[]) {
  const unique = Array.from(new Set(names.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))));

  if (unique.length > 0) {
    await tx.financialAccount.createMany({
      data: unique.map((name) => ({
        displayName: name,
        normalizedName: normalizeText(name),
      })),
      skipDuplicates: true,
    });
  }

  const rows = unique.length > 0
    ? await tx.financialAccount.findMany({
        where: { normalizedName: { in: unique.map((name) => normalizeText(name)) } },
        select: { id: true, normalizedName: true },
      })
    : [];

  return new Map(rows.map((row) => [row.normalizedName, row.id]));
}

async function markPublishedRow(
  tx: Prisma.TransactionClient,
  rowId: string,
  publishedRecordId: string,
) {
  await tx.importRowNormalized.update({
    where: { id: rowId },
    data: {
      status: ImportPipelineStatus.PUBLISHED,
      publishedRecordId,
      publishedAt: new Date(),
    },
  });
}

export async function publishImportBatch(batchId: string): Promise<PublishBatchResult> {
  return db.$transaction(async (tx) => {
    const batch = await tx.importBatch.findUnique({
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
      throw new Error('Apenas batches validados podem ser publicados');
    }

    const rows = await tx.importRowNormalized.findMany({
      where: {
        importBatchId: batchId,
        publishable: true,
        recordType: { in: ['OPERATIONAL_SNAPSHOT', 'FINANCIAL_ENTRY', 'FINE_RECORD', 'FINE_RESPONSIBILITY'] },
      },
      select: {
        id: true,
        importBatchId: true,
        importFileId: true,
        recordType: true,
        sourceSheetName: true,
        sourceRowNumber: true,
        normalizedLineKey: true,
        dedupeKey: true,
        businessKey: true,
        normalizedPayload: true,
        publishedRecordId: true,
        publishedAt: true,
        status: true,
      },
      orderBy: [{ sourceSheetName: 'asc' }, { sourceRowNumber: 'asc' }],
    }) as PublishableNormalizedRow[];

    if (rows.length === 0) {
      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          pipelineStatus: ImportPipelineStatus.PUBLISHED,
          status: ProcessingStatus.PROCESSED,
          publishedAt: new Date(),
          publishedRowCount: 0,
        },
      });

      return {
        batchId,
        publishedRows: 0,
        reusedRows: 0,
        skippedRows: 0,
        sourceFiles: 0,
        operationalSnapshots: 0,
        financialEntries: 0,
        fineRecords: 0,
        fineResponsibilities: 0,
        status: 'NOOP',
      };
    }

    const fileIds = Array.from(new Set(rows.map((row) => row.importFileId)));
    const files = await tx.importFile.findMany({
      where: { id: { in: fileIds } },
      select: {
        id: true,
        checksum: true,
        name: true,
        kind: true,
        importMode: true,
        source: true,
        externalFileId: true,
        externalModifiedTime: true,
        driveImportFolderId: true,
        originalPath: true,
        uploadedAt: true,
        parsedRows: true,
        validatedRows: true,
        rejectedRows: true,
        warningCount: true,
        errorCount: true,
      },
    }) as ImportFileContext[];

    const sourceFileIdByImportFileId = await ensureSourceFiles(tx, batchId, files);

    const operationalPayloads = rows
      .filter((row) => row.recordType === 'OPERATIONAL_SNAPSHOT')
      .map((row) => asRecord(row.normalizedPayload));
    const financialPayloads = rows
      .filter((row) => row.recordType === 'FINANCIAL_ENTRY')
      .map((row) => asRecord(row.normalizedPayload));
    const finePayloads = rows
      .filter((row) => row.recordType === 'FINE_RECORD')
      .map((row) => asRecord(row.normalizedPayload));
    const responsibilityPayloads = rows
      .filter((row) => row.recordType === 'FINE_RESPONSIBILITY')
      .map((row) => asRecord(row.normalizedPayload));

    const investorByName = await ensureInvestors(
      tx,
      operationalPayloads.map((payload) => asString(payload.investorNormalized)).filter(Boolean) as string[],
    );
    const driverByName = await ensureDrivers(
      tx,
      [
        ...operationalPayloads.map((payload) => asString(payload.driverNormalized)),
        ...finePayloads.map((payload) => asString(payload.driverNormalized)),
      ].filter(Boolean) as string[],
    );
    const vehicleByPlate = await ensureVehicles(
      tx,
      [
        ...operationalPayloads.map((payload) => ({
          plate: normalizePlate(asString(payload.plate)) || '',
          plateDisplay: asString(payload.plateRaw),
          model: titleCase(asString(payload.model)),
        })),
        ...finePayloads.map((payload) => ({
          plate: normalizePlate(asString(payload.plate)) || '',
          plateDisplay: asString(payload.plateRaw),
          model: titleCase(asString(payload.vehicleRaw)),
        })),
        ...responsibilityPayloads.map((payload) => ({
          plate: normalizePlate(asString(payload.plate)) || '',
          plateDisplay: asString(payload.plateRaw),
          model: null,
        })),
      ].filter((vehicle) => Boolean(vehicle.plate)),
    );
    const accountByName = await ensureFinancialAccounts(
      tx,
      financialPayloads.map((payload) => asString(payload.accountRaw)).filter(Boolean) as string[],
    );

    const counters = {
      publishedRows: 0,
      reusedRows: 0,
      skippedRows: 0,
      operationalSnapshots: 0,
      financialEntries: 0,
      fineRecords: 0,
      fineResponsibilities: 0,
    };

    const fineRecordIdByLookup = new Map<string, string>();

    for (const row of rows.filter((entry) => entry.recordType === 'OPERATIONAL_SNAPSHOT')) {
      const payload = asRecord(row.normalizedPayload);
      const sourceFileId = sourceFileIdByImportFileId.get(row.importFileId);
      if (!sourceFileId) throw new Error('SourceFile nao encontrado para linha operacional');

      const existingByHash = await tx.operationalSnapshot.findUnique({
        where: { rowHash: row.normalizedLineKey },
        select: { id: true },
      });

      if (existingByHash) {
        await markPublishedRow(tx, row.id, existingByHash.id);
        counters.reusedRows += 1;
        continue;
      }

      const plate = normalizePlate(asString(payload.plate));
      const referenceDate = asDate(payload.referenceDate);
      if (!plate || !referenceDate) {
        counters.skippedRows += 1;
        continue;
      }

      const investorNormalized = titleCase(asString(payload.investorNormalized));
      const driverNormalized = titleCase(asString(payload.driverNormalized));
      const contractValue = asNumber(payload.contractValue);
      const amountToCharge = asNumber(payload.amountToCharge);
      const amountPaidWeek = asNumber(payload.amountPaidWeek);
      const paymentState = resolveOperationalPaymentState({
        amountPaidWeek,
        amountToCharge,
        contractValue,
      });
      const openAmountBase = amountToCharge ?? contractValue;
      const openAmount =
        openAmountBase == null ? null : Number(Math.max(openAmountBase - (amountPaidWeek ?? 0), 0).toFixed(2));

      const data = {
        sourceFileId,
        importBatchId: batchId,
        investorId: investorNormalized ? investorByName.get(normalizeText(investorNormalized)) || null : null,
        vehicleId: vehicleByPlate.get(plate) || null,
        driverId: driverNormalized ? driverByName.get(normalizeText(driverNormalized)) || null : null,
        rowHash: row.normalizedLineKey,
        operationalKey: row.businessKey || row.normalizedLineKey,
        sheetName: row.sourceSheetName,
        sourceRowNumber: row.sourceRowNumber,
        referenceDate,
        referenceYear: Number(payload.referenceYear || referenceDate.getUTCFullYear()),
        referenceMonth: Number(payload.referenceMonth || referenceDate.getUTCMonth() + 1),
        weekOfMonth: asNumber(payload.weekOfMonth),
        contractActiveRaw: asString(payload.contractActiveRaw),
        contractActive: typeof payload.contractActive === 'boolean' ? payload.contractActive : null,
        vehicleStatusRaw: asString(payload.vehicleStatusRaw),
        vehicleStatusNormalized: titleCase(asString(payload.vehicleStatusNormalized)),
        paymentStatusRaw: asString(payload.paymentStatusRaw),
        paymentState,
        plateRaw: asString(payload.plateRaw),
        plate,
        modelRaw: asString(payload.modelRaw),
        model: titleCase(asString(payload.model)),
        investorRaw: asString(payload.investorRaw),
        investorNormalized,
        driverRaw: asString(payload.driverRaw),
        driverNormalized,
        contractValue: toDecimalString(contractValue),
        lateFeeAmount: toDecimalString(payload.lateFeeAmount),
        discountAmount: toDecimalString(payload.discountAmount),
        amountToCharge: toDecimalString(amountToCharge),
        maintenanceByDriverAmount: toDecimalString(payload.maintenanceByDriverAmount),
        amountPaidWeek: toDecimalString(amountPaidWeek),
        openAmount: toDecimalString(openAmount),
        rawJson: withImportTrace(row, row.normalizedPayload),
      } satisfies Prisma.OperationalSnapshotUncheckedCreateInput;

      const existingByBusinessKey = row.businessKey
        ? await tx.operationalSnapshot.findFirst({
            where: { operationalKey: row.businessKey },
            select: { id: true },
          })
        : null;

      const published = existingByBusinessKey
        ? await tx.operationalSnapshot.update({
            where: { id: existingByBusinessKey.id },
            data,
            select: { id: true },
          })
        : await tx.operationalSnapshot.create({
            data,
            select: { id: true },
          });

      await markPublishedRow(tx, row.id, published.id);
      counters.publishedRows += 1;
      counters.operationalSnapshots += 1;
    }

    for (const row of rows.filter((entry) => entry.recordType === 'FINANCIAL_ENTRY')) {
      const payload = asRecord(row.normalizedPayload);
      const sourceFileId = sourceFileIdByImportFileId.get(row.importFileId);
      if (!sourceFileId) throw new Error('SourceFile nao encontrado para linha financeira');

      const existingByHash = await tx.financialEntry.findUnique({
        where: { rowHash: row.normalizedLineKey },
        select: { id: true },
      });

      if (existingByHash) {
        await markPublishedRow(tx, row.id, existingByHash.id);
        counters.reusedRows += 1;
        continue;
      }

      const entryDate = asDate(payload.entryDate);
      const amount = toDecimalString(payload.amount);
      if (!entryDate || !amount) {
        counters.skippedRows += 1;
        continue;
      }

      const accountRaw = asString(payload.accountRaw);
      const data = {
        sourceFileId,
        importBatchId: batchId,
        financialAccountId: accountRaw ? accountByName.get(normalizeText(accountRaw)) || null : null,
        rowHash: row.normalizedLineKey,
        entryKey: row.businessKey || row.normalizedLineKey,
        sourceSheetName: row.sourceSheetName,
        sourceRowNumber: row.sourceRowNumber,
        domain: (asString(payload.domain) || 'EXPENSE') as FinancialEntryDomain,
        direction: (asString(payload.direction) || 'OUTFLOW') as FinancialEntryDirection,
        entryDate,
        referenceYear: Number(payload.referenceYear || entryDate.getUTCFullYear()),
        referenceMonth: Number(payload.referenceMonth || entryDate.getUTCMonth() + 1),
        groupRaw: asString(payload.groupRaw),
        groupNormalized: titleCase(asString(payload.groupNormalized)),
        detailRaw: asString(payload.detailRaw),
        categoryRaw: asString(payload.categoryRaw),
        accountRaw,
        amount,
        rawJson: withImportTrace(row, row.normalizedPayload),
      } satisfies Prisma.FinancialEntryUncheckedCreateInput;

      const existingByBusinessKey = row.businessKey
        ? await tx.financialEntry.findFirst({
            where: { entryKey: row.businessKey },
            select: { id: true },
          })
        : null;

      const published = existingByBusinessKey
        ? await tx.financialEntry.update({
            where: { id: existingByBusinessKey.id },
            data,
            select: { id: true },
          })
        : await tx.financialEntry.create({
            data,
            select: { id: true },
          });

      await markPublishedRow(tx, row.id, published.id);
      counters.publishedRows += 1;
      counters.financialEntries += 1;
    }

    for (const row of rows.filter((entry) => entry.recordType === 'FINE_RECORD')) {
      const payload = asRecord(row.normalizedPayload);
      const sourceFileId = sourceFileIdByImportFileId.get(row.importFileId);
      if (!sourceFileId) throw new Error('SourceFile nao encontrado para linha de multa');

      const existingByHash = await tx.fineRecord.findUnique({
        where: { rowHash: row.normalizedLineKey },
        select: { id: true },
      });

      if (existingByHash) {
        await markPublishedRow(tx, row.id, existingByHash.id);
        for (const key of responsibilityLookupKeys(payload)) fineRecordIdByLookup.set(key, existingByHash.id);
        counters.reusedRows += 1;
        continue;
      }

      const plate = normalizePlate(asString(payload.plate));
      const infractionDate = asDate(payload.infractionDate);
      if (!plate || !infractionDate) {
        counters.skippedRows += 1;
        continue;
      }

      const driverNormalized = titleCase(asString(payload.driverNormalized));
      const data = {
        sourceFileId,
        importBatchId: batchId,
        vehicleId: vehicleByPlate.get(plate) || null,
        driverId: driverNormalized ? driverByName.get(normalizeText(driverNormalized)) || null : null,
        rowHash: row.normalizedLineKey,
        fineKey: row.businessKey || row.normalizedLineKey,
        sourceSheetName: row.sourceSheetName,
        sourceRowNumber: row.sourceRowNumber,
        infractionDate,
        referenceYear: Number(payload.referenceYear || infractionDate.getUTCFullYear()),
        referenceMonth: Number(payload.referenceMonth || infractionDate.getUTCMonth() + 1),
        issuingAuthorityRaw: asString(payload.issuingAuthorityRaw),
        driverRaw: asString(payload.driverRaw),
        driverNormalized,
        paymentStatusRaw: asString(payload.paymentStatusRaw),
        paymentState: normalizeFinePaymentState(payload.paymentState),
        amount: toDecimalString(payload.amount),
        plateRaw: asString(payload.plateRaw),
        plate,
        aitRaw: asString(payload.aitRaw),
        ait: asString(payload.ait),
        vehicleRaw: titleCase(asString(payload.vehicleRaw)),
        rawJson: withImportTrace(row, row.normalizedPayload),
      } satisfies Prisma.FineRecordUncheckedCreateInput;

      const existingByBusinessKey = row.businessKey
        ? await tx.fineRecord.findFirst({
            where: { fineKey: row.businessKey },
            select: { id: true },
          })
        : null;

      const published = existingByBusinessKey
        ? await tx.fineRecord.update({
            where: { id: existingByBusinessKey.id },
            data,
            select: { id: true },
          })
        : await tx.fineRecord.create({
            data,
            select: { id: true },
          });

      for (const key of responsibilityLookupKeys(payload)) fineRecordIdByLookup.set(key, published.id);
      await markPublishedRow(tx, row.id, published.id);
      counters.publishedRows += 1;
      counters.fineRecords += 1;
    }

    for (const row of rows.filter((entry) => entry.recordType === 'FINE_RESPONSIBILITY')) {
      const payload = asRecord(row.normalizedPayload);
      const sourceFileId = sourceFileIdByImportFileId.get(row.importFileId);
      if (!sourceFileId) throw new Error('SourceFile nao encontrado para linha de responsabilidade');

      const existingByHash = await tx.fineResponsibility.findUnique({
        where: { rowHash: row.normalizedLineKey },
        select: { id: true },
      });

      if (existingByHash) {
        await markPublishedRow(tx, row.id, existingByHash.id);
        counters.reusedRows += 1;
        continue;
      }

      const plate = normalizePlate(asString(payload.plate));
      const infractionDate = asDate(payload.infractionDate);
      const paymentDate = asDate(payload.paymentDate);
      const fineRecordId =
        responsibilityLookupKeys(payload)
          .map((key) => fineRecordIdByLookup.get(key))
          .find((value): value is string => Boolean(value)) || null;

      const data = {
        sourceFileId,
        importBatchId: batchId,
        fineRecordId,
        vehicleId: plate ? vehicleByPlate.get(plate) || null : null,
        rowHash: row.normalizedLineKey,
        responsibilityKey: row.businessKey || row.normalizedLineKey,
        sourceSheetName: row.sourceSheetName,
        sourceRowNumber: row.sourceRowNumber,
        sectionLabelRaw: asString(payload.sectionLabelRaw),
        payerContextRaw: asString(payload.payerContextRaw),
        responsibilityType: normalizeResponsibilityType(payload.responsibilityType),
        plateRaw: asString(payload.plateRaw),
        plate,
        infractionDate,
        paymentDate,
        amount: toDecimalString(payload.amount),
        payeeRaw: asString(payload.payeeRaw),
        rawJson: withImportTrace(row, row.normalizedPayload),
      } satisfies Prisma.FineResponsibilityUncheckedCreateInput;

      const existingByBusinessKey = row.businessKey
        ? await tx.fineResponsibility.findFirst({
            where: { responsibilityKey: row.businessKey },
            select: { id: true },
          })
        : null;

      const published = existingByBusinessKey
        ? await tx.fineResponsibility.update({
            where: { id: existingByBusinessKey.id },
            data,
            select: { id: true },
          })
        : await tx.fineResponsibility.create({
            data,
            select: { id: true },
          });

      await markPublishedRow(tx, row.id, published.id);
      counters.publishedRows += 1;
      counters.fineResponsibilities += 1;
    }

    const publishedAt = new Date();

    for (const file of files) {
      const publishedRows = await tx.importRowNormalized.count({
        where: {
          importFileId: file.id,
          status: ImportPipelineStatus.PUBLISHED,
          publishedRecordId: { not: null },
        },
      });

      await tx.importFile.update({
        where: { id: file.id },
        data: {
          status: ImportPipelineStatus.PUBLISHED,
          publishedAt,
          publishedRows,
        },
      });
    }

    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        pipelineStatus: ImportPipelineStatus.PUBLISHED,
        status: ProcessingStatus.PROCESSED,
        publishedAt,
        publishedRowCount: counters.publishedRows + counters.reusedRows,
      },
    });

    return {
      batchId,
      publishedRows: counters.publishedRows,
      reusedRows: counters.reusedRows,
      skippedRows: counters.skippedRows,
      sourceFiles: files.length,
      operationalSnapshots: counters.operationalSnapshots,
      financialEntries: counters.financialEntries,
      fineRecords: counters.fineRecords,
      fineResponsibilities: counters.fineResponsibilities,
      status: counters.publishedRows + counters.reusedRows > 0 ? 'PUBLISHED' : 'NOOP',
    };
  });
}
