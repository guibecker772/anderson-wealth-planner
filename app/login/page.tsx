'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Email ou senha inválidos.');
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#022D44] via-[#033b5a] to-[#022D44]">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 shadow-2xl">
        {/* Logo / brand */}
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#022D44] text-white">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">ClikFinance</h1>
          <p className="mt-2 text-sm text-slate-500">Faça login para acessar o sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44] focus:outline-none focus:ring-2 focus:ring-[#022D44]/20"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44] focus:outline-none focus:ring-2 focus:ring-[#022D44]/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#022D44] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#033b5a] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
