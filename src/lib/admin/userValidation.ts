const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidUserEmail(email: string): boolean {
  return EMAIL_REGEX.test(normalizeUserEmail(email));
}

export function hasValidProvisionalPassword(password: string): boolean {
  return password.trim().length >= 6;
}
