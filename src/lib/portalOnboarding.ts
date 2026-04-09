export type PortalOnboardingStatus = 'dismissed' | 'skipped' | 'completed' | 'hidden';

export type PortalOnboardingStep = {
  id: string;
  targetId: string;
  title: string;
  description: string;
  placement?: 'right' | 'left' | 'bottom' | 'top' | 'center';
};

export type PortalOnboardingState = {
  status: PortalOnboardingStatus;
  updatedAt: string;
};

const PORTAL_ONBOARDING_STORAGE_VERSION = 'v1';

export const portalOnboardingSteps: PortalOnboardingStep[] = [
  {
    id: 'overview',
    targetId: 'nav-overview',
    title: 'Visão Geral',
    description: 'Comece por aqui para bater o olho nos principais números da carteira e entender o momento da operação.',
    placement: 'right',
  },
  {
    id: 'global-filter',
    targetId: 'global-filter',
    title: 'Período global',
    description: 'Use o período no topo para atualizar todas as páginas do portal com o mesmo recorte.',
    placement: 'bottom',
  },
  {
    id: 'fleet',
    targetId: 'nav-fleet',
    title: 'Frota / Operações',
    description: 'Na frota você acompanha veículos, status, locatário exibido e detalhes por placa.',
    placement: 'right',
  },
  {
    id: 'financial',
    targetId: 'nav-financial',
    title: 'Receitas, despesas e multas',
    description: 'As áreas financeiras mostram como o período impactou a operação da sua carteira.',
    placement: 'right',
  },
  {
    id: 'report',
    targetId: 'report-action',
    title: 'Relatório consolidado',
    description: 'Quando precisar compartilhar ou revisar o consolidado do período, gere o relatório em um clique.',
    placement: 'bottom',
  },
];

export function buildPortalOnboardingStorageKey(userKey: string) {
  return `clikfinance:portal-onboarding:${PORTAL_ONBOARDING_STORAGE_VERSION}:${userKey}`;
}

export function resolvePortalOnboardingUserKey(options: {
  investorId?: string | null;
  email?: string | null;
  name?: string | null;
}) {
  return options.investorId || options.email || options.name || 'investor';
}
