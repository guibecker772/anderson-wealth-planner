'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';

interface Props {
  forced?: boolean;
}

export function ChangePasswordForm({ forced }: Props) {
  const { update } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Confirmação de senha não confere.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/portal/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao alterar senha.');
        setLoading(false);
        return;
      }

      setSuccess(true);

      // Refresh session to clear firstLogin flag
      await update();

      // Redirect after success
      setTimeout(() => {
        router.push('/portal');
        router.refresh();
      }, 1500);
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-emerald-800">Senha alterada com sucesso!</h2>
        <p className="mt-2 text-sm text-emerald-600">Redirecionando para o portal…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      {forced && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Troca de senha obrigatória</p>
            <p className="mt-0.5 text-xs text-amber-600">
              Este é seu primeiro acesso. Defina uma nova senha para continuar.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#022D44]/10 text-[#022D44]">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {forced ? 'Defina sua nova senha' : 'Alterar senha'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {forced
              ? 'Escolha uma senha segura com pelo menos 6 caracteres.'
              : 'Informe sua senha atual e escolha uma nova.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
              {forced ? 'Senha provisória' : 'Senha atual'}
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44] focus:outline-none focus:ring-2 focus:ring-[#022D44]/20"
                placeholder={forced ? 'Senha fornecida pelo administrador' : 'Sua senha atual'}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
              Nova senha
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44] focus:outline-none focus:ring-2 focus:ring-[#022D44]/20"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="mt-1 text-xs text-amber-600">Mínimo 6 caracteres</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
              Confirmar nova senha
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#022D44] focus:outline-none focus:ring-2 focus:ring-[#022D44]/20"
                placeholder="Repita a nova senha"
              />
            </div>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">Senhas não conferem</p>
            )}
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
            {loading ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
