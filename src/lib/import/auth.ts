import type { NextRequest } from 'next/server';

export function authorizeImportRequest(request: NextRequest, extraSecret?: string | null) {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return { ok: true };
  }

  const headerSecret = request.headers.get('x-cron-secret') || request.headers.get('x-import-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');
  const providedSecret = extraSecret || headerSecret || querySecret;

  if (providedSecret !== configuredSecret) {
    return {
      ok: false,
      message: 'Não autorizado',
    };
  }

  return { ok: true };
}
