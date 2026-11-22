import { invalid } from '../common/validation';

export function toMinorUnits(amount: number): number {
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor)) invalid('amount', 'Amount exceeds safe monetary precision');
  return minor;
}
