import { fromMinorUnits, isMonetaryAmount, toMinorUnits } from '../src/transactions/money';

describe('Exact monetary conversion', () => {
  it.each([
    [0.01, 1], [0.29, 29], [1.1, 110], [90_000_000_000_000, 9_000_000_000_000_000],
    [90071992547409.9, 9007199254740990],
  ])('converts %s to exactly %s cents and back', (amount, minor) => {
    expect(toMinorUnits(amount)).toBe(minor);
    expect(fromMinorUnits(minor)).toBe(amount);
  });

  it.each([1e-7, 1e-8, 0.001, 1.001, 0, -1, NaN, Infinity, -Infinity, 1e20, '1', null, undefined])(
    'rejects invalid amount %s without throwing from the predicate', amount => {
      expect(isMonetaryAmount(amount)).toBe(false);
    },
  );

  it.each([0, 1, -1, 29, -29, 9007199254740990, -9007199254740990])(
    'serializes signed balance %s without changing cents', minor => {
      const amount = fromMinorUnits(minor);
      if (minor === 0) expect(amount).toBe(0);
      else expect(toMinorUnits(Math.abs(amount))).toBe(Math.abs(minor));
    },
  );

  it.each([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, 1.1])(
    'rejects balance %s when cents cannot be preserved in a numeric response', minor => {
      expect(() => fromMinorUnits(minor)).toThrow('Bad Request');
    },
  );
});
