import { NextRequest, NextResponse } from 'next/server';
import { runStagingImport } from '@/lib/import/stagingImporter';
import { authorizeImportRequest } from '@/lib/import/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = authorizeImportRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });
    }

    const summary = await runStagingImport();

    return NextResponse.json({
      ok: summary.ok,
      message: summary.ok
        ? `Importacao em staging concluida: ${summary.importedFiles} arquivo(s), ${summary.importedRows} linha(s) validadas`
        : 'Importacao em staging com erros',
      importedFiles: summary.importedFiles,
      importedRows: summary.importedRows,
      skippedFiles: summary.skippedFiles,
      skippedRows: summary.skippedRows,
      rejectedRows: summary.rejectedRows,
      errors: summary.errors,
      files: summary.files,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno ao executar importacao';
    console.error('Erro na importacao automatica:', error);

    return NextResponse.json(
      {
        ok: false,
        message: errMsg,
        importedFiles: 0,
        importedRows: 0,
        skippedFiles: 0,
        skippedRows: 0,
        rejectedRows: 0,
        files: [],
        errors: [{ file: 'general', message: errMsg }],
      },
      { status: 500 }
    );
  }
}
