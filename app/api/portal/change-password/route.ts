import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { requireAuth, isAuthError } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { audit, extractIp, extractUserAgent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** POST /api/portal/change-password — Investor (or any user) changes own password */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  // --- Validations ---
  if (!currentPassword) {
    return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Confirmação de senha não confere' }, { status: 400 });
  }

  // Fetch current user from DB
  const user = await db.user.findUnique({ where: { id: auth.id } });
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  // Verify current password
  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 403 });
  }

  // Hash new password and update
  const passwordHash = await hash(newPassword, 12);
  const isFirstLogin = user.firstLogin;

  await db.user.update({
    where: { id: auth.id },
    data: {
      passwordHash,
      firstLogin: false,
    },
  });

  // Audit
  const action = isFirstLogin ? 'FIRST_LOGIN_COMPLETED' : 'PASSWORD_CHANGED_SELF';
  await audit({
    action,
    actorUserId: auth.id,
    actorRole: auth.role,
    targetUserId: auth.id,
    targetInvestorId: auth.investorId,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return NextResponse.json({ ok: true, firstLoginCleared: isFirstLogin });
}
