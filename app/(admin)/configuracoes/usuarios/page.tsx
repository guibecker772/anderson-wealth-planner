import { Suspense } from 'react';
import { Shield } from 'lucide-react';
import { UserManagement } from '@/components/admin/UserManagement';

export default function UsuariosPage() {
  return (
    <div className="page-shell space-y-3">
      <div className="flex items-center gap-3 pb-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#022D44]/10 text-[#022D44]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Gestão de Acessos</h1>
          <p className="text-xs text-slate-500">
            Controle de usuários, vínculo com investidor e credenciais de primeiro acesso
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-[560px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <UserManagement />
      </Suspense>
    </div>
  );
}
