import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/lib/components/layout/Sidebar';
import { Topbar } from '@/lib/components/layout/Topbar';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Anderson Wealth Planner',
  description: 'Gestão financeira e controladoria',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={cn(inter.className, "min-h-screen bg-background")}>
        <Sidebar />
        <Topbar />
        <main className="ml-64 p-8 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </body>
    </html>
  );
}