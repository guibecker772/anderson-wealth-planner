# ClikFinance Workbook Import Contract v1

Este documento formaliza o contrato do workbook padrao do ClikFinance com base na planilha de exemplo `samples/planilha teste carros.xlsm`.

Referencias:
- `src/lib/import/workbookTemplateContract.ts`
- `src/lib/import/localImporter.ts`
- `docs/import-workbook-multi-sheet.md`

## Escopo

- Esta etapa cobre discovery tecnico e formalizacao do template.
- Nao cobre Google Drive.
- Nao cobre UI.
- Nao altera dashboards.
- O contrato alvo desta fase e `clikfinance_workbook_v1`.

## Diagnostico do template

Abas detectadas:
1. `planilha teste carros`
2. `Receita`
3. `Despesa`
4. `Lucro`
5. `Investimentos`
6. `Multas`
7. `Quem Pagou`

Leitura consolidada do sample:
- `planilha teste carros` e a aba operacional principal e tem cabecalho estavel na linha 1.
- `Receita`, `Despesa` e `Investimentos` sao abas financeiras tabulares, mas usam colunas auxiliares derivadas por formula em `Mes` e `Ano`.
- `Multas` e tabular e adequada para persistencia canonica, mas possui risco real de conflito por `AIT` duplicado.
- `Quem Pagou` nao e tabela plana; mistura detalhe, subtotal e labels de secao.
- `Lucro` e aba de reconciliacao; nao deve alimentar persistencia canonica.

Achados relevantes do sample:
- `planilha teste carros` tem pelo menos uma duplicata natural em `placa + data + semana + proprietario normalizado`.
- `Receita` contem linhas fantasmas: colunas core vazias e apenas formulas auxiliares em `Mes/Ano`.
- `Despesa` tem `Detalhamento` ausente em grande parte das linhas; o campo precisa ser opcional.
- `Multas` contem pelo menos um `AIT` repetido com payload divergente.
- `Quem Pagou` exige parser por blocos; ha subtotais e marcador de secao `Pagamento JURIDICO`.
- `Lucro` contem ruido fora da grade principal.

## Contrato oficial do arquivo

Versao:
- `clikfinance_workbook_v1`

Extensoes aceitas:
- `.xlsx`
- `.xlsm`

Abas oficiais e papeis:

| Aba | Camada | Papel | Persistencia canonica |
| --- | --- | --- | --- |
| `planilha teste carros` | Operacional | Canonica | `OperationalSnapshot` |
| `Receita` | Financeira | Canonica | `FinancialEntry(domain=REVENUE)` |
| `Despesa` | Financeira | Canonica | `FinancialEntry(domain=EXPENSE)` |
| `Investimentos` | Financeira | Canonica | `FinancialEntry(domain=INVESTMENT)` |
| `Multas` | Multas oficiais | Canonica | `FineRecord` |
| `Quem Pagou` | Responsabilidade | Canonica com parser especial | `FineResponsibility` |
| `Lucro` | Reconciliacao | Somente conferencia | nao persiste nesta fase |

Regras gerais:
- o cabecalho oficial deve existir uma vez por aba;
- linhas vazias, subtotais e labels contextuais nao sao fatos canonicos por si so;
- colunas derivadas por formula podem existir, mas a fonte primaria de negocio deve ser sempre o valor base tipado;
- o pipeline precisa separar tres identidades: linha bruta, deduplicacao e chave de negocio.

## Mapeamento coluna -> campo interno

### planilha teste carros

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Data` | `referenceDate`, `referenceYear`, `referenceMonth` | data | obrigatoria |
| `Semana` | `weekOfMonth` | inteiro | obrigatoria |
| `Contrato ativo` | `contractActiveRaw`, `contractActive` | enum textual | condicional |
| `Situacao de veiculo` | `vehicleStatusRaw`, `vehicleStatusNormalized` | enum textual | obrigatoria |
| `Placa` | `plateRaw`, `plate` | placa | obrigatoria |
| `Modelo` | `modelRaw`, `model` | texto | obrigatoria |
| `Proprietario` | `investorRaw`, `investorNormalized` | texto | obrigatoria |
| `Motorista` | `driverRaw`, `driverNormalized` | texto | opcional |
| `Valor contrato` | `contractValue` | moeda | condicional |
| `Multa/atraso` | `lateFeeAmount` | moeda | opcional |
| `Desconto` | `discountAmount` | moeda | opcional |
| `Valor a Cobrar` | `amountToCharge` | moeda | condicional |
| `Manutencao por motorista` | `maintenanceByDriverAmount` | moeda | opcional |
| `Valor Pago (Semana)` | `amountPaidWeek` | moeda | opcional |

### Receita

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Origem` | `groupRaw`, `groupNormalized` | texto | obrigatoria |
| `Valor R$` | `amount` | moeda | obrigatoria |
| `Destino` | `accountRaw` | texto | obrigatoria |
| `Data` | `entryDate`, `referenceYear`, `referenceMonth` | data | obrigatoria |
| `Mes` | `derivedMonthLabel` | texto derivado por formula | derivada |
| `Ano` | `derivedYear` | numero derivado por formula | derivada |

### Despesa

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Tipo de Gasto` | `groupRaw`, `groupNormalized` | texto | obrigatoria |
| `Detalhamento` | `detailRaw` | texto | opcional |
| `Categoria` | `categoryRaw` | texto | opcional |
| `Valor R$` | `amount` | moeda | obrigatoria |
| `Fonte` | `accountRaw` | texto | obrigatoria |
| `Data` | `entryDate`, `referenceYear`, `referenceMonth` | data | obrigatoria |
| `Mes` | `derivedMonthLabel` | texto derivado por formula | derivada |
| `Ano` | `derivedYear` | numero derivado por formula | derivada |

### Investimentos

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Investimento` | `groupRaw`, `groupNormalized` | texto | obrigatoria |
| `Valor R$` | `amount` | moeda | obrigatoria |
| `Fonte` | `accountRaw` | texto | obrigatoria |
| `Data` | `entryDate`, `referenceYear`, `referenceMonth` | data | obrigatoria |
| `Mes` | `derivedMonthLabel` | texto derivado por formula | derivada |
| `Ano` | `derivedYear` | numero derivado por formula | derivada |

### Multas

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Orgao autuador` | `issuingAuthorityRaw` | texto | opcional |
| `Condutor` | `driverRaw`, `driverNormalized` | texto | opcional |
| `Paga` | `paymentStatusRaw`, `paymentState` | enum textual | opcional |
| `Valor` | `amount` | moeda | obrigatoria |
| `Placa` | `plateRaw`, `plate` | placa | obrigatoria |
| `Auto de infracao` | `aitRaw`, `ait` | texto | condicional |
| `Veiculo` | `vehicleRaw` | texto | opcional |
| `Data da infracao` | `infractionDate`, `referenceYear`, `referenceMonth` | datetime | obrigatoria |

### Quem Pagou

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `PLACA` | `plateRaw`, `plate` | placa | obrigatoria |
| `data Infracao` | `infractionDate` | data | obrigatoria |
| `data do pagamento` | `paymentDate` | data | obrigatoria |
| `VALOR` | `amount` | moeda | obrigatoria |
| `Pago para` | `payeeRaw` | texto | opcional |

Campos derivados adicionais exigidos pelo parser especial:
- `rowKind`
- `sectionLabelRaw`
- `payerContextRaw`
- `responsibilityType`
- `responsibilityKey`

### Lucro

| Coluna | Campo(s) interno(s) | Tipo | Regra |
| --- | --- | --- | --- |
| `Total Despesa` | `reconciliation.totalExpense` | moeda | estrutural |
| `Total Receita` | `reconciliation.totalRevenue` | moeda | estrutural |
| `Lucro` | `reconciliation.profit` | moeda | estrutural |
| `Porcentagem` | `reconciliation.margin` | percentual | estrutural |
| `Data` | `reconciliation.periodLabel` | texto | estrutural |

## Regras iniciais de validacao

Regras transversais:
- nomes de abas devem bater com o contrato oficial;
- cabecalho deve bater exatamente na ordem contratada;
- linhas com apenas formulas auxiliares nao contam como detalhe valido;
- campos de placa devem ser normalizados antes de qualquer cruzamento;
- valores monetarios devem aceitar numero real e rejeitar residuos como `#VALUE!`;
- o parser deve registrar warning antes de descartar qualquer linha nao canonica.

Regras por dominio:
- Operacional:
  - exigir `Data`, `Semana`, `Situacao de veiculo`, `Placa`, `Modelo`, `Proprietario`;
  - tratar `Motorista` como opcional;
  - aceitar linhas curtas em veiculos fora de operacao com warning rastreavel;
  - sinalizar divergencia financeira em `Valor a Cobrar` sem excluir o registro.
- Receita:
  - exigir `Origem`, `Valor R$`, `Destino`, `Data`;
  - ignorar linhas fantasmas com `Mes/Ano` derivados e colunas core vazias.
- Despesa:
  - exigir `Tipo de Gasto`, `Valor R$`, `Fonte`, `Data`;
  - permitir `Detalhamento` e `Categoria` nulos.
- Investimentos:
  - exigir `Investimento`, `Valor R$`, `Fonte`, `Data`.
- Multas:
  - exigir `Placa`, `Valor`, `Data da infracao`;
  - usar `AIT` como chave preferencial quando existir;
  - sinalizar conflito quando o mesmo `AIT` reaparecer com payload divergente.
- Quem Pagou:
  - parser deve diferenciar `DETAIL`, `SUBTOTAL` e `SECTION_LABEL`;
  - linhas de subtotal nao persistem como fato canonico;
  - labels de secao devem ser preservadas no contexto da linha seguinte.
- Lucro:
  - leitura opcional e apenas para reconciliacao;
  - ignorar qualquer valor fora da grade principal da aba.

## Schema de normalizacao proposto

Camadas:
1. `RAW`
   - registro proposto: `ImportWorkbookRow`
   - objetivo: reter cada linha original, inclusive subtotal e secao.
2. `NORMALIZED`
   - registros propostos:
     - `NormalizedOperationalRow`
     - `NormalizedFinancialRow`
     - `NormalizedFineRow`
     - `NormalizedResponsibilityRow`
   - objetivo: tipar, normalizar entidades, classificar linha e gerar chaves tecnicas.
3. `CANONICAL`
   - tabelas atuais:
     - `OperationalSnapshot`
     - `FinancialEntry`
     - `FineRecord`
     - `FineResponsibility`

Decisoes importantes:
- `Lucro` fica fora da camada canonica nesta fase.
- `rawJson` nas tabelas finais e util, mas nao substitui staging raw.
- `Quem Pagou` precisa entrar pela camada normalized com parser especial.

## Chaves tecnicas propostas

### Linha bruta

- `rawLineKey = sha256(sourceFileChecksum + sheetName + sourceRowNumber + canonicalRawRowJson)`

Objetivo:
- identificar a linha exata do arquivo de origem;
- mudar quando o payload bruto da linha mudar.

### Deduplicacao idempotente

- Operacional:
  - `sha256(plate + referenceDate + weekOfMonth + investorNormalized + amountToCharge + amountPaidWeek)`
- Financeiro:
  - `sha256(domain + entryDate + amount + groupRaw + detailRaw + categoryRaw + accountRaw)`
- Multas:
  - preferencial: `sha256(ait)`
  - fallback: `sha256(plate + infractionDate + amount + issuingAuthorityRaw)`
- Responsabilidade:
  - `sha256(plate + infractionDate + paymentDate + amount + payeeRaw + sectionLabelRaw)`

Objetivo:
- impedir reimportacao do mesmo fato quando o workbook for reexportado com hash diferente.

### Chave de negocio

- Operacional:
  - `sha256(plate + referenceYear + referenceMonth + weekOfMonth + investorNormalized)`
- Receita:
  - `sha256(domain=REVENUE + entryDate + amount + groupRaw + accountRaw)`
- Despesa:
  - `sha256(domain=EXPENSE + entryDate + amount + groupRaw + accountRaw)`
- Investimento:
  - `sha256(domain=INVESTMENT + entryDate + amount + groupRaw + accountRaw)`
- Multas:
  - `sha256(ait || plate + infractionDate + amount + issuingAuthorityRaw)`
- Responsabilidade:
  - `sha256(plate + infractionDate + paymentDate + amount + payeeRaw + sectionLabelRaw)`

## Criterios de aprovacao desta etapa

Esta etapa fica aprovada se:
- o workbook padrao tiver contrato formal em codigo e em documento;
- a equipe souber quais abas sao canonicas, especiais e apenas de reconciliacao;
- o mapeamento coluna -> campo interno estiver definido;
- as regras iniciais de validacao e as chaves tecnicas estiverem fechadas;
- o material servir de base para implementar o pipeline sem depender de interpretacao ad hoc.
