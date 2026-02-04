import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { parseExcelDate, parseCurrency, parseBoolean } from '../parsers/common';
import { 
  loadActiveRules, 
  resolveCategoryByRules, 
  buildRawLabel,
  type NormalizationRule 
} from '../normalization/categoryNormalization';

// Use string literals instead of Prisma enums for compatibility
type TransactionType = 'PAYABLE' | 'RECEIVABLE';
type TransactionStatus = 'PENDING' | 'SETTLED';
type CategorySource = 'RAW' | 'NORMALIZED' | 'MANUAL';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportSummary {
  ok: boolean;
  importedFiles: number;
  importedRows: number;
  skippedFiles: number;
  skippedRows: number;
  errors: { file: string; message: string }[];
}

export interface FolderStatus {
  exists: boolean;
  path: string;
  inboxCount: number;
  processedCount: number;
  errorCount: number;
  lastRun: Date | null;
  lastFileName: string | null;
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
  // Category normalization fields
  rawLabel: string | null;
  categorySource: CategorySource;
  normalizedByRuleId: string | null;
  normalizedAt: Date | null;
}

// ============================================================================
// FOLDER MANAGEMENT
// ============================================================================

/**
 * Garante que as subpastas inbox/, processed/, error/ existam no basePath
 */
export async function ensureFolders(basePath: string): Promise<void> {
  const normalizedPath = path.normalize(basePath);
  const subfolders = ['inbox', 'processed', 'error'];
  
  for (const folder of subfolders) {
    const folderPath = path.join(normalizedPath, folder);
    try {
      await fs.mkdir(folderPath, { recursive: true });
    } catch (err: any) {
      // Se já existe, ok
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

/**
 * Lista arquivos .xlsx na pasta inbox/
 */
export async function listInboxFiles(basePath: string): Promise<string[]> {
  const normalizedPath = path.normalize(basePath);
  const inboxPath = path.join(normalizedPath, 'inbox');
  
  try {
    const files = await fs.readdir(inboxPath);
    return files
      .filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
      .map(f => path.join(inboxPath, f));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Conta arquivos em uma subpasta
 */
async function countFilesInFolder(basePath: string, subfolder: string): Promise<number> {
  const folderPath = path.join(path.normalize(basePath), subfolder);
  try {
    const files = await fs.readdir(folderPath);
    return files.filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$')).length;
  } catch {
    return 0;
  }
}

// ============================================================================
// FILE HASHING
// ============================================================================

/**
 * Calcula hash SHA256 do conteúdo do arquivo para deduplicação
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Gera hash de uma linha para deduplicação de transações
 */
function computeRowHash(
  fileHash: string,
  sheetName: string,
  rowIndex: number,
  plannedDate: Date | null,
  plannedAmount: number,
  description: string | null
): string {
  const data = [
    fileHash,
    sheetName,
    rowIndex.toString(),
    plannedDate?.toISOString() || '',
    plannedAmount.toString(),
    description || ''
  ].join('|');
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// ============================================================================
// EXCEL PARSING
// ============================================================================

/**
 * Detecta o tipo de arquivo (Contas a Pagar ou Contas a Receber) pelo nome
 */
function detectFileType(fileName: string): TransactionType {
  const lower = fileName.toLowerCase();
  if (lower.includes('pagar') || lower.includes('despesa') || lower.includes('payable')) {
    return 'PAYABLE';
  }
  return 'RECEIVABLE';
}

/**
 * Parseia workbook Excel e retorna transações estruturadas
 */
export async function parseWorkbook(
  filePath: string,
  fileHash: string
): Promise<{ transactions: ParsedRow[]; errors: string[] }> {
  const fileName = path.basename(filePath);
  const fileType = detectFileType(fileName);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const transactions: ParsedRow[] = [];
  const errors: string[] = [];
  
  // Abas a ignorar (geralmente resumos)
  const ignoredSheets = ['Gráfico', 'Resumo', 'Dashboard', 'Total'];
  
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    
    // Pular abas de resumo
    if (ignoredSheets.some(s => sheetName.toLowerCase().includes(s.toLowerCase()))) {
      continue;
    }
    
    // Encontrar linha do header
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (headerRowIndex !== -1) return;
      const values = row.values as any[];
      
      for (let i = 1; i < values.length; i++) {
        const cell = String(values[i] || '').trim();
        // Heurística: procurar por colunas típicas de header
        if (
          cell.includes('Lançamento') ||
          cell.includes('Vencimento') ||
          cell.includes('Valor') ||
          cell.includes('Data') ||
          cell.includes('Fornecedor') ||
          cell.includes('Cliente')
        ) {
          headerRowIndex = rowNumber;
          headers = values.slice(1).map(v => String(v || '').trim());
          break;
        }
      }
    });
    
    if (headerRowIndex === -1) {
      // Tentar aba "Relatório" com estrutura diferente
      if (sheetName.toLowerCase().includes('relatório') || sheetName.toLowerCase().includes('relatorio')) {
        // Procurar header com mais flexibilidade
        worksheet.eachRow((row, rowNumber) => {
          if (headerRowIndex !== -1) return;
          const values = row.values as any[];
          const nonEmptyCount = values.filter(v => v && String(v).trim()).length;
          if (nonEmptyCount >= 3) {
            headerRowIndex = rowNumber;
            headers = values.slice(1).map(v => String(v || '').trim());
          }
        });
      }
      
      if (headerRowIndex === -1) continue;
    }
    
    // Mapear headers para campos padronizados
    const headerMap: Record<string, number> = {};
    headers.forEach((header, idx) => {
      const h = header.toLowerCase();
      if (h.includes('lançamento') || h.includes('numero') || h.includes('número')) {
        headerMap['externalId'] = idx;
      }
      if (h.includes('categoria')) headerMap['category'] = idx;
      if (h.includes('fornecedor')) headerMap['counterparty'] = idx;
      if (h.includes('cliente')) headerMap['counterparty'] = idx;
      if (h.includes('descrição') || h.includes('descricao') || h.includes('histórico') || h.includes('historico')) {
        headerMap['description'] = idx;
      }
      if (h.includes('unidade')) headerMap['unit'] = idx;
      if (h.includes('vencimento') || h.includes('prevista') || h === 'data') {
        headerMap['plannedDate'] = idx;
      }
      if (h.includes('pagamento') || h.includes('recebimento') || h.includes('realizada')) {
        headerMap['actualDate'] = idx;
      }
      if (h.includes('valor previsto') || h.includes('valor do título') || h === 'valor') {
        headerMap['plannedAmount'] = idx;
      }
      if (h.includes('valor pago') || h.includes('valor recebido') || h.includes('valor realizado')) {
        headerMap['actualAmount'] = idx;
      }
      if (h.includes('juros')) headerMap['feesInterest'] = idx;
      if (h.includes('multa')) headerMap['feesFine'] = idx;
      if (h.includes('desconto')) headerMap['discount'] = idx;
      if (h === 'pago' || h === 'recebido') headerMap['isPaid'] = idx;
    });
    
    // Processar linhas de dados
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;
      
      const values = row.values as any[];
      
      // Ignorar linhas vazias ou de total
      const firstCell = String(values[1] || '').toLowerCase();
      if (!firstCell || firstCell.includes('total') || firstCell.includes('subtotal')) {
        return;
      }
      
      // Extrair valores
      const getCellValue = (idx: number | undefined) => {
        if (idx === undefined) return undefined;
        const val = values[idx + 1];
        // Handle formula results
        if (typeof val === 'object' && val?.result !== undefined) {
          return val.result;
        }
        return val;
      };
      
      const externalId = getCellValue(headerMap['externalId']);
      const plannedDateRaw = getCellValue(headerMap['plannedDate']);
      const plannedAmountRaw = getCellValue(headerMap['plannedAmount']);
      
      // Validação mínima: precisa ter pelo menos valor
      const plannedAmount = parseCurrency(plannedAmountRaw);
      if (plannedAmount === 0 && !externalId) return;
      
      const plannedDate = parseExcelDate(plannedDateRaw);
      const actualDate = parseExcelDate(getCellValue(headerMap['actualDate']));
      const actualAmountRaw = getCellValue(headerMap['actualAmount']);
      const isPaidRaw = getCellValue(headerMap['isPaid']);
      
      const isPaid = parseBoolean(isPaidRaw) || (actualDate !== null && actualAmountRaw !== undefined);
      const actualAmount = isPaid ? parseCurrency(actualAmountRaw) : null;
      
      const description = getCellValue(headerMap['description']);
      const counterparty = getCellValue(headerMap['counterparty']);
      
      // Categoria original do Excel: usar coluna se existir, senão usar nome da aba
      let categoryFromExcel = getCellValue(headerMap['category']);
      if (!categoryFromExcel) {
        categoryFromExcel = sheetName !== 'Relatório' ? sheetName : null;
      }
      
      // Build rawLabel for normalization (deterministic concatenation)
      const rawLabel = buildRawLabel({
        counterparty: counterparty ? String(counterparty) : null,
        description: description ? String(description) : null,
        category: categoryFromExcel ? String(categoryFromExcel) : null,
      });
      
      // Gerar rowHash para deduplicação
      const rowHash = computeRowHash(
        fileHash,
        sheetName,
        rowNumber,
        plannedDate,
        plannedAmount,
        String(description || '')
      );
      
      transactions.push({
        externalId: externalId ? String(externalId) : null,
        category: categoryFromExcel ? String(categoryFromExcel) : null,
        counterparty: counterparty ? String(counterparty) : null,
        description: description ? String(description) : null,
        unit: getCellValue(headerMap['unit']) ? String(getCellValue(headerMap['unit'])) : null,
        plannedDate,
        dueDate: plannedDate,
        actualDate,
        plannedAmount,
        actualAmount,
        feesInterest: parseCurrency(getCellValue(headerMap['feesInterest'])) || null,
        feesFine: parseCurrency(getCellValue(headerMap['feesFine'])) || null,
        discount: parseCurrency(getCellValue(headerMap['discount'])) || null,
        grossAmount: null,
        status: isPaid ? 'SETTLED' : 'PENDING',
        type: fileType,
        rawJson: Object.fromEntries(
          headers.map((h, i) => [h, getCellValue(i)])
        ) as Record<string, unknown>,
        rowHash,
        // Normalization fields (will be updated after rules are applied)
        rawLabel: rawLabel || null,
        categorySource: 'RAW',
        normalizedByRuleId: null,
        normalizedAt: null,
      });
    });
  }
  
  return { transactions, errors };
}

// ============================================================================
// FILE IMPORT
// ============================================================================

/**
 * Move arquivo para pasta de destino
 */
async function moveFile(sourcePath: string, destFolder: string): Promise<void> {
  const fileName = path.basename(sourcePath);
  const destPath = path.join(destFolder, fileName);
  
  // Se já existe no destino, adicionar timestamp
  let finalPath = destPath;
  try {
    await fs.access(destPath);
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    finalPath = path.join(destFolder, `${base}_${timestamp}${ext}`);
  } catch {
    // Arquivo não existe, usar destPath original
  }
  
  await fs.rename(sourcePath, finalPath);
}

/**
 * Importa um arquivo individual
 */
export async function importFile(
  filePath: string,
  basePath: string
): Promise<{ success: boolean; importedRows: number; skippedRows: number; error?: string }> {
  const normalizedBasePath = path.normalize(basePath);
  const fileName = path.basename(filePath);
  
  try {
    // Calcular hash do arquivo
    const fileHash = await computeFileHash(filePath);
    const stats = await fs.stat(filePath);
    
    // Verificar se arquivo já foi processado
    const existingFile = await db.sourceFile.findUnique({
      where: { driveFileId: fileHash }
    });
    
    if (existingFile && existingFile.status === 'PROCESSED') {
      // Arquivo já processado, mover para processed/ e retornar
      await moveFile(filePath, path.join(normalizedBasePath, 'processed'));
      return { success: true, importedRows: 0, skippedRows: 0 };
    }
    
    // Parsear workbook
    const { transactions, errors } = await parseWorkbook(filePath, fileHash);
    
    if (errors.length > 0) {
      console.warn(`Warnings parsing ${fileName}:`, errors);
    }
    
    if (transactions.length === 0) {
      throw new Error('Nenhuma transação encontrada no arquivo');
    }
    
    // Criar ou atualizar SourceFile
    const sourceFile = await db.sourceFile.upsert({
      where: { driveFileId: fileHash },
      update: {
        modifiedTime: stats.mtime,
        status: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null
      },
      create: {
        driveFileId: fileHash,
        name: fileName,
        modifiedTime: stats.mtime,
        checksum: fileHash,
        source: 'LOCAL',
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });
    
    // Verificar transações existentes para deduplicação
    const existingHashesResult = await db.transaction.findMany({
      where: { rowHash: { in: transactions.map(t => t.rowHash) } },
      select: { rowHash: true }
    });
    const existingHashes = new Set(existingHashesResult.map((t: { rowHash: string | null }) => t.rowHash));
    
    // Filtrar apenas transações novas
    const newTransactions = transactions.filter(t => !existingHashes.has(t.rowHash));
    const skippedRows = transactions.length - newTransactions.length;
    
    // Load normalization rules once for all transactions
    const normalizationRules = await loadActiveRules(db);
    const now = new Date();
    
    // Apply normalization rules to each new transaction
    const normalizedTransactions = newTransactions.map(t => {
      if (t.rawLabel && normalizationRules.length > 0) {
        const scope = t.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
        const result = resolveCategoryByRules(normalizationRules as NormalizationRule[], {
          rawLabel: t.rawLabel,
          scope,
        });
        
        if (result.categoryId && result.ruleId) {
          return {
            ...t,
            category: result.categoryId,
            categorySource: 'NORMALIZED' as CategorySource,
            normalizedByRuleId: result.ruleId,
            normalizedAt: now,
          };
        }
      }
      return t;
    });
    
    // Inserir novas transações
    if (normalizedTransactions.length > 0) {
      const data = normalizedTransactions.map(t => ({
        sourceFileId: sourceFile.id,
        type: t.type,
        externalId: t.externalId,
        rowHash: t.rowHash,
        category: t.category,
        counterparty: t.counterparty,
        description: t.description,
        unit: t.unit,
        plannedDate: t.plannedDate,
        dueDate: t.dueDate,
        actualDate: t.actualDate,
        plannedAmount: String(t.plannedAmount || 0),
        actualAmount: t.actualAmount !== null ? String(t.actualAmount) : null,
        feesInterest: t.feesInterest !== null ? String(t.feesInterest) : null,
        feesFine: t.feesFine !== null ? String(t.feesFine) : null,
        discount: t.discount !== null ? String(t.discount) : null,
        grossAmount: t.grossAmount !== null ? String(t.grossAmount) : null,
        status: t.status,
        rawJson: t.rawJson as unknown as Prisma.InputJsonValue,
        // Normalization fields
        rawLabel: t.rawLabel,
        categorySource: t.categorySource,
        normalizedByRuleId: t.normalizedByRuleId,
        normalizedAt: t.normalizedAt,
      }));
      
      await db.transaction.createMany({ data });
    }
    
    // Mover arquivo para processed/
    await moveFile(filePath, path.join(normalizedBasePath, 'processed'));
    
    return { success: true, importedRows: normalizedTransactions.length, skippedRows };
    
  } catch (err: any) {
    // Registrar erro no SourceFile
    const fileHash = await computeFileHash(filePath).catch(() => `error_${Date.now()}`);
    const stats = await fs.stat(filePath).catch(() => ({ mtime: new Date() }));
    
    await db.sourceFile.upsert({
      where: { driveFileId: fileHash },
      update: {
        status: 'ERROR',
        errorMessage: err.message,
        processedAt: new Date()
      },
      create: {
        driveFileId: fileHash,
        name: fileName,
        modifiedTime: stats.mtime,
        source: 'LOCAL',
        status: 'ERROR',
        errorMessage: err.message,
        processedAt: new Date()
      }
    });
    
    // Mover arquivo para error/
    try {
      await moveFile(filePath, path.join(normalizedBasePath, 'error'));
    } catch {
      // Ignorar erro ao mover
    }
    
    return { success: false, importedRows: 0, skippedRows: 0, error: err.message };
  }
}

// ============================================================================
// MAIN IMPORT RUNNER
// ============================================================================

/**
 * Executa importação de todos os arquivos em inbox/
 */
export async function runImport(basePath: string): Promise<ImportSummary> {
  const normalizedPath = path.normalize(basePath);
  const summary: ImportSummary = {
    ok: true,
    importedFiles: 0,
    importedRows: 0,
    skippedFiles: 0,
    skippedRows: 0,
    errors: []
  };
  
  try {
    // Garantir que pastas existem
    await ensureFolders(normalizedPath);
    
    // Listar arquivos
    const files = await listInboxFiles(normalizedPath);
    
    if (files.length === 0) {
      return summary;
    }
    
    // Processar cada arquivo
    for (const filePath of files) {
      const result = await importFile(filePath, normalizedPath);
      
      if (result.success) {
        if (result.importedRows > 0) {
          summary.importedFiles++;
          summary.importedRows += result.importedRows;
        } else {
          summary.skippedFiles++;
        }
        summary.skippedRows += result.skippedRows;
      } else {
        summary.errors.push({
          file: path.basename(filePath),
          message: result.error || 'Erro desconhecido'
        });
      }
    }
    
    summary.ok = summary.errors.length === 0;
    
  } catch (err: any) {
    summary.ok = false;
    summary.errors.push({
      file: 'general',
      message: err.message
    });
  }
  
  return summary;
}

// ============================================================================
// STATUS CHECK
// ============================================================================

/**
 * Retorna status da pasta de importação
 */
export async function getFolderStatus(basePath: string): Promise<FolderStatus> {
  const normalizedPath = path.normalize(basePath);
  
  const status: FolderStatus = {
    exists: false,
    path: normalizedPath,
    inboxCount: 0,
    processedCount: 0,
    errorCount: 0,
    lastRun: null,
    lastFileName: null
  };
  
  try {
    // Verificar se pasta existe
    await fs.access(normalizedPath);
    status.exists = true;
    
    // Criar subpastas se não existirem
    await ensureFolders(normalizedPath);
    
    // Contar arquivos
    status.inboxCount = await countFilesInFolder(normalizedPath, 'inbox');
    status.processedCount = await countFilesInFolder(normalizedPath, 'processed');
    status.errorCount = await countFilesInFolder(normalizedPath, 'error');
    
    // Buscar último arquivo processado localmente
    const lastFile = await db.sourceFile.findFirst({
      where: { source: 'LOCAL' },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true, name: true }
    });
    
    if (lastFile) {
      status.lastRun = lastFile.processedAt;
      status.lastFileName = lastFile.name;
    }
    
  } catch (_err: unknown) {
    // Pasta não existe ou erro de acesso
    status.exists = false;
  }
  
  return status;
}
