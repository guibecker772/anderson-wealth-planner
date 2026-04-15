import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const user = await db.user.findUnique({
          where: { email },
          include: { investor: true },
        });

        // Extract IP/UA from the raw request for auditing
        const ip = req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim()
          || req?.headers?.['x-real-ip']?.toString()
          || null;
        const userAgent = req?.headers?.['user-agent']?.toString().slice(0, 256) || null;

        if (!user || !user.active) {
          // Audit failed login attempt
          audit({
            action: 'LOGIN_FAILED',
            actorRole: user?.role || null,
            metadata: { email, reason: !user ? 'user_not_found' : 'inactive' },
            ip,
            userAgent,
          });
          return null;
        }

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) {
          audit({
            action: 'LOGIN_FAILED',
            actorUserId: user.id,
            actorRole: user.role,
            metadata: { email, reason: 'invalid_password' },
            ip,
            userAgent,
          });
          return null;
        }

        // Audit successful login
        audit({
          action: 'LOGIN_SUCCESS',
          actorUserId: user.id,
          actorRole: user.role,
          targetInvestorId: user.investorId,
          ip,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          investorId: user.investorId,
          investorName: user.investor?.displayName ?? null,
          firstLogin: user.firstLogin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.investorId = user.investorId;
        token.investorName = user.investorName;
        token.firstLogin = user.firstLogin;
      }
      // Allow session update to refresh firstLogin flag
      if (trigger === 'update') {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub! },
          select: { firstLogin: true },
        });
        if (dbUser) {
          token.firstLogin = dbUser.firstLogin;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role ?? 'INVESTOR';
        session.user.investorId = token.investorId ?? null;
        session.user.investorName = token.investorName ?? null;
        session.user.firstLogin = token.firstLogin ?? false;
      }
      return session;
    },
  },
};
