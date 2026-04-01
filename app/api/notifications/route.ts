import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SystemNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
  timestamp: string;
}

export async function GET() {
  const notifications: SystemNotification[] = [];

  if (!process.env.DATABASE_URL) {
    notifications.push({
      id: 'no-db',
      type: 'warning',
      title: 'Banco de dados não configurado',
      detail: 'Defina DATABASE_URL para ativar o sistema',
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ notifications, count: notifications.length });
  }

  try {
    const { db } = await import('@/lib/db');

    // Check for recent import errors
    const recentErrors = await db.sourceFile.count({
      where: {
        status: 'ERROR',
        processedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentErrors > 0) {
      notifications.push({
        id: 'import-errors',
        type: 'error',
        title: `${recentErrors} importação(ões) com erro`,
        detail: 'Últimos 7 dias — verifique em Relatórios',
        timestamp: new Date().toISOString(),
      });
    }

    // Check for files with error count > 0
    const filesWithErrors = await db.sourceFile.count({
      where: { errorCount: { gt: 0 }, status: 'PROCESSED' },
    });
    if (filesWithErrors > 0) {
      notifications.push({
        id: 'files-with-errors',
        type: 'warning',
        title: `${filesWithErrors} arquivo(s) processados com erros`,
        detail: 'Alguns registros não foram importados corretamente',
        timestamp: new Date().toISOString(),
      });
    }

    // Check for unpaid/pending fines
    const pendingFines = await db.fineRecord.count({
      where: { paymentState: { in: ['UNPAID', 'UNKNOWN'] } },
    });
    if (pendingFines > 0) {
      notifications.push({
        id: 'pending-fines',
        type: 'info',
        title: `${pendingFines} multa(s) pendente(s)`,
        detail: 'Multas sem registro de pagamento ou em status desconhecido',
        timestamp: new Date().toISOString(),
      });
    }

    // Check for pending source files
    const pendingFiles = await db.sourceFile.count({
      where: { status: 'PENDING' },
    });
    if (pendingFiles > 0) {
      notifications.push({
        id: 'pending-imports',
        type: 'info',
        title: `${pendingFiles} arquivo(s) aguardando processamento`,
        detail: 'Existem arquivos importados ainda não processados',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ notifications, count: notifications.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { notifications: [{ id: 'system-error', type: 'error', title: 'Erro ao verificar notificações', detail: message, timestamp: new Date().toISOString() }], count: 1 },
      { status: 200 }
    );
  }
}
