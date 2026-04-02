import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role?: string;
    investorId?: string | null;
    investorName?: string | null;
    firstLogin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      investorId: string | null;
      investorName: string | null;
      firstLogin: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    investorId?: string | null;
    investorName?: string | null;
    firstLogin?: boolean;
  }
}
