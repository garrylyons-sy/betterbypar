export type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: "length", label: "At least 8 characters", valid: password.length >= 8 },
    { id: "uppercase", label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { id: "lowercase", label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { id: "number", label: "One number", valid: /[0-9]/.test(password) },
    { id: "symbol", label: "One symbol", valid: /[^A-Za-z0-9]/.test(password) }
  ];
}

export function passwordValidationError(password: string) {
  const failed = passwordRules(password).find((rule) => !rule.valid);
  return failed ? `Password must include: ${failed.label.toLowerCase()}.` : "";
}

export function isValidPassword(password: string) {
  return !passwordValidationError(password);
}
