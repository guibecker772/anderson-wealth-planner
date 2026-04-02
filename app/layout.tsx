import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'ClikFinance - Gestão Financeira',
    template: '%s | ClikFinance',
  },
  description: 'Gestão financeira e controladoria empresarial. Controle receitas, despesas e fluxo de caixa.',
  keywords: ['gestão financeira', 'controladoria', 'fluxo de caixa', 'contas a pagar', 'contas a receber'],
  authors: [{ name: 'ClikFinance' }],
  icons: {
    icon: '/brand/clikfinance-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#022D44',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable} min-h-screen bg-background antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
