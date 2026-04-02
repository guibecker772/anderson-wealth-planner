import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { requireAdmin, isAuthError } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { audit, extractIp, extractUserAgent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET /api/admin/users — List all users with investor info */
export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const users = await db.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
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

  return NextResponse.json({ users });
}

/** POST /api/admin/users — Create a new user */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { name, email, password, role, investorId, active } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    investorId?: string | null;
    active?: boolean;
  };

  // --- Validations ---
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const validRoles = ['ADMIN', 'INVESTOR'] as const;
  const userRole = validRoles.includes(role as typeof validRoles[number])
    ? (role as typeof validRoles[number])
    : 'INVESTOR';

  // INVESTOR must have an investorId
  if (userRole === 'INVESTOR' && !investorId) {
    return NextResponse.json({ error: 'Usuário investidor deve estar vinculado a um investidor' }, { status: 400 });
  }

  // Check email uniqueness
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
  }

  // Validate investor exists if provided
  if (investorId) {
    const investor = await db.investor.findUnique({ where: { id: investorId } });
    if (!investor) {
      return NextResponse.json({ error: 'Investidor não encontrado' }, { status: 400 });
    }
  }

  const passwordHash = await hash(password, 12);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
      investorId: investorId || null,
      active: active !== false,
      firstLogin: userRole === 'INVESTOR',
    },
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

  // Audit user creation
  await audit({
    action: 'USER_CREATED',
    actorUserId: auth.id,
    actorRole: auth.role,
    targetUserId: user.id,
    targetInvestorId: investorId || null,
    metadata: { name: user.name, email: user.email, role: user.role },
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return NextResponse.json({ user }, { status: 201 });
}
