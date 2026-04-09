import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Investor users can only access /portal/** and /api/portal/**
    if (token?.role === 'INVESTOR') {
      const allowed =
        pathname === '/' ||
        pathname.startsWith('/portal') ||
        pathname.startsWith('/api/portal') ||
        pathname.startsWith('/api/auth');

      if (!allowed) {
        return NextResponse.redirect(new URL('/portal', req.url));
      }

      // Force first-login password change
      if (token.firstLogin) {
        const forceChangePath = '/portal/trocar-senha';
        const isChangePasswordRoute =
          pathname === forceChangePath ||
          pathname.startsWith('/api/portal/change-password') ||
          pathname.startsWith('/api/portal/me') ||
          pathname.startsWith('/api/auth');

        if (!isChangePasswordRoute) {
          return NextResponse.redirect(new URL(forceChangePath, req.url));
        }
      }
    }

    // Admin users should not need restrictions — they access everything
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (auth page)
     * - /api/auth (NextAuth endpoints)
     * - /api/health (health check)
     * - /_next (Next.js internals)
     * - /brand, /favicon (static assets)
     */
    '/((?!login|api/auth|api/health|_next|brand|favicon|vehicles).*)',
  ],
};
