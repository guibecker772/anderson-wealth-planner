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

export interface WorkbookSheetContract {
  id: WorkbookSheetId;
  sheetName: string;
  layer: WorkbookCanonicalLayer;
  role: WorkbookSheetRole;
  expectedColumns: string[];
  canonicalRecordType: string;
  businessKey: string[];
  auditKey: string[];
  parsingRules: string[];
  toleranceRules: string[];
  traceabilityRules: string[];
}

export const WORKBOOK_SHEET_CONTRACTS: WorkbookSheetContract[] = [
  {
    id: 'PLANILHA_TESTE_CARROS',
    sheetName: 'planilha teste carros',
    layer: 'OPERATIONAL',
    role: 'CANONICAL',
    expectedColumns: [
      'Data',
      'Semana',
      'Contrato ativo',
      'Situação de veículo',
      'Placa',
      'Modelo',
      'Proprietário',
      'Motorista',
      'Valor contrato',
      'Multa/atraso',
      'Desconto',
      'Valor à Cobrar',
      'Manutenção por motorista',
      'Valor Pago (Semana)',
    ],
    canonicalRecordType: 'OperationalSnapshot',
    businessKey: ['plate', 'referenceYear', 'referenceMonth', 'weekOfMonth', 'investorNormalized'],
    auditKey: ['sourceFileId', 'sheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'Usar apenas esta aba como base operacional da frota.',
      'Data real de Excel tem precedência; mês textual + semana gera data inferida.',
      'paymentStatusRaw deve permanecer nulo; paymentState é derivado dos valores financeiros.',
      'Valor à Cobrar = 0 deve ser preservado como zero real.',
    ],
    toleranceRules: [
      'Duplicata exata de origem pode ser ignorada com warning explícito.',
      'Células inválidas como #VALUE! devem virar null com warning rastreável.',
      'Linhas com anomalia financeira não devem ser excluídas automaticamente.',
    ],
    traceabilityRules: [
      'Persistir valores brutos da linha em rawJson.',
      'Persistir sourceRowNumber, sheetName e metadata de inferência de data.',
      'Persistir status de qualidade em rawJson.__quality.',
    ],
  },
  {
    id: 'RECEITA',
    sheetName: 'Receita',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    expectedColumns: ['Origem', 'Valor R$', 'Destino', 'Data', 'Mês', 'Ano'],
    canonicalRecordType: 'FinancialEntry',
    businessKey: ['domain=REVENUE', 'entryDate', 'amount', 'groupNormalized', 'accountRaw'],
    auditKey: ['sourceFileId', 'sourceSheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'Cada linha vira um lançamento financeiro de entrada de caixa.',
      'Origem alimenta groupRaw/groupNormalized.',
      'Destino alimenta accountRaw e pode ser normalizado em FinancialAccount.',
      'Mês e Ano são auxiliares; Data é a referência principal quando válida.',
    ],
    toleranceRules: [
      'Linhas sem Data válida podem usar Mês/Ano apenas se isso estiver explícito no rawJson.',
      'Linhas de totalização não devem entrar.',
    ],
    traceabilityRules: [
      'Persistir linha bruta, conta bruta e origem bruta.',
      'Persistir vínculo com SourceFile e ImportBatch do workbook.',
    ],
  },
  {
    id: 'DESPESA',
    sheetName: 'Despesa',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    expectedColumns: ['Tipo de Gasto', 'Detalhamento', 'Categoria', 'Valor R$', 'Fonte', 'Data', 'Mês', 'Ano'],
    canonicalRecordType: 'FinancialEntry',
    businessKey: ['domain=EXPENSE', 'entryDate', 'amount', 'groupNormalized', 'detailRaw', 'accountRaw'],
    auditKey: ['sourceFileId', 'sourceSheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'Cada linha vira um lançamento financeiro de saída de caixa.',
      'Tipo de Gasto alimenta groupRaw/groupNormalized.',
      'Detalhamento e Categoria devem ser preservados sem colapsar prematuramente.',
      'Fonte alimenta accountRaw e pode ser normalizada em FinancialAccount.',
    ],
    toleranceRules: [
      'Linhas de subtotal e colunas vazias à direita devem ser ignoradas.',
      'Valores inválidos devem gerar warning e não contaminar agregados silenciosamente.',
    ],
    traceabilityRules: [
      'Persistir categoria e detalhamento brutos.',
      'Persistir sourceRowNumber, sheetName e rowHash.',
    ],
  },
  {
    id: 'INVESTIMENTOS',
    sheetName: 'Investimentos',
    layer: 'FINANCIAL',
    role: 'CANONICAL',
    expectedColumns: ['Investimento', 'Valor R$', 'Fonte', 'Data', 'Mês', 'Ano'],
    canonicalRecordType: 'FinancialEntry',
    businessKey: ['domain=INVESTMENT', 'entryDate', 'amount', 'groupNormalized', 'accountRaw'],
    auditKey: ['sourceFileId', 'sourceSheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'Cada linha vira um lançamento financeiro de investimento.',
      'Investimento alimenta groupRaw/groupNormalized.',
      'Fonte alimenta accountRaw.',
    ],
    toleranceRules: [
      'Investimentos não devem ser somados no mesmo KPI de despesa operacional sem distinção.',
    ],
    traceabilityRules: [
      'Persistir texto bruto do investimento e conta de origem.',
    ],
  },
  {
    id: 'MULTAS',
    sheetName: 'Multas',
    layer: 'FINES',
    role: 'CANONICAL',
    expectedColumns: ['Órgão autuador', 'Condutor', 'Paga', 'Valor', 'Placa', 'Auto de infração', 'Veículo', 'Data da infração'],
    canonicalRecordType: 'FineRecord',
    businessKey: ['ait', 'plate', 'infractionDate', 'amount'],
    auditKey: ['sourceFileId', 'sourceSheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'Cada linha vira um registro oficial de multa.',
      'Auto de infração é a melhor chave natural quando disponível.',
      'Paga deve ser mapeado para FinePaymentState sem inventar liquidação inexistente.',
    ],
    toleranceRules: [
      'Quando não houver AIT, usar chave composta por placa + data + valor + órgão.',
      'Não fundir automaticamente com Multa/atraso operacional da aba de frota.',
    ],
    traceabilityRules: [
      'Persistir órgão autuador, condutor, AIT e veículo brutos.',
    ],
  },
  {
    id: 'QUEM_PAGOU',
    sheetName: 'Quem Pagou',
    layer: 'RESPONSIBILITY',
    role: 'CANONICAL_WITH_SPECIAL_PARSER',
    expectedColumns: ['PLACA', 'data Infração', 'data do pagamento', 'VALOR', 'Pago para'],
    canonicalRecordType: 'FineResponsibility',
    businessKey: ['plate', 'infractionDate', 'paymentDate', 'amount', 'payeeRaw', 'sectionLabelRaw'],
    auditKey: ['sourceFileId', 'sourceSheetName', 'sourceRowNumber', 'rowHash'],
    parsingRules: [
      'A aba exige parser com reconhecimento de seções e subtotais.',
      'Linhas de subtotal não são registros canônicos.',
      'Section labels como Pagamento JURÍDICO devem ser preservados em sectionLabelRaw/payerContextRaw.',
    ],
    toleranceRules: [
      'Sem matching inequívoco, não vincular automaticamente ao FineRecord.',
      'Responsabilidade/pagador deve ser importado mesmo sem fineRecordId resolvido.',
    ],
    traceabilityRules: [
      'Persistir contexto da seção e valores brutos.',
      'Persistir a linha original para auditoria de reconciliação.',
    ],
  },
  {
    id: 'LUCRO',
    sheetName: 'Lucro',
    layer: 'RECONCILIATION',
    role: 'RECONCILIATION_ONLY',
    expectedColumns: ['Total Despesa', 'Total Receita', 'Lucro', 'Porcentagem', 'Data'],
    canonicalRecordType: 'No canonical persistence in phase 1',
    businessKey: ['not-applicable'],
    auditKey: ['sheetName', 'sourceRowNumber'],
    parsingRules: [
      'Usar apenas para conferência e validação dos números consolidados.',
      'Não alimentar KPIs primários diretamente desta aba.',
    ],
    toleranceRules: [
      'Ignorar linhas livres, ruído manual e células fora da grade principal.',
    ],
    traceabilityRules: [
      'Se for lida, guardar apenas em details/raw de conferência, não como fonte canônica principal.',
    ],
  },
];

export const WORKBOOK_KPI_BOUNDARIES = {
  operational: [
    'KPIs operacionais usam apenas OperationalSnapshot.',
    'Recebimento operacional vem de amountPaidWeek.',
    'Cobrança operacional vem de amountToCharge e contractValue.',
    'Multa/atraso operacional e manutenção são custos operacionais da frota.',
  ],
  financial: [
    'KPIs financeiros usam FinancialEntry.',
    'Receita financeira usa apenas domain=REVENUE.',
    'Despesa financeira usa apenas domain=EXPENSE.',
    'Investimento usa apenas domain=INVESTMENT e deve ficar separado de OPEX quando o KPI exigir.',
  ],
  fines: [
    'KPIs de multas oficiais usam FineRecord.',
    'KPIs de responsabilidade/pagador usam FineResponsibility.',
    'FineRecord e FineResponsibility não devem ser somados em receita ou despesa sem regra explícita de liquidação.',
  ],
  nonDoubleCountRules: [
    'OperationalSnapshot nunca deve ser somado com FinancialEntry para formar um único total sem rótulo de camada.',
    'lateFeeAmount operacional não substitui FineRecord.',
    'Pagamento de multa em caixa deve ser tratado como despesa financeira distinta do registro oficial da multa.',
    'Lucro é reconciliação e não fonte primária de composição de KPI.',
  ],
} as const;
