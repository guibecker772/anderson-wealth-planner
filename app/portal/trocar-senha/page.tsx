'use client';

import { ShieldCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { ChangePasswordForm } from '@/components/portal/ChangePasswordForm';

export default function TrocarSenhaPage() {
  const { data: session } = useSession();
  const forced = session?.user?.firstLogin === true;

  return (
    <div className="page-shell">
      <section className="rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-elevated backdrop-blur-xl md:p-7">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#022D44]/8 text-[#022D44]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-[#022D44]/10 bg-[#022D44]/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#022D44]/70">
              Área privada
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#08283c]">
              Segurança da conta
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Atualize sua senha para manter o acesso protegido ao portal do investidor. O fluxo de acesso e autorização permanece inalterado.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-md">
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}
