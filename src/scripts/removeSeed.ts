/**
 * Admin script to remove "Seed Data.xlsx" and all associated transactions
 * 
 * Usage: npm run admin:remove-seed
 * 
 * This script will:
 * 1. Find all SourceFile records with name "Seed Data.xlsx"
 * 2. Delete all associated Transactions (via cascade)
 * 3. Delete the SourceFile records
 * 4. Move the physical file to an "archived" folder if it exists
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Procurando arquivos de seed...\n');

  // Find seed files
  const seedFiles = await prisma.sourceFile.findMany({
    where: {
      name: 'Seed Data.xlsx',
    },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  });

  if (seedFiles.length === 0) {
    console.log('✅ Nenhum arquivo "Seed Data.xlsx" encontrado no banco.');
    return;
  }

  console.log(`📁 Encontrados ${seedFiles.length} arquivo(s) de seed:`);
  for (const file of seedFiles) {
    console.log(`   - ${file.name} (ID: ${file.id})`);
    console.log(`     Transações: ${file._count.transactions}`);
    console.log(`     Status: ${file.status}`);
    console.log(`     Processado em: ${file.processedAt || 'N/A'}`);
  }

  console.log('\n🗑️  Removendo dados...\n');

  // Use a transaction to safely delete all related data
  const result = await prisma.$transaction(async (tx) => {
    let totalTransactionsDeleted = 0;

    for (const seedFile of seedFiles) {
      // Count transactions before deletion
      const transactionCount = await tx.transaction.count({
        where: { sourceFileId: seedFile.id },
      });

      totalTransactionsDeleted += transactionCount;

      // Delete the source file (cascade will delete transactions)
      await tx.sourceFile.delete({
        where: { id: seedFile.id },
      });

      console.log(`   ✓ Removido: ${seedFile.name}`);
      console.log(`     - ${transactionCount} transações deletadas`);
    }

    return {
      filesDeleted: seedFiles.length,
      transactionsDeleted: totalTransactionsDeleted,
    };
  });

  console.log(`\n📊 Resumo:`);
  console.log(`   Arquivos removidos: ${result.filesDeleted}`);
  console.log(`   Transações removidas: ${result.transactionsDeleted}`);

  // Try to archive the physical file
  const localFolder = process.env.LOCAL_IMPORT_FOLDER;
  if (localFolder) {
    const processedPath = path.join(localFolder, 'processed', 'Seed Data.xlsx');
    const archivedFolder = path.join(localFolder, 'archived');
    
    if (fs.existsSync(processedPath)) {
      console.log('\n📦 Arquivando arquivo físico...');
      
      if (!fs.existsSync(archivedFolder)) {
        fs.mkdirSync(archivedFolder, { recursive: true });
      }
      
      const archivedPath = path.join(archivedFolder, `Seed Data.xlsx.${Date.now()}.archived`);
      fs.renameSync(processedPath, archivedPath);
      console.log(`   ✓ Movido para: ${archivedPath}`);
    }
  }

  console.log('\n✅ Seed data removido com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
