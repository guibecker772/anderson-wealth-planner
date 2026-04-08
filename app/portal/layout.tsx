import { PortalShell } from '@/components/portal/PortalShell';
import { PortalDateRangeProvider } from '@/components/portal/PortalDateRangeContext';

export const metadata = {
  title: 'Portal do Investidor',
};

export const dynamic = 'force-dynamic';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalDateRangeProvider>
      <PortalShell>{children}</PortalShell>
    </PortalDateRangeProvider>
  );
}
