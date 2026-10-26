const unitMs = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function parseDurationMs(value: string) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof unitMs;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return null;
  }

  return amount * unitMs[unit];
}
