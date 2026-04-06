import { hasValidProvisionalPassword, isValidUserEmail, normalizeUserEmail } from '@/lib/admin/userValidation';

describe('userValidation', () => {
  it('normalizes email to lowercase and trims spaces', () => {
    expect(normalizeUserEmail('  Teste@Email.COM  ')).toBe('teste@email.com');
  });

  it('accepts valid emails and rejects invalid ones', () => {
    expect(isValidUserEmail('user@example.com')).toBe(true);
    expect(isValidUserEmail('user+investidor@example.com')).toBe(true);
    expect(isValidUserEmail('email-invalido')).toBe(false);
    expect(isValidUserEmail('user@')).toBe(false);
  });

  it('validates provisional password length after trimming', () => {
    expect(hasValidProvisionalPassword('123456')).toBe(true);
    expect(hasValidProvisionalPassword('  123456  ')).toBe(true);
    expect(hasValidProvisionalPassword('12345')).toBe(false);
  });
});
