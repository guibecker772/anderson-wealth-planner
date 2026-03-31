import { NextRequest, NextResponse } from 'next/server';
import { runImport } from '@/lib/import/localImporter';
import { authorizeImportRequest } from '@/lib/import/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = authorizeImportRequest(request);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, message: auth.message },
        { status: 401 }
      );
    }

    const summary = await runImport();

    return NextResponse.json({
      ok: summary.ok,
      message: summary.ok
        ? `Importação concluída: ${summary.importedFiles} arquivo(s), ${summary.importedRows} linha(s) nova(s)`
        : 'Importação com erros',
      importedFiles: summary.importedFiles,
      importedRows: summary.importedRows,
      skippedFiles: summary.skippedFiles,
      skippedRows: summary.skippedRows,
      errors: summary.errors,
      files: summary.files,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno ao executar importação';
    console.error('Erro na importação automática:', error);

    return NextResponse.json(
      {
        ok: false,
        message: errMsg,
        importedFiles: 0,
        importedRows: 0,
        skippedFiles: 0,
        skippedRows: 0,
        files: [],
        errors: [{ file: 'general', message: errMsg }],
      },
      { status: 500 }
    );
  }
}
