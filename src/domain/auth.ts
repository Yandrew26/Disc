export const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, lowercase letter, number, and symbol.";

export function isStrongPassword(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}
