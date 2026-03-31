import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

function loadEnvFile(filePath: string) {
  return fs
    .readFile(filePath, 'utf8')
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separator = trimmed.indexOf('=');
        if (separator <= 0) continue;

        const key = trimmed.slice(0, separator).trim();
        const rawValue = trimmed.slice(separator + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, '');

        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => undefined);
}

async function loadLocalEnv() {
  await loadEnvFile(path.resolve('.env'));
  await loadEnvFile(path.resolve('.env.local'));
}

function timestampLabel(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function maskDatabaseUrl(url: string | undefined) {
  if (!url) return null;
  return url.replace(/:(.+?)@/, ':********@');
}

async function main() {
  await loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurado para executar o reset de validacao da importacao.');
  }

  const execute = process.argv.includes('--execute');
  const startedAt = new Date();
  const backupDir = path.resolve('backups', 'import-validation');
  const backupFile = path.join(backupDir, `import-validation-reset-${timestampLabel(startedAt)}.json`);

  const sourceFiles = await prisma.sourceFile.findMany({
    orderBy: [{ createdAt: 'asc' }],
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  });

  const sourceFileIds = sourceFiles.map((file) => file.id);
  const transactions = sourceFileIds.length
    ? await prisma.transaction.findMany({
        where: { sourceFileId: { in: sourceFileIds } },
        orderBy: [{ createdAt: 'asc' }],
      })
    : [];

  const summary = {
    startedAt: startedAt.toISOString(),
    execute,
    databaseUrl: maskDatabaseUrl(process.env.DATABASE_URL),
    counts: {
      sourceFiles: sourceFiles.length,
      transactions: transactions.length,
      uniqueFileHashes: new Set(sourceFiles.map((file) => file.driveFileId)).size,
      uniqueRowHashes: new Set(transactions.map((tx) => tx.rowHash).filter(Boolean)).size,
    },
    sourceFilesByMode: Object.entries(
      sourceFiles.reduce<Record<string, number>>((acc, file) => {
        const key = `${file.source}:${file.importMode}:${file.kind}:${file.status}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, count]) => ({ key, count })),
    notes: [
      'SourceFile guarda o historico de arquivos importados e o hash do arquivo em driveFileId.',
      'Transaction guarda os lancamentos derivados e a deduplicacao por linha em rowHash.',
      'O reset remove apenas historico e dados derivados de importacao, preservando schema, migrations e configuracoes.',
    ],
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!execute) {
    console.log('\nDry-run finalizado. Nenhum dado foi removido.');
    console.log(`Se quiser executar de verdade, rode: npm run import:reset-validation`);
    return;
  }

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(
    backupFile,
    JSON.stringify(
      {
        meta: summary,
        sourceFiles,
        transactions,
      },
      null,
      2
    ),
    'utf8'
  );

  const deleted = await prisma.$transaction(async (tx) => {
    const deletedTransactions = sourceFileIds.length
      ? await tx.transaction.deleteMany({
          where: { sourceFileId: { in: sourceFileIds } },
        })
      : { count: 0 };

    const deletedSourceFiles = sourceFileIds.length
      ? await tx.sourceFile.deleteMany({
          where: { id: { in: sourceFileIds } },
        })
      : { count: 0 };

    return {
      deletedTransactions: deletedTransactions.count,
      deletedSourceFiles: deletedSourceFiles.count,
    };
  });

  const postCheck = {
    sourceFiles: await prisma.sourceFile.count(),
    transactions: await prisma.transaction.count(),
  };

  console.log('\nReset executado com sucesso.');
  console.log(`Backup: ${backupFile}`);
  console.log(
    JSON.stringify(
      {
        deleted,
        postCheck,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('\nFalha ao executar reset de validacao da importacao:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
