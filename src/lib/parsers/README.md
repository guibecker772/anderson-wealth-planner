# Parsers de Extrato Bancário

Este diretório conterá os parsers para leitura de extratos bancários em formato Excel (.xlsx).

## Biblioteca Utilizada

Usamos **exceljs** em vez de **xlsx (SheetJS)** devido a vulnerabilidades não corrigidas no npm audit.

## Padrão de Implementação (Lote 2)

### Estrutura de Arquivos Esperada

```
src/lib/parsers/
├── README.md           # Este arquivo
├── index.ts            # Exporta todos os parsers
├── types.ts            # Tipos compartilhados
├── bradesco.ts         # Parser Bradesco
├── itau.ts             # Parser Itaú
├── nubank.ts           # Parser Nubank
└── inter.ts            # Parser Inter
```

### Detecção de Header

Os parsers devem detectar automaticamente o início dos dados procurando por headers específicos:

| Banco    | Header de Detecção         | Colunas Esperadas                                      |
|----------|----------------------------|--------------------------------------------------------|
| Bradesco | "Número do Lançamento"     | Data, Histórico, Docto., Crédito, Débito, Saldo        |
| Itaú     | "Data"                     | Data, Lançamento, Ag./Origem, Valor, Saldo             |
| Nubank   | "Data"                     | Data, Descrição, Valor                                 |
| Inter    | "Data Lançamento"          | Data Lançamento, Descrição, Valor, Saldo               |

### Exemplo de Código com ExcelJS

```typescript
import ExcelJS from 'exceljs';

interface TransacaoBancaria {
  data: Date;
  descricao: string;
  valor: number;
  tipo: 'credito' | 'debito';
  saldo?: number;
}

export async function parseBradesco(buffer: Buffer): Promise<TransacaoBancaria[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  const transacoes: TransacaoBancaria[] = [];
  
  let headerRowIndex = -1;
  
  // Detectar linha do header
  worksheet.eachRow((row, rowNumber) => {
    const firstCell = row.getCell(1).value?.toString();
    if (firstCell === 'Número do Lançamento') {
      headerRowIndex = rowNumber;
    }
  });
  
  if (headerRowIndex === -1) {
    throw new Error('Header "Número do Lançamento" não encontrado');
  }
  
  // Processar dados após o header
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;
    
    const data = row.getCell(2).value as Date;
    const descricao = row.getCell(3).value?.toString() || '';
    const credito = parseFloat(row.getCell(5).value?.toString() || '0');
    const debito = parseFloat(row.getCell(6).value?.toString() || '0');
    const saldo = parseFloat(row.getCell(7).value?.toString() || '0');
    
    if (credito > 0 || debito > 0) {
      transacoes.push({
        data,
        descricao,
        valor: credito > 0 ? credito : debito,
        tipo: credito > 0 ? 'credito' : 'debito',
        saldo,
      });
    }
  });
  
  return transacoes;
}
```

### Notas de Implementação

1. **Buffer vs File**: Use `workbook.xlsx.load(buffer)` para arquivos enviados via upload
2. **Validação**: Sempre valide se o header esperado foi encontrado antes de processar
3. **Datas**: ExcelJS retorna datas como objetos Date nativos do JavaScript
4. **Valores numéricos**: Cuidado com formatação brasileira (vírgula decimal) - pode precisar de conversão
5. **Encoding**: ExcelJS lida automaticamente com encoding UTF-8

## TODO (Lote 2)

- [ ] Implementar `src/lib/parsers/types.ts` com tipos compartilhados
- [ ] Implementar `src/lib/parsers/bradesco.ts`
- [ ] Implementar `src/lib/parsers/itau.ts`
- [ ] Implementar `src/lib/parsers/nubank.ts`
- [ ] Implementar `src/lib/parsers/inter.ts`
- [ ] Implementar `src/lib/parsers/index.ts` com auto-detecção de banco
- [ ] Criar testes unitários com arquivos de exemplo
