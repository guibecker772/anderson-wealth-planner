export const WORKBOOK_TEMPLATE_VERSION = 'clikfinance_workbook_v1' as const;
export const WORKBOOK_SAMPLE_FILE = 'samples/planilha teste carros.xlsm' as const;

export type WorkbookCanonicalLayer =
  | 'OPERATIONAL'
  | 'FINANCIAL'
  | 'FINES'
  | 'RESPONSIBILITY'
  | 'RECONCILIATION';

export type WorkbookSheetRole =
  | 'CANONICAL'
  | 'CANONICAL_WITH_SPECIAL_PARSER'
  | 'RECONCILIATION_ONLY';

export type WorkbookSheetId =
  | 'PLANILHA_TESTE_CARROS'
  | 'RECEITA'
  | 'DESPESA'
  | 'INVESTIMENTOS'
  | 'MULTAS'
  | 'QUEM_PAGOU'
  | 'LUCRO';

export type WorkbookColumnValueType =
  | 'TEXT'
  | 'TEXT_ENUM'
  | 'TEXT_FORMULA'
  | 'PLATE'
  | 'DATE'
  | 'DATETIME'
  | 'INTEGER'
  | 'CURRENCY'
  | 'PERCENTAGE';

export type WorkbookColumnRequirement =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'CONDITIONAL'
  | 'DERIVED'
  | 'STRUCTURAL';

export type WorkbookKeyKind = 'RAW_LINE' | 'DEDUPE' | 'BUSINESS';
export type WorkbookValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface WorkbookColumnContract {
  header: string;
  targetFields: string[];
  valueType: WorkbookColumnValueType;
  requirement: WorkbookColumnRequirement;
}

export interface WorkbookKeyContract {
  kind: WorkbookKeyKind;
  scope: 'RAW' | 'NORMALIZED' | 'CANONICAL';
  strategy: 'SHA256';
  components: string[];
}

export interface WorkbookValidationRule {
  code: string;
  severity: WorkbookValidationSeverity;
  description: string;
}

export interface WorkbookSheetContract {
  id: WorkbookSheetId;
  sheetName: string;
  layer: WorkbookCanonicalLayer;
  role: WorkbookSheetRole;
  canonicalRecordType: string;
  columns: WorkbookColumnContract[];
  expectedColumns: string[];
  requiredColumns: string[];
  validationRules: WorkbookValidationRule[];
  keys: WorkbookKeyContract[];
}

export interface WorkbookNormalizationLayerContract {
  layer: 'RAW' | 'NORMALIZED' | 'CANONICAL';
  recordTypes: string[];
  purpose: string;
  keys: string[];
}

function sheet(input: Omit<WorkbookSheetContract, 'expectedColumns' | 'requiredColumns'>): WorkbookSheetContract {
  return {
    ...input,
    expectedColumns: input.columns.map((column) => column.header),
    requiredColumns: input.columns
      .filter((column) => column.requirement === 'REQUIRED')
      .map((column) => column.header),
  };
}

export const WORKBOOK_NORMALIZATION_LAYERS: WorkbookNormalizationLayerContract[] = [
  {
    layer: 'RAW',
    recordTypes: ['ImportWorkbookRow'],
    purpose: 'Reter a linha original, incluindo subtotal, secao e ruido auditavel.',
    keys: ['rawLineKey', 'sourceFileId', 'sheetName', 'sourceRowNumber', 'headerFingerprint'],
  },
  {
    layer: 'NORMALIZED',
    recordTypes: [
      'NormalizedOperationalRow',
      'NormalizedFinancialRow',
      'NormalizedFineRow',
      'NormalizedResponsibilityRow',
    ],
    purpose: 'Tipar, normalizar, classificar rowKind e gerar dedupeKey/businessKey.',
    keys: ['rawLineKey', 'dedupeKey', 'businessKey', 'normalizationVersion'],
  },
  {
    layer: 'CANONICAL',
    recordTypes: ['OperationalSnapshot', 'FinancialEntry', 'FineRecord', 'FineResponsibility'],
    purpose: 'Persistir apenas fatos aceitos pelo contrato v1.',
    keys: ['dedupeKey', 'businessKey', 'sourceFileId', 'importBatchId'],
  },
];

export const WORKBOOK_SHEET_CONTRACTS: WorkbookSheetContract[] = [
  sheet({
    id: 'PLANILHA_TESTE_CARROS',
    sheetName: 'planilha teste carros',
    layer: 'OPERATIONAL',
    role: 'CANONICAL',
    canonicalRecordType: 'OperationalSnapshot',
    columns: [
      { header: 'Data', targetFields: ['referenceDate', 'referenceYear', 'referenceMonth'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'Semana', targetFields: ['weekOfMonth'], valueType: 'INTEGER', requirement: 'REQUIRED' },
      { header: 'Contrato ativo', targetFields: ['contractActiveRaw', 'contractActive'], valueType: 'TEXT_ENUM', requirement: 'CONDITIONAL' },
      { header: 'Situa\u00e7\u00e3o de ve\u00edculo', targetFields: ['vehicleStatusRaw', 'vehicleStatusNormalized'], valueType: 'TEXT_ENUM', requirement: 'REQUIRED' },
      { header: 'Placa', targetFields: ['plateRaw', 'plate'], valueType: 'PLATE', requirement: 'REQUIRED' },
      { header: 'Modelo', targetFields: ['modelRaw', 'model'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Propriet\u00e1rio', targetFields: ['investorRaw', 'investorNormalized'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Motorista', targetFields: ['driverRaw', 'driverNormalized'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Valor contrato', targetFields: ['contractValue'], valueType: 'CURRENCY', requirement: 'CONDITIONAL' },
      { header: 'Multa/atraso', targetFields: ['lateFeeAmount'], valueType: 'CURRENCY', requirement: 'OPTIONAL' },
      { header: 'Desconto', targetFields: ['discountAmount'], valueType: 'CURRENCY', requirement: 'OPTIONAL' },
      { header: 'Valor \u00e0 Cobrar', targetFields: ['amountToCharge'], valueType: 'CURRENCY', requirement: 'CONDITIONAL' },
      { header: 'Manuten\u00e7\u00e3o por motorista', targetFields: ['maintenanceByDriverAmount'], valueType: 'CURRENCY', requirement: 'OPTIONAL' },
      { header: 'Valor Pago (Semana)', targetFields: ['amountPaidWeek'], valueType: 'CURRENCY', requirement: 'OPTIONAL' },
    ],
    validationRules: [
      { code: 'operational-required-core', severity: 'ERROR', description: 'Data, Semana, Situacao de veiculo, Placa, Modelo e Proprietario sao obrigatorios.' },
      { code: 'operational-short-row-warning', severity: 'WARNING', description: 'Linhas curtas fora de operacao geram warning, nao descarte automatico.' },
      { code: 'operational-financial-anomaly', severity: 'WARNING', description: 'Divergencia entre contrato, ajustes e cobranca precisa ser rastreada.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['plate', 'referenceDate', 'weekOfMonth', 'investorNormalized', 'amountToCharge', 'amountPaidWeek'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['plate', 'referenceYear', 'referenceMonth', 'weekOfMonth', 'investorNormalized'] },
    ],
  }),
  sheet({
    id: 'RECEITA',
    sheetName: 'Receita',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    canonicalRecordType: 'FinancialEntry',
    columns: [
      { header: 'Origem', targetFields: ['groupRaw', 'groupNormalized'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Valor R$', targetFields: ['amount'], valueType: 'CURRENCY', requirement: 'REQUIRED' },
      { header: 'Destino', targetFields: ['accountRaw'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Data', targetFields: ['entryDate', 'referenceYear', 'referenceMonth'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'M\u00eas', targetFields: ['derivedMonthLabel'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
      { header: 'Ano', targetFields: ['derivedYear'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
    ],
    validationRules: [
      { code: 'revenue-required-core', severity: 'ERROR', description: 'Origem, Valor R$, Destino e Data sao obrigatorios.' },
      { code: 'revenue-ignore-formula-only-rows', severity: 'WARNING', description: 'Linhas com apenas formulas em Mes/Ano devem ser ignoradas.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['domain=REVENUE', 'entryDate', 'amount', 'groupRaw', 'accountRaw'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['domain=REVENUE', 'entryDate', 'amount', 'groupRaw', 'accountRaw'] },
    ],
  }),
  sheet({
    id: 'DESPESA',
    sheetName: 'Despesa',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    canonicalRecordType: 'FinancialEntry',
    columns: [
      { header: 'Tipo de Gasto', targetFields: ['groupRaw', 'groupNormalized'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Detalhamento', targetFields: ['detailRaw'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Categoria', targetFields: ['categoryRaw'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Valor R$', targetFields: ['amount'], valueType: 'CURRENCY', requirement: 'REQUIRED' },
      { header: 'Fonte', targetFields: ['accountRaw'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Data', targetFields: ['entryDate', 'referenceYear', 'referenceMonth'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'M\u00eas', targetFields: ['derivedMonthLabel'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
      { header: 'Ano', targetFields: ['derivedYear'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
    ],
    validationRules: [
      { code: 'expense-required-core', severity: 'ERROR', description: 'Tipo de Gasto, Valor R$, Fonte e Data sao obrigatorios.' },
      { code: 'expense-detail-optional', severity: 'INFO', description: 'Detalhamento pode ser nulo sem invalidar a linha.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['domain=EXPENSE', 'entryDate', 'amount', 'groupRaw', 'detailRaw', 'categoryRaw', 'accountRaw'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['domain=EXPENSE', 'entryDate', 'amount', 'groupRaw', 'accountRaw'] },
    ],
  }),
  sheet({
    id: 'INVESTIMENTOS',
    sheetName: 'Investimentos',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    canonicalRecordType: 'FinancialEntry',
    columns: [
      { header: 'Investimento', targetFields: ['groupRaw', 'groupNormalized'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Valor R$', targetFields: ['amount'], valueType: 'CURRENCY', requirement: 'REQUIRED' },
      { header: 'Fonte', targetFields: ['accountRaw'], valueType: 'TEXT', requirement: 'REQUIRED' },
      { header: 'Data', targetFields: ['entryDate', 'referenceYear', 'referenceMonth'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'M\u00eas', targetFields: ['derivedMonthLabel'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
      { header: 'Ano', targetFields: ['derivedYear'], valueType: 'TEXT_FORMULA', requirement: 'DERIVED' },
    ],
    validationRules: [
      { code: 'investment-required-core', severity: 'ERROR', description: 'Investimento, Valor R$, Fonte e Data sao obrigatorios.' },
      { code: 'investment-separate-from-opex', severity: 'INFO', description: 'Investimentos devem permanecer separados de OPEX.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['domain=INVESTMENT', 'entryDate', 'amount', 'groupRaw', 'accountRaw'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['domain=INVESTMENT', 'entryDate', 'amount', 'groupRaw', 'accountRaw'] },
    ],
  }),
  sheet({
    id: 'MULTAS',
    sheetName: 'Multas',
    layer: 'FINES',
    role: 'CANONICAL',
    canonicalRecordType: 'FineRecord',
    columns: [
      { header: '\u00d3rg\u00e3o autuador', targetFields: ['issuingAuthorityRaw'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Condutor', targetFields: ['driverRaw', 'driverNormalized'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Paga', targetFields: ['paymentStatusRaw', 'paymentState'], valueType: 'TEXT_ENUM', requirement: 'OPTIONAL' },
      { header: 'Valor', targetFields: ['amount'], valueType: 'CURRENCY', requirement: 'REQUIRED' },
      { header: 'Placa', targetFields: ['plateRaw', 'plate'], valueType: 'PLATE', requirement: 'REQUIRED' },
      { header: 'Auto de infra\u00e7\u00e3o', targetFields: ['aitRaw', 'ait'], valueType: 'TEXT', requirement: 'CONDITIONAL' },
      { header: 'Ve\u00edculo', targetFields: ['vehicleRaw'], valueType: 'TEXT', requirement: 'OPTIONAL' },
      { header: 'Data da infra\u00e7\u00e3o', targetFields: ['infractionDate', 'referenceYear', 'referenceMonth'], valueType: 'DATETIME', requirement: 'REQUIRED' },
    ],
    validationRules: [
      { code: 'fines-required-core', severity: 'ERROR', description: 'Placa, Valor e Data da infracao sao obrigatorios.' },
      { code: 'fines-ait-conflict', severity: 'WARNING', description: 'AIT repetido com payload divergente deve virar conflito explicito.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['ait || plate', 'infractionDate', 'amount', 'issuingAuthorityRaw'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['ait || plate', 'infractionDate', 'amount', 'issuingAuthorityRaw'] },
    ],
  }),
  sheet({
    id: 'QUEM_PAGOU',
    sheetName: 'Quem Pagou',
    layer: 'RESPONSIBILITY',
    role: 'CANONICAL_WITH_SPECIAL_PARSER',
    canonicalRecordType: 'FineResponsibility',
    columns: [
      { header: 'PLACA', targetFields: ['plateRaw', 'plate'], valueType: 'PLATE', requirement: 'REQUIRED' },
      { header: 'data Infra\u00e7\u00e3o', targetFields: ['infractionDate'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'data do pagamento', targetFields: ['paymentDate'], valueType: 'DATE', requirement: 'REQUIRED' },
      { header: 'VALOR', targetFields: ['amount'], valueType: 'CURRENCY', requirement: 'REQUIRED' },
      { header: 'Pago para', targetFields: ['payeeRaw'], valueType: 'TEXT', requirement: 'OPTIONAL' },
    ],
    validationRules: [
      { code: 'responsibility-special-parser', severity: 'ERROR', description: 'A aba exige parser por secoes e rowKind.' },
      { code: 'responsibility-ignore-subtotals', severity: 'WARNING', description: 'Subtotais e labels nao viram fatos canonicos.' },
      { code: 'responsibility-preserve-context', severity: 'INFO', description: 'Section labels devem alimentar sectionLabelRaw/payerContextRaw.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['plate', 'infractionDate', 'paymentDate', 'amount', 'payeeRaw', 'sectionLabelRaw'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['plate', 'infractionDate', 'paymentDate', 'amount', 'payeeRaw', 'sectionLabelRaw'] },
    ],
  }),
  sheet({
    id: 'LUCRO',
    sheetName: 'Lucro',
    layer: 'RECONCILIATION',
    role: 'RECONCILIATION_ONLY',
    canonicalRecordType: 'No canonical persistence in phase 1',
    columns: [
      { header: 'Total Despesa', targetFields: ['reconciliation.totalExpense'], valueType: 'CURRENCY', requirement: 'STRUCTURAL' },
      { header: 'Total Receita', targetFields: ['reconciliation.totalRevenue'], valueType: 'CURRENCY', requirement: 'STRUCTURAL' },
      { header: 'Lucro', targetFields: ['reconciliation.profit'], valueType: 'CURRENCY', requirement: 'STRUCTURAL' },
      { header: 'Porcentagem', targetFields: ['reconciliation.margin'], valueType: 'PERCENTAGE', requirement: 'STRUCTURAL' },
      { header: 'Data', targetFields: ['reconciliation.periodLabel'], valueType: 'TEXT', requirement: 'STRUCTURAL' },
    ],
    validationRules: [
      { code: 'reconciliation-not-canonical', severity: 'INFO', description: 'Lucro serve para conferencia, nao persistencia canonica.' },
      { code: 'reconciliation-ignore-noise', severity: 'WARNING', description: 'Valores fora da grade principal devem ser ignorados.' },
    ],
    keys: [
      { kind: 'RAW_LINE', scope: 'RAW', strategy: 'SHA256', components: ['sourceFileChecksum', 'sheetName', 'sourceRowNumber', 'canonicalRawRowJson'] },
      { kind: 'DEDUPE', scope: 'NORMALIZED', strategy: 'SHA256', components: ['periodLabel', 'totalExpense', 'totalRevenue', 'profit', 'margin'] },
      { kind: 'BUSINESS', scope: 'CANONICAL', strategy: 'SHA256', components: ['periodLabel'] },
    ],
  }),
];

export const WORKBOOK_SHEET_CONTRACT_MAP = Object.fromEntries(
  WORKBOOK_SHEET_CONTRACTS.map((contract) => [contract.sheetName, contract]),
) as Record<string, WorkbookSheetContract>;

export const OFFICIAL_WORKBOOK_SHEETS = WORKBOOK_SHEET_CONTRACTS.map((contract) => contract.sheetName);

export const WORKBOOK_KPI_BOUNDARIES = {
  operational: [
    'OperationalSnapshot nao deve ser somado com FinancialEntry sem rotulo de camada.',
    'Recebimento operacional vem de amountPaidWeek.',
    'lateFeeAmount operacional nao substitui FineRecord.',
  ],
  financial: [
    'FinancialEntry usa domains separados para revenue, expense e investment.',
    'Investimento nao compoe OPEX sem regra explicita.',
  ],
  fines: [
    'FineRecord e o fato oficial de multa.',
    'FineResponsibility representa pagador/responsabilidade e nao substitui FineRecord.',
  ],
} as const;
