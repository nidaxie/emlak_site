export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function blankToNull(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
