import { PrismaClient } from '@prisma/client';
import { type DateRangeStrings, dateRangeToDbFilter } from '@/lib/dateRange';

export interface Investor {
  id: string;
  name: string;
  vehicles: string[];
}

export interface InvestorVehicleMetrics {
  plate: string;
  status: string;
  rentalIncome: number;
  maintenanceCost: number;
  finesCost: number;
  netResult: number;
  qualitySummary: Record<InvestorQualityStatus, number>;
}

export interface InvestorFinancialLink {
  id: string;
  entryDate: string;
  domain: 'REVENUE' | 'EXPENSE';
  direction: 'INFLOW' | 'OUTFLOW';
  amount: number;
  groupRaw: string | null;
  detailRaw: string | null;
  categoryRaw: string | null;
  accountRaw: string | null;
  ruleCode: string;
  ruleLabel: string;
  matchedField: 'groupRaw' | 'detailRaw' | 'accountRaw';
  matchedText: string;
  rationale: string;
  sourceSheetName: string;
  sourceRowNumber: number;
}

export interface InvestorMetrics {
  investor: Investor;
  totals: {
    operationalRevenue: number;
    operationalCost: number;
    operationalFines: number;
    operationalDiscount: number;
    operationalResult: number;
    identifiedFinancialInflow: number;
    identifiedFinancialOutflow: number;
    identifiedFinancialNet: number;
    expandedResult: number;
  };
  vehicles: InvestorVehicleMetrics[];
  financialLinks: InvestorFinancialLink[];
  allocationSummary: {
    linkedEntryCount: number;
    linkedRevenueCount: number;
    linkedExpenseCount: number;
    linkageCoverageNote: string;
    excludedFromInvestorResult: string[];
  };
  qualitySummary: Record<InvestorQualityStatus, number>;
  dateRange: DateRangeStrings;
}

export interface InvestorListItem extends Investor {
  identifiedFinancialInflow: number;
  identifiedFinancialOutflow: number;
  linkedEntryCount: number;
}

export interface InvestorListResponse {
  investors: InvestorListItem[];
  total: number;
  summary: {
    investorsWithFinancialLinks: number;
    identifiedFinancialInflow: number;
    identifiedFinancialOutflow: number;
    corporateUnallocatedRevenue: number;
    corporateUnallocatedExpense: number;
  };
  dateRange?: DateRangeStrings;
}

type InvestorQualityStatus = 'OK' | 'WARNING' | 'REVIEW_REQUIRED' | 'UNKNOWN';

type SnapshotRow = {
  referenceDate: Date;
  vehicleStatusNormalized: string | null;
  plate: string;
  investorNormalized: string | null;
  maintenanceByDriverAmount: unknown;
  lateFeeAmount: unknown;
  discountAmount: unknown;
  amountPaidWeek: unknown;
  rawJson: unknown;
};

type FinancialRow = {
  id: string;
  domain: 'REVENUE' | 'EXPENSE';
  direction: 'INFLOW' | 'OUTFLOW';
  entryDate: Date;
  groupRaw: string | null;
  detailRaw: string | null;
  categoryRaw: string | null;
  accountRaw: string | null;
  amount: unknown;
  sourceSheetName: string;
  sourceRowNumber: number;
};

type InvestorFinancialMatch = {
  investorName: string;
  ruleCode: string;
  ruleLabel: string;
  matchedField: 'groupRaw' | 'detailRaw' | 'accountRaw';
  matchedText: string;
  rationale: string;
};

type LinkageSummary = {
  byInvestor: Map<string, InvestorFinancialLink[]>;
  allocatedRevenue: number;
  allocatedExpense: number;
  totalRevenue: number;
  totalExpense: number;
};

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugifyInvestor(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQualityStatus(rawJson: unknown): InvestorQualityStatus {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return 'UNKNOWN';
  const quality = (rawJson as Record<string, unknown>)['__quality'];
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return 'UNKNOWN';
  const status = (quality as Record<string, unknown>)['status'];
  if (status === 'OK' || status === 'WARNING' || status === 'REVIEW_REQUIRED') return status;
  return 'UNKNOWN';
}

function emptyQualitySummary(): Record<InvestorQualityStatus, number> {
  return { OK: 0, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 };
}

function buildInvestorListFromSnapshots(rows: Array<{ investorNormalized: string | null; plate: string }>): InvestorListItem[] {
  const vehiclesByInvestor = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.investorNormalized) continue;
    const vehicles = vehiclesByInvestor.get(row.investorNormalized) ?? new Set<string>();
    vehicles.add(row.plate);
    vehiclesByInvestor.set(row.investorNormalized, vehicles);
  }

  return Array.from(vehiclesByInvestor.entries())
    .map(([name, vehicles]) => ({
      id: slugifyInvestor(name),
      name,
      vehicles: Array.from(vehicles).sort(),
      identifiedFinancialInflow: 0,
      identifiedFinancialOutflow: 0,
      linkedEntryCount: 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function tryMatchInvestorInField(
  fieldName: 'groupRaw' | 'detailRaw' | 'accountRaw',
  fieldValue: string | null,
  investorNames: string[]
): InvestorFinancialMatch | null {
  const normalizedField = normalizeText(fieldValue);
  if (!normalizedField) return null;

  for (const investorName of investorNames) {
    const normalizedInvestor = normalizeText(investorName);
    if (!normalizedInvestor) continue;

    const exactTransferPattern = new RegExp(`^(transferencias?|repasses?|repasse|investidor|investidores|pagamento|pagto) ${normalizedInvestor}$`);
    const containsTransferPattern = new RegExp(`\\b(transferencias?|repasses?|repasse|investidor|investidores|pagamento|pagto)\\b.*\\b${normalizedInvestor}\\b`);

    if (exactTransferPattern.test(normalizedField) || containsTransferPattern.test(normalizedField)) {
      return {
        investorName,
        ruleCode: `${fieldName.toUpperCase()}_INVESTOR_KEYWORD_EXACT`,
        ruleLabel: `Nome do investidor identificado em ${fieldName} com palavra-chave financeira`,
        matchedField: fieldName,
        matchedText: fieldValue || '',
        rationale: `O campo ${fieldName} contém o nome do investidor com contexto explícito de repasse/transferência.`,
      };
    }
  }

  return null;
}

function detectFinancialInvestorMatch(row: FinancialRow, investorNames: string[]): InvestorFinancialMatch | null {
  if (row.domain !== 'EXPENSE') return null;

  const matches = [
    tryMatchInvestorInField('groupRaw', row.groupRaw, investorNames),
    tryMatchInvestorInField('detailRaw', row.detailRaw, investorNames),
    tryMatchInvestorInField('accountRaw', row.accountRaw, investorNames),
  ].filter((match): match is InvestorFinancialMatch => Boolean(match));

  if (matches.length !== 1) return null;
  return matches[0];
}

async function listInvestorRows(db: PrismaClient, dateRange?: DateRangeStrings): Promise<Array<{ investorNormalized: string | null; plate: string }>> {
  const dateFilter = dateRange ? dateRangeToDbFilter(dateRange) : null;
  return db.operationalSnapshot.findMany({
    where: {
      investorNormalized: { not: null },
      ...(dateFilter ? {
        referenceDate: {
          gte: dateFilter.gte,
          lte: dateFilter.lte,
        },
      } : {}),
    },
    select: {
      investorNormalized: true,
      plate: true,
    },
    orderBy: [{ investorNormalized: 'asc' }, { plate: 'asc' }],
  });
}

async function listOperationalSnapshots(db: PrismaClient, investorName: string, dateRange: DateRangeStrings): Promise<SnapshotRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.operationalSnapshot.findMany({
    where: {
      investorNormalized: investorName,
      referenceDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
    },
    select: {
      referenceDate: true,
      vehicleStatusNormalized: true,
      plate: true,
      investorNormalized: true,
      maintenanceByDriverAmount: true,
      lateFeeAmount: true,
      discountAmount: true,
      amountPaidWeek: true,
      rawJson: true,
    },
    orderBy: [{ referenceDate: 'desc' }, { plate: 'asc' }],
  }) as Promise<SnapshotRow[]>;
}

async function listFinancialRows(db: PrismaClient, dateRange: DateRangeStrings): Promise<FinancialRow[]> {
  const dateFilter = dateRangeToDbFilter(dateRange);
  return db.financialEntry.findMany({
    where: {
      entryDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
      domain: { in: ['REVENUE', 'EXPENSE'] },
    },
    select: {
      id: true,
      domain: true,
      direction: true,
      entryDate: true,
      groupRaw: true,
      detailRaw: true,
      categoryRaw: true,
      accountRaw: true,
      amount: true,
      sourceSheetName: true,
      sourceRowNumber: true,
    },
    orderBy: [{ entryDate: 'desc' }, { sourceRowNumber: 'asc' }],
  }) as Promise<FinancialRow[]>;
}

async function buildFinancialLinkageSummary(
  db: PrismaClient,
  dateRange: DateRangeStrings,
  investors: InvestorListItem[]
): Promise<LinkageSummary> {
  const investorNames = investors.map((investor) => investor.name);
  const byInvestor = new Map<string, InvestorFinancialLink[]>();
  const rows = await listFinancialRows(db, dateRange);

  let allocatedRevenue = 0;
  let allocatedExpense = 0;
  let totalRevenue = 0;
  let totalExpense = 0;

  for (const row of rows) {
    const amount = clampMoney(toNumber(row.amount));
    if (row.domain === 'REVENUE') totalRevenue += amount;
    if (row.domain === 'EXPENSE') totalExpense += amount;

    const match = detectFinancialInvestorMatch(row, investorNames);
    if (!match) continue;

    const current = byInvestor.get(match.investorName) ?? [];
    current.push({
      id: row.id,
      entryDate: row.entryDate.toISOString().slice(0, 10),
      domain: row.domain,
      direction: row.direction,
      amount,
      groupRaw: row.groupRaw,
      detailRaw: row.detailRaw,
      categoryRaw: row.categoryRaw,
      accountRaw: row.accountRaw,
      ruleCode: match.ruleCode,
      ruleLabel: match.ruleLabel,
      matchedField: match.matchedField,
      matchedText: match.matchedText,
      rationale: match.rationale,
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
    });
    byInvestor.set(match.investorName, current);

    if (row.domain === 'REVENUE') allocatedRevenue += amount;
    if (row.domain === 'EXPENSE') allocatedExpense += amount;
  }

  return {
    byInvestor,
    allocatedRevenue: clampMoney(allocatedRevenue),
    allocatedExpense: clampMoney(allocatedExpense),
    totalRevenue: clampMoney(totalRevenue),
    totalExpense: clampMoney(totalExpense),
  };
}

export async function getInvestorList(db: PrismaClient, dateRange?: DateRangeStrings): Promise<InvestorListResponse> {
  const investors = buildInvestorListFromSnapshots(await listInvestorRows(db, dateRange));

  if (!dateRange) {
    return {
      investors,
      total: investors.length,
      summary: {
        investorsWithFinancialLinks: 0,
        identifiedFinancialInflow: 0,
        identifiedFinancialOutflow: 0,
        corporateUnallocatedRevenue: 0,
        corporateUnallocatedExpense: 0,
      },
    };
  }

  const linkage = await buildFinancialLinkageSummary(db, dateRange, investors);
  const enriched = investors.map((investor) => {
    const links = linkage.byInvestor.get(investor.name) ?? [];
    return {
      ...investor,
      identifiedFinancialInflow: clampMoney(
        links.filter((item) => item.domain === 'REVENUE').reduce((acc, item) => acc + item.amount, 0)
      ),
      identifiedFinancialOutflow: clampMoney(
        links.filter((item) => item.domain === 'EXPENSE').reduce((acc, item) => acc + item.amount, 0)
      ),
      linkedEntryCount: links.length,
    };
  });

  return {
    investors: enriched,
    total: enriched.length,
    summary: {
      investorsWithFinancialLinks: enriched.filter((investor) => investor.linkedEntryCount > 0).length,
      identifiedFinancialInflow: linkage.allocatedRevenue,
      identifiedFinancialOutflow: linkage.allocatedExpense,
      corporateUnallocatedRevenue: clampMoney(linkage.totalRevenue - linkage.allocatedRevenue),
      corporateUnallocatedExpense: clampMoney(linkage.totalExpense - linkage.allocatedExpense),
    },
    dateRange,
  };
}

export async function getInvestorMetrics(
  db: PrismaClient,
  investorId: string,
  dateRange: DateRangeStrings
): Promise<InvestorMetrics | null> {
  const list = await getInvestorList(db, dateRange);
  const investor = list.investors.find((item) => item.id === investorId);
  if (!investor) return null;

  const [rows, linkage] = await Promise.all([
    listOperationalSnapshots(db, investor.name, dateRange),
    buildFinancialLinkageSummary(db, dateRange, list.investors),
  ]);

  const vehicleMap = new Map<string, InvestorVehicleMetrics>();
  for (const row of rows) {
    const qualityStatus = getQualityStatus(row.rawJson);
    const current = vehicleMap.get(row.plate) ?? {
      plate: row.plate,
      status: row.vehicleStatusNormalized || 'Sem situacao',
      rentalIncome: 0,
      maintenanceCost: 0,
      finesCost: 0,
      netResult: 0,
      qualitySummary: emptyQualitySummary(),
    };

    current.status = row.vehicleStatusNormalized || current.status;
    current.rentalIncome += toNumber(row.amountPaidWeek);
    current.maintenanceCost += toNumber(row.maintenanceByDriverAmount) + toNumber(row.discountAmount);
    current.finesCost += toNumber(row.lateFeeAmount);
    current.qualitySummary[qualityStatus] += 1;
    vehicleMap.set(row.plate, current);
  }

  const vehicles = Array.from(vehicleMap.values())
    .map((vehicle) => ({
      ...vehicle,
      rentalIncome: clampMoney(vehicle.rentalIncome),
      maintenanceCost: clampMoney(vehicle.maintenanceCost),
      finesCost: clampMoney(vehicle.finesCost),
      netResult: clampMoney(vehicle.rentalIncome - vehicle.maintenanceCost - vehicle.finesCost),
    }))
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const operationalRevenue = clampMoney(vehicles.reduce((acc, vehicle) => acc + vehicle.rentalIncome, 0));
  const operationalMaintenance = clampMoney(rows.reduce((acc, row) => acc + toNumber(row.maintenanceByDriverAmount), 0));
  const operationalDiscount = clampMoney(rows.reduce((acc, row) => acc + toNumber(row.discountAmount), 0));
  const operationalFines = clampMoney(rows.reduce((acc, row) => acc + toNumber(row.lateFeeAmount), 0));
  const operationalCost = clampMoney(operationalMaintenance + operationalDiscount + operationalFines);
  const operationalResult = clampMoney(operationalRevenue - operationalCost);

  const financialLinks = (linkage.byInvestor.get(investor.name) ?? [])
    .slice()
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  const identifiedFinancialInflow = clampMoney(
    financialLinks.filter((item) => item.domain === 'REVENUE').reduce((acc, item) => acc + item.amount, 0)
  );
  const identifiedFinancialOutflow = clampMoney(
    financialLinks.filter((item) => item.domain === 'EXPENSE').reduce((acc, item) => acc + item.amount, 0)
  );
  const identifiedFinancialNet = clampMoney(identifiedFinancialInflow - identifiedFinancialOutflow);

  return {
    investor: {
      id: investor.id,
      name: investor.name,
      vehicles: investor.vehicles,
    },
    totals: {
      operationalRevenue,
      operationalCost,
      operationalFines,
      operationalDiscount,
      operationalResult,
      identifiedFinancialInflow,
      identifiedFinancialOutflow,
      identifiedFinancialNet,
      expandedResult: clampMoney(operationalResult + identifiedFinancialNet),
    },
    vehicles,
    financialLinks,
    allocationSummary: {
      linkedEntryCount: financialLinks.length,
      linkedRevenueCount: financialLinks.filter((item) => item.domain === 'REVENUE').length,
      linkedExpenseCount: financialLinks.filter((item) => item.domain === 'EXPENSE').length,
      linkageCoverageNote: 'Somente lançamentos com nome explícito do investidor em contexto financeiro foram vinculados. O restante permanece corporativo/não alocado.',
      excludedFromInvestorResult: [
        'Repasse investidores sem nome explícito do beneficiário',
        'Impostos, juros e despesa fixa',
        'Não identificado e transferências ambíguas',
        'Pagamento de multas e multas oficiais sem aba Quem Pagou',
        'Investimentos/capex sem vínculo individual explícito',
      ],
    },
    qualitySummary: rows.reduce((acc, row) => {
      acc[getQualityStatus(row.rawJson)] += 1;
      return acc;
    }, emptyQualitySummary()),
    dateRange,
  };
}

export async function getAllInvestorsMetrics(client: PrismaClient, dateRange: DateRangeStrings) {
  const investors = await getInvestorList(client, dateRange);
  const metrics = await Promise.all(
    investors.investors.map((investor) => getInvestorMetrics(client, investor.id, dateRange))
  );
  return { investors: metrics.filter(Boolean), dateRange };
}
