import { Suspense } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import { UserManagement } from '@/components/admin/UserManagement';

export default function UsuariosPage() {
  return (
    <div className="page-shell max-w-6xl">
      <PageHero
        eyebrow="Administração"
        title="Gestão de Usuários"
        description="Crie, edite e gerencie acessos de investidores ao portal. Controle status, vínculo com investidor e redefinição de senha em um único painel."
        accent="blue"
        meta={
          <>
            <span className="page-hero-chip">Acessos</span>
            <span className="page-hero-chip">Portal do Investidor</span>
          </>
        }
      />

      <Suspense fallback={<div className="h-[600px] rounded-[24px] bg-muted/20 animate-pulse" />}>
        <UserManagement />
      </Suspense>
    </div>
  );
}
