# Workbook Multi-Sheet Import Contract

Este documento formaliza a arquitetura alvo para importar o workbook completo sem transformar o arquivo de `samples/` em dependência de runtime.

## Camadas canônicas

- Operacional: `planilha teste carros` -> `OperationalSnapshot`
- Financeira: `Receita`, `Despesa`, `Investimentos` -> `FinancialEntry`
- Multas oficiais: `Multas` -> `FineRecord`
- Responsabilidade/pagador: `Quem Pagou` -> `FineResponsibility`
- Reconciliação: `Lucro` -> conferência, não fonte primária

## Deduplicação por domínio

- Operacional
  `rowHash = fileHash + sheetName + sourceRowNumber + hash estável da linha`
  Chave natural de negócio: `plate + referenceMonth + weekOfMonth + investorNormalized`
- Financeiro
  `rowHash = fileHash + sheetName + sourceRowNumber + hash estável da linha`
  Chave natural de negócio:
  - Receita: `entryDate + amount + origem + destino`
  - Despesa: `entryDate + amount + tipo de gasto + detalhamento + fonte`
  - Investimentos: `entryDate + amount + investimento + fonte`
- Multas
  `rowHash = fileHash + sheetName + sourceRowNumber + hash estável da linha`
  Chave natural preferencial: `AIT`
  Fallback: `placa + data da infração + valor + órgão autuador`
- Responsabilidade/pagador
  `rowHash = fileHash + sheetName + sourceRowNumber + hash estável da linha`
  Chave natural: `placa + data infração + data pagamento + valor + pago para + seção`

## Regra de não dupla contagem

- KPI operacional usa apenas `OperationalSnapshot`
- KPI financeiro usa apenas `FinancialEntry`
- KPI de multas oficiais usa apenas `FineRecord`
- KPI de pagador/responsabilidade usa apenas `FineResponsibility`
- `lateFeeAmount` operacional não substitui multa oficial
- multa paga em caixa deve entrar como despesa financeira, não como receita
- `Lucro` não deve compor KPI primário; serve para conferência dos totais importados

## Observações de implementação

- `Quem Pagou` exige parser com reconhecimento de seções e subtotais
- `Lucro` deve ficar fora da persistência canônica inicial
- `SourceFile` e `ImportBatch` continuam sendo a espinha dorsal de rastreabilidade do workbook
