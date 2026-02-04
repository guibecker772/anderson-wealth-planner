/**
 * Diagnostic Script - Check database state
 */

import { db } from '../src/lib/db';

async function diagnose() {
  console.log('\n=== DATABASE DIAGNOSTIC ===\n');

  // 1. Count by type
  const counts = await db.transaction.groupBy({
    by: ['type'],
    _count: { id: true },
  });
  
  console.log('1. Transaction counts by type:');
  if (counts.length === 0) {
    console.log('   ⚠️  NO TRANSACTIONS FOUND IN DATABASE');
  } else {
    counts.forEach(c => {
      console.log(`   ${c.type}: ${c._count.id} records`);
    });
  }

  // 2. Date ranges by type
  console.log('\n2. Date ranges by type:');
  for (const type of ['PAYABLE', 'RECEIVABLE'] as const) {
    const minMax = await db.transaction.aggregate({
      where: { type },
      _min: { dueDate: true },
      _max: { dueDate: true },
    });
    console.log(`   ${type}:`);
    console.log(`     Min dueDate: ${minMax._min.dueDate || 'N/A'}`);
    console.log(`     Max dueDate: ${minMax._max.dueDate || 'N/A'}`);
  }

  // 3. Sample records
  console.log('\n3. Sample records (5 most recent):');
  const samples = await db.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      dueDate: true,
      category: true,
      plannedAmount: true,
      status: true,
      rawLabel: true,
      categorySource: true,
    },
  });
  
  if (samples.length === 0) {
    console.log('   No records to display');
  } else {
    samples.forEach((s, i) => {
      console.log(`   [${i + 1}] ID: ${s.id.slice(0, 8)}... | Type: ${s.type} | Date: ${s.dueDate?.toISOString().slice(0, 10) || 'N/A'} | Category: ${s.category || 'null'} | Amount: ${s.plannedAmount}`);
    });
  }

  // 4. Check SourceFiles
  console.log('\n4. Source files status:');
  const sourceFiles = await db.sourceFile.findMany({
    orderBy: { processedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      status: true,
      processedAt: true,
      errorMessage: true,
      _count: { select: { transactions: true } },
    },
  });
  
  if (sourceFiles.length === 0) {
    console.log('   ⚠️  NO SOURCE FILES FOUND - Import never ran?');
  } else {
    sourceFiles.forEach(sf => {
      console.log(`   ${sf.name}: ${sf.status} (${sf._count.transactions} txns) ${sf.errorMessage ? '❌ ' + sf.errorMessage : ''}`);
    });
  }

  // 5. CategoryNormalizationRules
  console.log('\n5. Normalization rules:');
  const rules = await db.categoryNormalizationRule.count();
  console.log(`   Total rules: ${rules}`);

  console.log('\n=== END DIAGNOSTIC ===\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Diagnostic failed:', e);
    process.exit(1);
  });
