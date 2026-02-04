import { NextRequest, NextResponse } from 'next/server';
import { runImport } from '@/lib/import/localImporter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/import/local
 * Executa importação de arquivos Excel da pasta local
 * Protegido por CRON_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    // Validar autenticação
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');
    
    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, message: 'CRON_SECRET não configurado no servidor' },
        { status: 500 }
      );
    }
    
    if (headerSecret !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json(
        { ok: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    // Verificar pasta configurada
    const basePath = process.env.LOCAL_IMPORT_FOLDER;
    
    if (!basePath) {
      return NextResponse.json(
        { ok: false, message: 'LOCAL_IMPORT_FOLDER não configurado' },
        { status: 500 }
      );
    }
    
    // Executar importação
    const summary = await runImport(basePath);
    
    return NextResponse.json({
      ok: summary.ok,
      message: summary.ok 
        ? `Importação concluída: ${summary.importedFiles} arquivos, ${summary.importedRows} transações`
        : `Importação com erros`,
      importedFiles: summary.importedFiles,
      importedRows: summary.importedRows,
      skippedFiles: summary.skippedFiles,
      skippedRows: summary.skippedRows,
      errors: summary.errors
    });
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno ao executar importação';
    console.error('Erro na importação local:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: errMsg,
        importedFiles: 0,
        importedRows: 0,
        skippedFiles: 0,
        errors: [{ file: 'general', message: errMsg }]
      },
      { status: 500 }
    );
  }
}
