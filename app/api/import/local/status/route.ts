import { NextResponse } from 'next/server';
import { getFolderStatus, ensureFolders, listInboxFiles } from '@/lib/import/localImporter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/import/local/status
 * Retorna status da pasta de importação local
 */
export async function GET() {
  try {
    const basePath = process.env.LOCAL_IMPORT_FOLDER;
    
    if (!basePath) {
      return NextResponse.json({
        ok: false,
        message: 'LOCAL_IMPORT_FOLDER não configurado',
        status: null
      });
    }
    
    const status = await getFolderStatus(basePath);
    
    return NextResponse.json({
      ok: true,
      message: status.exists 
        ? `Pasta configurada com ${status.inboxCount} arquivos pendentes`
        : 'Pasta não encontrada',
      status
    });
    
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    return NextResponse.json({
      ok: false,
      message: error.message || 'Erro ao verificar status',
      status: null
    });
  }
}

/**
 * POST /api/import/local/status
 * Testa conexão e cria subpastas se necessário
 */
export async function POST() {
  try {
    const basePath = process.env.LOCAL_IMPORT_FOLDER;
    
    if (!basePath) {
      return NextResponse.json({
        ok: false,
        message: 'LOCAL_IMPORT_FOLDER não configurado'
      });
    }
    
    // Criar subpastas
    await ensureFolders(basePath);
    
    // Listar arquivos
    const files = await listInboxFiles(basePath);
    
    return NextResponse.json({
      ok: true,
      message: `Conexão OK. Subpastas criadas/verificadas. ${files.length} arquivo(s) xlsx em inbox/`,
      filesInInbox: files.length
    });
    
  } catch (error: any) {
    console.error('Erro ao testar conexão:', error);
    return NextResponse.json({
      ok: false,
      message: `Erro: ${error.message}`
    });
  }
}
