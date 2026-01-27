import { db } from '../lib/db';
import { TransactionType, TransactionStatus } from '@prisma/client';

async function main() {
  // Check if data exists
  const count = await db.transaction.count();
  if (count > 0) {
    console.log('Banco já possui dados. Pulando seed.');
    return;
  }

  console.log('Seedando dados iniciais...');

  const file = await db.sourceFile.create({
    data: {
      driveFileId: 'seed_file_01',
      name: 'Seed Data.xlsx',
      modifiedTime: new Date(),
      status: 'PROCESSED',
      processedAt: new Date()
    }
  });

  const categories = ['Aluguel', 'Energia', 'Fornecedores', 'Salários', 'Impostos'];
  
  const transactions = [];
  for (let i = 0; i < 50; i++) {
    const isExpense = Math.random() > 0.4;
    const amount = Math.floor(Math.random() * 5000) + 100;
    const status = Math.random() > 0.2 ? TransactionStatus.SETTLED : TransactionStatus.PENDING;
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // last 60 days

    transactions.push({
      sourceFileId: file.id,
      type: isExpense ? TransactionType.PAYABLE : TransactionType.RECEIVABLE,
      externalId: `SEED-${1000 + i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      counterparty: isExpense ? `Fornecedor ${i}` : `Cliente ${i}`,
      description: `Lançamento mock ${i}`,
      plannedAmount: amount,
      actualAmount: status === 'SETTLED' ? amount : null,
      plannedDate: date,
      dueDate: date,
      actualDate: status === 'SETTLED' ? date : null,
      status: status,
    });
  }

  await db.transaction.createMany({ data: transactions });
  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });