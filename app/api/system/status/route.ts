import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info: Record<string, unknown> = {
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ...info,
      database: 'não configurado',
      lastImport: null,
      totalEntries: 0,
      totalFiles: 0,
    });
  }

  try {
    const { db } = await import('@/lib/db');

    const [totalEntries, totalFiles, lastFile] = await Promise.all([
      db.financialEntry.count(),
      db.sourceFile.count(),
      db.sourceFile.findFirst({
        orderBy: { processedAt: 'desc' },
        select: { name: true, processedAt: true, status: true },
      }),
    ]);

    return NextResponse.json({
      ...info,
      database: 'conectado',
      lastImport: lastFile
        ? {
            file: lastFile.name,
            date: lastFile.processedAt?.toISOString() ?? null,
            status: lastFile.status,
          }
        : null,
      totalEntries,
      totalFiles,
    });
  } catch {
    return NextResponse.json({
      ...info,
      database: 'erro de conexão',
      lastImport: null,
      totalEntries: 0,
      totalFiles: 0,
    });
  }
}
