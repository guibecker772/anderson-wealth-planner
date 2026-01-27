import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../lib/db';
import { parsePayables } from '../lib/parsers/payables';
import { parseReceivables } from '../lib/parsers/receivables';
import { Prisma } from '@prisma/client';

async function main() {
  const localDir = path.join(process.cwd(), 'local_data');
  
  if (!fs.existsSync(localDir)) {
    console.log('Criando diretório local_data...');
    fs.mkdirSync(localDir);
    console.log('Por favor, coloque arquivos .xlsx em /local_data e rode novamente.');
    return;
  }

  const files = fs.readdirSync(localDir).filter(f => f.endsWith('.xlsx'));
  
  console.log(`Encontrados ${files.length} arquivos.`);

  for (const file of files) {
    const filePath = path.join(localDir, file);
    const buffer = fs.readFileSync(filePath);
    
    // Checksum simples
    const checksum = crypto.createHash('md5').update(buffer).digest('hex');
    const stats = fs.statSync(filePath);

    // Upsert SourceFile
    const sourceFile = await db.sourceFile.upsert({
      where: { driveFileId: `local_${file}` },
      update: {
        modifiedTime: stats.mtime,
        checksum,
      },
      create: {
        driveFileId: `local_${file}`,
        name: file,
        modifiedTime: stats.mtime,
        checksum,
        status: 'PROCESSED',
        processedAt: new Date(),
      }
    });

    console.log(`Processando ${file}...`);
    
    // Detect type by filename
    let transactions = [];
    if (file.toLowerCase().includes('contas a pagar') || file.toLowerCase().includes('despesas')) {
      transactions = await parsePayables(buffer);
    } else {
      transactions = await parseReceivables(buffer);
    }

    console.log(`  > ${transactions.length} transações encontradas.`);

    // Delete & Replace Strategy
    await db.transaction.deleteMany({ where: { sourceFileId: sourceFile.id } });
    
    // Preparar dados para createMany (converter números para string para Decimal)
    const data: Prisma.TransactionCreateManyInput[] = transactions.map(t => ({
      sourceFileId: sourceFile.id,
      type: t.type,
      externalId: t.externalId,
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
      rawJson: t.rawJson,
    }));

    await db.transaction.createMany({ data });
    
    console.log(`  > ${data.length} transações salvas no DB.`);
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });