import { invalid } from '../common/validation';

const MAX_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

function parseMinorUnits(amount: unknown): bigint | undefined {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return undefined;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) return undefined;
  const minor = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -minor : minor;
}

export function isMonetaryAmount(amount: unknown): boolean {
  const minor = parseMinorUnits(amount);
  return minor !== undefined && minor > 0n && minor <= MAX_MINOR_UNITS;
}

export function toMinorUnits(amount: number): number {
  if (!isMonetaryAmount(amount)) {
    invalid('amount', 'Amount must be a positive number with at most two decimal places within safe monetary precision');
  }
  return Number(parseMinorUnits(amount));
}

export function fromMinorUnits(minor: number): number {
  if (!Number.isSafeInteger(minor)) invalid('amount', 'Resulting balance exceeds safe monetary precision');
  const absolute = BigInt(minor < 0 ? -minor : minor);
  const amount = Number(`${minor < 0 ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`);
  if (parseMinorUnits(amount) !== BigInt(minor)) {
    invalid('amount', 'Resulting balance exceeds safe monetary precision');
  }
  return amount;
}
