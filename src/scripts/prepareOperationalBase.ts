import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

let prisma: PrismaClient;

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

async function getMigrationHistory() {
  try {
    return await prisma.$queryRawUnsafe<
      Array<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >(
      'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at ASC'
    );
  } catch {
    return [];
  }
}

async function collectBackupPayload(startedAt: Date) {
  const [
    sourceFiles,
    transactions,
    categoryNormalizationRules,
    importBatches,
    operationalSnapshots,
    investors,
    vehicles,
    drivers,
    migrationHistory,
  ] = await Promise.all([
    prisma.sourceFile.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    prisma.transaction.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    prisma.categoryNormalizationRule.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }),
    prisma.importBatch.findMany({ orderBy: [{ startedAt: 'asc' }] }),
    prisma.operationalSnapshot.findMany({ orderBy: [{ referenceDate: 'asc' }, { createdAt: 'asc' }] }),
    prisma.investor.findMany({ orderBy: [{ displayName: 'asc' }] }),
    prisma.vehicle.findMany({ orderBy: [{ plate: 'asc' }] }),
    prisma.driver.findMany({ orderBy: [{ displayName: 'asc' }] }),
    getMigrationHistory(),
  ]);

  const summary = {
    startedAt: startedAt.toISOString(),
    databaseUrl: maskDatabaseUrl(process.env.DATABASE_URL),
    counts: {
      sourceFiles: sourceFiles.length,
      transactions: transactions.length,
      categoryNormalizationRules: categoryNormalizationRules.length,
      importBatches: importBatches.length,
      operationalSnapshots: operationalSnapshots.length,
      investors: investors.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
      uniqueFileHashes: new Set(sourceFiles.map((file) => file.driveFileId)).size,
      uniqueLegacyRowHashes: new Set(transactions.map((tx) => tx.rowHash).filter(Boolean)).size,
      uniqueOperationalRowHashes: new Set(operationalSnapshots.map((snapshot) => snapshot.rowHash)).size,
    },
    sourceFilesByKind: Object.entries(
      sourceFiles.reduce<Record<string, number>>((acc, file) => {
        const key = `${file.source}:${file.importMode}:${file.kind}:${file.status}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, count]) => ({ key, count })),
    transactionsByType: Object.entries(
      transactions.reduce<Record<string, number>>((acc, tx) => {
        const key = `${tx.type}:${tx.status}:${tx.categorySource}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, count]) => ({ key, count })),
    notes: [
      'SourceFile e Transaction sao preservados no schema, mas o preparo operacional zera os dados antigos para eliminar conflitos de hash e deduplicacao.',
      'CategoryNormalizationRule e historico de migrations sao preservados.',
      'OperationalSnapshot passa a ser a nova base operacional semanal por veiculo.',
    ],
  };

  return {
    summary,
    data: {
      sourceFiles,
      transactions,
      categoryNormalizationRules,
      importBatches,
      operationalSnapshots,
      investors,
      vehicles,
      drivers,
      migrationHistory,
    },
  };
}

async function writeBackup(payload: Awaited<ReturnType<typeof collectBackupPayload>>, startedAt: Date) {
  const backupDir = path.resolve('backups', 'operational-base', `prepare-${timestampLabel(startedAt)}`);
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, 'summary.json'), JSON.stringify(payload.summary, null, 2));
  await fs.writeFile(path.join(backupDir, 'data.json'), JSON.stringify(payload.data, null, 2));
  return backupDir;
}

async function main() {
  await loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL nao configurado para preparar a base operacional. Defina a conexao do PostgreSQL antes de rodar este script.'
    );
  }

  prisma = new PrismaClient();

  const execute = process.argv.includes('--execute');
  const backupOnly = process.argv.includes('--backup-only');

  if (execute && backupOnly) {
    throw new Error('Use apenas um modo por vez: --execute ou --backup-only.');
  }

  const startedAt = new Date();
  const payload = await collectBackupPayload(startedAt);

  console.log(JSON.stringify(payload.summary, null, 2));

  if (backupOnly) {
    const backupDir = await writeBackup(payload, startedAt);
    console.log(`\nBackup logico concluido em: ${backupDir}`);
    return;
  }

  if (!execute) {
    console.log('\nDry-run finalizado. Nenhum dado foi alterado.');
    console.log('Para gerar somente o backup: npm run db:backup:logical');
    console.log('Para executar backup + limpeza controlada: npm run db:prepare:operational:execute');
    return;
  }

  const backupDir = await writeBackup(payload, startedAt);

  const deleted = await prisma.$transaction(async (tx) => {
    const deletedOperationalSnapshots = await tx.operationalSnapshot.deleteMany();
    const deletedTransactions = await tx.transaction.deleteMany();
    const deletedSourceFiles = await tx.sourceFile.deleteMany();
    const deletedDrivers = await tx.driver.deleteMany();
    const deletedVehicles = await tx.vehicle.deleteMany();
    const deletedInvestors = await tx.investor.deleteMany();
    const deletedImportBatches = await tx.importBatch.deleteMany();

    return {
      deletedOperationalSnapshots: deletedOperationalSnapshots.count,
      deletedTransactions: deletedTransactions.count,
      deletedSourceFiles: deletedSourceFiles.count,
      deletedDrivers: deletedDrivers.count,
      deletedVehicles: deletedVehicles.count,
      deletedInvestors: deletedInvestors.count,
      deletedImportBatches: deletedImportBatches.count,
    };
  });

  const remaining = {
    sourceFiles: await prisma.sourceFile.count(),
    transactions: await prisma.transaction.count(),
    categoryNormalizationRules: await prisma.categoryNormalizationRule.count(),
    importBatches: await prisma.importBatch.count(),
    operationalSnapshots: await prisma.operationalSnapshot.count(),
    investors: await prisma.investor.count(),
    vehicles: await prisma.vehicle.count(),
    drivers: await prisma.driver.count(),
  };

  const result = {
    executedAt: new Date().toISOString(),
    backupDir,
    deleted,
    remaining,
    preserved: ['CategoryNormalizationRule', '_prisma_migrations', 'schema Prisma', 'historico de migrations'],
  };

  await fs.writeFile(path.join(backupDir, 'cleanup-result.json'), JSON.stringify(result, null, 2));

  console.log('\nPreparacao operacional concluida com sucesso.');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('[prepareOperationalBase] Falha:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
