import { format } from "date-fns";
import { Badge } from "@/lib/components/layout/ui/badge";
import { Button } from "@/lib/components/layout/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/lib/components/layout/ui/placeholder-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/components/layout/ui/table";
import { RefreshCw, FileSpreadsheet, HardDrive, CheckCircle2, AlertOctagon, Info } from "lucide-react";

async function getSourceFiles() {
  // Fallback para modo sem DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return { files: [], isMock: true };
  }

  try {
    const { db } = await import("@/lib/db");
    
    const files = await db.sourceFile.findMany({
      orderBy: { processedAt: 'desc' },
      take: 50
    });
    return { files, isMock: false };
  } catch (error) {
    return { files: [], isMock: false };
  }
}

export default async function RelatoriosPage() {
  const { files, isMock } = await getSourceFiles();

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstração: banco não configurado (DATABASE_URL ausente).</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Histórico de Processamento</h2>
          <p className="text-muted-foreground mt-1">
             Logs de ingestão de arquivos do Google Drive e Local.
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Forçar Sincronização
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium">Arquivos Totais</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                  {files.length}
               </div>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  {files.filter(f => f.status === 'PROCESSED').length}
               </div>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2 text-red-600">
                  <AlertOctagon className="w-5 h-5" />
                  {files.filter(f => f.status === 'ERROR').length}
               </div>
            </CardContent>
         </Card>
      </div>
      
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Origem (ID)</TableHead>
              <TableHead>Data Processamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium flex items-center gap-2">
                   <FileSpreadsheet className="w-4 h-4 text-green-600" />
                   {file.name}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                   {file.driveFileId.substring(0, 15)}...
                </TableCell>
                <TableCell>
                  {file.processedAt ? format(new Date(file.processedAt), 'dd/MM/yyyy HH:mm') : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={file.status === 'PROCESSED' ? 'success' : file.status === 'ERROR' ? 'destructive' : 'secondary'}>
                    {file.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={file.errorMessage || ''}>
                   {file.errorMessage || '-'}
                </TableCell>
              </TableRow>
            ))}
            {files.length === 0 && (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum arquivo processado ainda. Rode <code>npm run seed</code> ou ingira dados.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}