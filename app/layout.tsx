import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/lib/components/layout/Sidebar';
import { Topbar } from '@/lib/components/layout/Topbar';
import { cn } from '@/lib/utils';

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
      <body className={cn(
        inter.className, 
        inter.variable,
        "min-h-screen bg-background antialiased"
      )}>
        <Sidebar />
        <Topbar />
        {/* Main content area - offset by sidebar (ml-64) and header (pt-16 = 64px) */}
        <main className="ml-64 pt-16 p-6 lg:p-8 min-h-screen relative z-0">
          <div className="max-w-7xl mx-auto animate-in">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}