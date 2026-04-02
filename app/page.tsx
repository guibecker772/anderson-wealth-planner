import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-utils';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role === 'INVESTOR') redirect('/portal');
  redirect('/dashboard');
}