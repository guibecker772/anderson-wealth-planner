import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export type UserRole = 'ADMIN' | 'INVESTOR';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  investorId: string | null;
  investorName: string | null;
}

/** Get typed session user. Returns null if not authenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id ?? '',
    email: u.email ?? '',
    name: u.name ?? '',
    role: (u.role as UserRole) ?? 'INVESTOR',
    investorId: u.investorId ?? null,
    investorName: u.investorName ?? null,
  };
}

/** Require authenticated user. Returns 401 JSON response if not authenticated. */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  return user;
}

/** Require admin role. Returns 401/403 JSON response if not authorized. */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
  }
  return result;
}

/** Require investor role or admin. Returns the investorId for scoping. */
export async function requireInvestorScope(): Promise<{ user: SessionUser; investorId: string } | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  // Admin accessing portal — investorId must be provided via query param (for impersonation / testing)
  if (result.role === 'ADMIN') {
    // Admin gets unrestricted access; caller should handle investorId from query
    return { user: result, investorId: '' };
  }

  if (!result.investorId) {
    return NextResponse.json({ error: 'Usuário sem investidor vinculado' }, { status: 403 });
  }
  return { user: result, investorId: result.investorId };
}

/** Helper: check if result is a NextResponse (error). */
export function isAuthError(result: SessionUser | NextResponse | { user: SessionUser; investorId: string }): result is NextResponse {
  return result instanceof NextResponse;
}
