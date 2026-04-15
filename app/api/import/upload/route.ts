import { NextRequest, NextResponse } from 'next/server';
import { stageUploadedFiles } from '@/lib/import/stagingImporter';
import { authorizeImportRequest } from '@/lib/import/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);
    const secretEntry = formData.get('secret');
    const providedSecret = typeof secretEntry === 'string' ? secretEntry : null;
    const sourceModeEntry = formData.get('sourceMode');
    const rootLabelEntry = formData.get('rootLabel');
    const relativePathEntry = formData.get('relativePath');
    const sourceMode: 'DEVICE_FOLDER' | 'MANUAL_UPLOAD' =
      sourceModeEntry === 'DEVICE_FOLDER' || sourceModeEntry === 'MANUAL_UPLOAD'
        ? sourceModeEntry
        : 'MANUAL_UPLOAD';
    const rootLabel = typeof rootLabelEntry === 'string' ? rootLabelEntry : null;
    const relativePath = typeof relativePathEntry === 'string' ? relativePathEntry : null;

    const auth = authorizeImportRequest(request, providedSecret);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, message: auth.message },
        { status: 401 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    const inputs = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
        lastModified: file.lastModified ? new Date(file.lastModified) : null,
        clientContext: {
          effectiveSourceMode: sourceMode,
          rootLabel,
          relativePath,
        },
      }))
    );

    const summary = await stageUploadedFiles(inputs);

    return NextResponse.json({
      ok: summary.ok,
      message: summary.ok
        ? `Upload processado em staging: ${summary.importedFiles} arquivo(s), ${summary.importedRows} linha(s) validadas`
        : 'Upload processado com erros de staging',
      importedFiles: summary.importedFiles,
      importedRows: summary.importedRows,
      skippedFiles: summary.skippedFiles,
      skippedRows: summary.skippedRows,
      rejectedRows: summary.rejectedRows,
      errors: summary.errors,
      files: summary.files,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno ao processar upload';
    console.error('Erro no upload manual:', error);

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
