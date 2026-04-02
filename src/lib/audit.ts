import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_RESET_ADMIN'
  | 'PASSWORD_CHANGED_SELF'
  | 'FIRST_LOGIN_COMPLETED'
  | 'IMPERSONATE_INVESTOR';

interface AuditEntry {
  action: AuditAction;
  actorUserId?: string | null;
  actorRole?: string | null;
  targetUserId?: string | null;
  targetInvestorId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws to callers.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorRole: entry.actorRole ?? null,
        targetUserId: entry.targetUserId ?? null,
        targetInvestorId: entry.targetInvestorId ?? null,
        metadata: entry.metadata ?? undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/** Extract IP from request headers (X-Forwarded-For or connection). */
export function extractIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  return real || null;
}

/** Extract User-Agent from request headers (truncated to 256 chars). */
export function extractUserAgent(req: Request): string | null {
  const ua = req.headers.get('user-agent');
  return ua ? ua.slice(0, 256) : null;
}
