import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/lib/components/layout/Sidebar';
import { Topbar } from '@/lib/components/layout/Topbar';
import { DateRangeProvider } from '@/lib/components/DateRangeContext';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

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
        <Suspense>
          <DateRangeProvider>
            <div className="relative min-h-screen overflow-hidden">
              <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(168,207,76,0.12),transparent_20%),radial-gradient(circle_at_top_right,rgba(2,45,68,0.08),transparent_18%)]" />
              <Sidebar />
              <Topbar />
              <main className="relative z-10 ml-72 min-h-screen px-6 pb-10 pt-28 xl:px-10">
                <div className="mx-auto max-w-[1480px] animate-in">
                  {children}
                </div>
              </main>
            </div>
          </DateRangeProvider>
        </Suspense>
      </body>
    </html>
  );
}
