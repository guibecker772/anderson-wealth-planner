import { NextResponse } from 'next/server';
import { ensureFolders, getFolderStatus, listInboxFiles, resolveImportRoot } from '@/lib/import/localImporter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = await getFolderStatus();

    return NextResponse.json({
      ok: true,
      message: status.configured
        ? status.exists
          ? `Raiz pronta com ${status.inboxCount} arquivo(s) pendente(s) em inbox/`
          : 'Raiz configurada, mas a pasta ainda não foi encontrada'
        : 'Raiz automática ainda não configurada. Upload manual continua disponível.',
      status,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro ao verificar status';
    console.error('Erro ao verificar status da importação:', error);
    return NextResponse.json({
      ok: false,
      message: errMsg,
      status: null,
    });
  }
}

export async function POST() {
  try {
    const config = resolveImportRoot();

    if (!config.basePath) {
      return NextResponse.json({
        ok: false,
        message: 'IMPORT_ROOT_FOLDER/LOCAL_IMPORT_FOLDER não configurado. Use o upload manual enquanto isso.',
        status: await getFolderStatus(),
      });
    }

    await ensureFolders(config.basePath);
    const files = await listInboxFiles(config.basePath);
    const status = await getFolderStatus(config.basePath);

    return NextResponse.json({
      ok: true,
      message: `Estrutura validada. ${files.length} arquivo(s) encontrado(s) em inbox/.`,
      filesInInbox: files.length,
      status,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao validar raiz de importação:', error);
    return NextResponse.json({
      ok: false,
      message: `Erro: ${errMsg}`,
      status: null,
    });
  }
}
