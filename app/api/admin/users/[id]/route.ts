import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { requireAdmin, isAuthError } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { audit, extractIp, extractUserAgent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET /api/admin/users/[id] — Get single user */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      firstLogin: true,
      investorId: true,
      createdAt: true,
      updatedAt: true,
      investor: { select: { id: true, displayName: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/** PATCH /api/admin/users/[id] — Update user */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const existingUser = await db.user.findUnique({ where: { id: params.id } });
  if (!existingUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { name, email, role, investorId, active, password } = body as {
    name?: string;
    email?: string;
    role?: string;
    investorId?: string | null;
    active?: boolean;
    password?: string;
  };

  const data: Record<string, unknown> = {};

  // Name
  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: 'Nome não pode ser vazio' }, { status: 400 });
    }
    data.name = name.trim();
  }

  // Email
  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email não pode ser vazio' }, { status: 400 });
    }
    if (normalizedEmail !== existingUser.email) {
      const dup = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (dup) {
        return NextResponse.json({ error: 'Email já cadastrado por outro usuário' }, { status: 409 });
      }
    }
    data.email = normalizedEmail;
  }

  // Role
  if (role !== undefined) {
    const validRoles = ['ADMIN', 'INVESTOR'] as const;
    if (!validRoles.includes(role as typeof validRoles[number])) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 });
    }
    // Prevent removing the last admin
    if (existingUser.role === 'ADMIN' && role === 'INVESTOR') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN', active: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível remover o último administrador' }, { status: 400 });
      }
    }
    data.role = role;
  }

  // InvestorId
  if (investorId !== undefined) {
    if (investorId) {
      const investor = await db.investor.findUnique({ where: { id: investorId } });
      if (!investor) {
        return NextResponse.json({ error: 'Investidor não encontrado' }, { status: 400 });
      }
    }
    data.investorId = investorId || null;
  }

  // Determine final role for validation
  const finalRole = (data.role as string) ?? existingUser.role;
  const finalInvestorId = data.investorId !== undefined ? data.investorId : existingUser.investorId;

  // INVESTOR must have investorId
  if (finalRole === 'INVESTOR' && !finalInvestorId) {
    return NextResponse.json({ error: 'Usuário investidor deve estar vinculado a um investidor' }, { status: 400 });
  }

  // Active/inactive
  if (active !== undefined) {
    // Prevent deactivating the last admin
    if (!active && existingUser.role === 'ADMIN') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN', active: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível inativar o último administrador' }, { status: 400 });
      }
    }
    data.active = active;
  }

  // Password reset
  if (password !== undefined) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }
    data.passwordHash = await hash(password, 12);
    data.firstLogin = true; // Force password change on next login
  }

  const user = await db.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      firstLogin: true,
      investorId: true,
      createdAt: true,
      updatedAt: true,
      investor: { select: { id: true, displayName: true } },
    },
  });

  // Audit: determine action type
  const ip = extractIp(req);
  const ua = extractUserAgent(req);
  const changes: Record<string, string | boolean | null> = {};
  if (name !== undefined) changes.name = name;
  if (email !== undefined) changes.email = email;
  if (role !== undefined) changes.role = role;
  if (investorId !== undefined) changes.investorId = investorId;

  if (password !== undefined) {
    await audit({
      action: 'PASSWORD_RESET_ADMIN',
      actorUserId: auth.id,
      actorRole: auth.role,
      targetUserId: user.id,
      targetInvestorId: user.investorId,
      ip,
      userAgent: ua,
    });
  }

  if (active !== undefined && active !== existingUser.active) {
    await audit({
      action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      actorUserId: auth.id,
      actorRole: auth.role,
      targetUserId: user.id,
      targetInvestorId: user.investorId,
      ip,
      userAgent: ua,
    });
  }

  if (Object.keys(changes).length > 0) {
    await audit({
      action: 'USER_UPDATED',
      actorUserId: auth.id,
      actorRole: auth.role,
      targetUserId: user.id,
      targetInvestorId: user.investorId,
      metadata: changes,
      ip,
      userAgent: ua,
    });
  }

  return NextResponse.json({ user });
}
