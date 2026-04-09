import {
  buildPortalOnboardingStorageKey,
  portalOnboardingSteps,
  resolvePortalOnboardingUserKey,
} from '@/lib/portalOnboarding';

describe('portal onboarding', () => {
  it('builds a stable storage key per investor', () => {
    expect(buildPortalOnboardingStorageKey('investor_123')).toBe(
      'clikfinance:portal-onboarding:v1:investor_123',
    );
  });

  it('prefers investorId when resolving the user key', () => {
    expect(
      resolvePortalOnboardingUserKey({
        investorId: 'inv_1',
        email: 'investidor@clikfinance.com',
        name: 'Investidor',
      }),
    ).toBe('inv_1');
  });

  it('keeps the guided tour concise', () => {
    expect(portalOnboardingSteps).toHaveLength(5);
    expect(portalOnboardingSteps.map((step) => step.id)).toEqual([
      'overview',
      'global-filter',
      'fleet',
      'financial',
      'report',
    ]);
  });
});
