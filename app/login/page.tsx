'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';

/* ─── ClikCar brand mark (icon + wordmark) ─────────────────── */
function ClikCarMark({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const iconH = size === 'sm' ? 'h-[18px]' : 'h-6';
  const textCls = size === 'sm' ? 'text-[13px]' : 'text-[15px]';
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 36 30" fill="none" className={`${iconH} w-auto`} aria-hidden="true">
        <rect x="1.5" y="1.5" width="22" height="17" rx="3" stroke="white" strokeWidth="2" />
        <rect x="12" y="11" width="22" height="17" rx="3" stroke="white" strokeWidth="2" />
        <path d="M30 24l3.5 3.5" stroke="#A8CF4C" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className={`${textCls} font-extrabold tracking-tight text-white/80`}>
        Clik<span className="text-[#A8CF4C]">Car</span>
      </span>
    </div>
  );
}

/* ─── ClikFinance chart icon (card header) ─────────────────── */
function ClikFinanceIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="18" width="6" height="11" rx="1.5" fill="#A8CF4C" />
      <rect x="12" y="11" width="6" height="18" rx="1.5" fill="#A8CF4C" />
      <rect x="21" y="4" width="6" height="25" rx="1.5" fill="#A8CF4C" />
    </svg>
  );
}

/* ─── Login Form ───────────────────────────────────────────── */
/* Auth logic is IDENTICAL — only visual refinements */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      setError('Email ou senha inválidos. Revise os dados e tente novamente.');
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.04)]">
      <div className="px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        {/* Card header: ClikFinance logo */}
        <div className="mb-6 flex items-center gap-2.5 lg:mb-8">
          <ClikFinanceIcon />
          <span className="text-lg font-extrabold tracking-tight text-[#0A3750] sm:text-xl">
            Clik<span className="text-[#6EAE2C]">Finance</span>
          </span>
        </div>

        {/* Title */}
        <div className="mb-6 space-y-1 lg:mb-7">
          <h2 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.5rem] lg:text-[1.6rem]">
            Área Exclusiva para Investidores.
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500 sm:text-sm">
            Faça login para gerenciar sua carteira.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-slate-700 sm:text-sm">
              Email
            </label>
            <div className="group flex h-[46px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 transition-all focus-within:border-[#0A3750]/25 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[#0A3750]/6 sm:h-12 sm:px-4">
              <Mail className="h-[18px] w-[18px] flex-shrink-0 text-slate-400 transition-colors group-focus-within:text-[#0A3750]" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-full w-full bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="investidor@clikfinance.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-slate-700 sm:text-sm">
              Senha
            </label>
            <div className="group flex h-[46px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 transition-all focus-within:border-[#0A3750]/25 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[#0A3750]/6 sm:h-12 sm:px-4">
              <LockKeyhole className="h-[18px] w-[18px] flex-shrink-0 text-slate-400 transition-colors group-focus-within:text-[#0A3750]" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-full w-full bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Digite sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex-shrink-0 p-1 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
              {error}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#34a85d] to-[#4cb868] text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(49,142,85,0.22)] transition-all hover:shadow-[0_14px_28px_rgba(49,142,85,0.28)] active:scale-[0.99] disabled:opacity-70 sm:h-12 sm:text-[15px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>

        {/* First access notice */}
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 sm:mt-6 sm:gap-2.5 sm:px-4 sm:py-3">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#0A3750]/40" />
          <p className="text-[11px] leading-[1.6] text-slate-400 sm:text-xs">
            Primeiro acesso com senha provisória exige troca obrigatória de senha antes da entrada no portal.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Login Experience (main layout) ───────────────────────── */
function LoginExperience() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#031E2C] via-[#063A50] to-[#0A4D68]">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute right-0 top-0 h-[60%] w-[45%] bg-gradient-to-bl from-white/[0.03] to-transparent" />
        <div className="absolute bottom-0 left-0 h-[35%] w-[30%] bg-gradient-to-tr from-[#A8CF4C]/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col justify-center px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:px-12 xl:px-16">
        <div className="flex w-full flex-col gap-8 lg:grid lg:grid-cols-[1fr_420px] lg:items-center lg:gap-14 xl:grid-cols-[1fr_460px] xl:gap-20">

          {/* ── LEFT: Brand + Message ────────────────── */}
          <section className="flex flex-col lg:py-6">

            {/* ── Mobile compact branding ── */}
            <div className="lg:hidden">
              <ClikCarMark size="sm" />
              <h1 className="mt-4 text-[2rem] font-black leading-none tracking-tight text-white sm:text-[2.4rem]">
                Clik<span className="text-[#A8CF4C]">Finance</span>
              </h1>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Portal do Investidor
              </p>
              <p className="mt-3 max-w-[360px] text-[13px] leading-relaxed text-white/50">
                Acompanhe veículos, operação e resultado da sua carteira.
              </p>
            </div>

            {/* ── Desktop full branding ── */}
            <div className="hidden lg:block">
              <ClikCarMark />

              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 xl:mt-10">
                Portal do Investidor
              </p>
              <h1 className="mt-2.5 text-[2.5rem] font-black leading-none tracking-tight text-white xl:text-[3rem]">
                Clik<span className="text-[#A8CF4C]">Finance</span>
              </h1>

              <h2 className="mt-6 max-w-[460px] text-[1.25rem] font-semibold leading-snug text-white/80 xl:text-[1.4rem] xl:leading-snug">
                Acompanhe a operação e a leitura financeira da sua carteira com clareza.
              </h2>

              <p className="mt-4 max-w-[420px] text-[13px] leading-6 text-white/40 xl:text-sm">
                Área privada para investidores acompanharem veículos, status operacionais, receita recebida, custos, valores a cobrar e resultado da frota.
              </p>

              {/* 3 pillars */}
              <div className="mt-12 flex items-start gap-7 xl:mt-14 xl:gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Veículos</p>
                  <p className="mt-1.5 text-[13px] font-semibold text-white/65">Frota e carteira</p>
                </div>
                <div className="mt-1 h-8 w-px bg-white/8" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Operação</p>
                  <p className="mt-1.5 text-[13px] font-semibold text-white/65">Status operacional</p>
                </div>
                <div className="mt-1 h-8 w-px bg-white/8" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Financeiro</p>
                  <p className="mt-1.5 text-[13px] font-semibold text-white/65">Receita e resultado</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── RIGHT: Login Card ────────────────────── */}
          <section className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[460px] lg:max-w-none">
              <LoginForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Carregando...</div>}
    >
      <LoginExperience />
    </Suspense>
  );
}
