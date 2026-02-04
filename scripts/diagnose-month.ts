/**
 * Diagnostic Script - Check current month data
 */

import { db } from '../src/lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';

async function diagnose() {
  console.log('\n=== CURRENT MONTH DIAGNOSTIC ===\n');

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  console.log(`Current date: ${now.toISOString()}`);
  console.log(`Month range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

  // Count in current month by type
  for (const type of ['PAYABLE', 'RECEIVABLE'] as const) {
    const count = await db.transaction.count({
      where: {
        type,
        dueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });
    console.log(`\n${type} this month: ${count} records`);
    
    // Sample records
    const samples = await db.transaction.findMany({
      where: {
        type,
        dueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      take: 3,
      orderBy: { dueDate: 'asc' },
      select: {
        dueDate: true,
        counterparty: true,
        plannedAmount: true,
      },
    });
    samples.forEach(s => {
      console.log(`  - ${s.dueDate?.toISOString().slice(0, 10)} | ${s.counterparty || '?'} | R$ ${s.plannedAmount}`);
    });
  }

  console.log('\n=== END ===\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Diagnostic failed:', e);
    process.exit(1);
  });
