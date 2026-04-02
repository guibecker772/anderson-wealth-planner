'use client';

import { useSession } from 'next-auth/react';
import { ChangePasswordForm } from '@/components/portal/ChangePasswordForm';

export default function TrocarSenhaPage() {
  const { data: session } = useSession();
  const forced = session?.user?.firstLogin === true;

  return (
    <div className="py-8">
      <ChangePasswordForm forced={forced} />
    </div>
  );
}
