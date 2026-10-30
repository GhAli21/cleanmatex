/**
 * P4-01 — commercial calculator primitives: exact examples + property tests.
 * The examples pin the float→decimal cases characterized in P1-01 (FD-01..FD-03).
 */
import fc from 'fast-check';
import {
  ROUNDING_MODES,
  allocateLargestRemainder,
  allocateMatrix,
  isRoundingMode,
  roundMoney,
  sumMoney,
  toMoney,
  toStorageString,
  type RoundingMode,
} from '@/lib/commercial';

const str = (values: { toString(): string }[]) => values.map((v) => v.toString());

describe('money', () => {
  it('is exact where floats drift (FD-03: 0.4 + 0.8)', () => {
    expect(sumMoney(['0.4', '0.8']).toString()).toBe('1.2');
    expect(0.4 + 0.8).not.toBe(1.2);
  });

  it('rejects non-finite input', () => {
    expect(() => toMoney(Number.NaN)).toThrow();
    expect(() => toMoney(Infinity)).toThrow();
  });

  it('formats for DECIMAL(19,4) storage and refuses to drop digits', () => {
    expect(toStorageString('1.2')).toBe('1.2000');
    expect(() => toStorageString('3.33335')).toThrow(/round it before storing/);
  });
});

describe('roundMoney', () => {
  const at3 = (mode: RoundingMode) => ({ decimalPlaces: 3, mode });

  it('FD-01: a true half rounds up under HALF_UP (float gave 3.333)', () => {
    expect(roundMoney('3.3335', at3('HALF_UP')).toString()).toBe('3.334');
  });

  it.each([
    ['UP', '1.0001', '1.001'],
    ['UP', '-1.0001', '-1.001'],
    ['DOWN', '1.0009', '1'],
    ['DOWN', '-1.0009', '-1'],
    ['CEILING', '-1.0009', '-1'],
    ['CEILING', '1.0001', '1.001'],
    ['FLOOR', '1.0009', '1'],
    ['FLOOR', '-1.0001', '-1.001'],
    ['HALF_UP', '-2.5005', '-2.501'],
    ['HALF_DOWN', '2.5005', '2.5'],
    ['HALF_EVEN', '2.5005', '2.5'],
    ['HALF_EVEN', '2.5015', '2.502'],
  ] as const)('%s rounds %s to %s', (mode, input, expected) => {
    expect(roundMoney(input, at3(mode)).toString()).toBe(expected);
  });

  it('applies a coin increment (0.05 at 2 decimals)', () => {
    const rule = { decimalPlaces: 2, mode: 'HALF_UP' as const, incrementMinor: 5 };
    expect(roundMoney('11.49', rule).toString()).toBe('11.5');
    expect(roundMoney('11.47', rule).toString()).toBe('11.45');
    expect(roundMoney('11.475', rule).toString()).toBe('11.5');
  });

  it('rejects invalid rules', () => {
    expect(() => roundMoney('1', { decimalPlaces: -1, mode: 'HALF_UP' })).toThrow();
    expect(() => roundMoney('1', { decimalPlaces: 2, mode: 'HALF_UP', incrementMinor: 0 })).toThrow();
  });

  it('mirrors the 7 sys_rounding_mode_cd codes', () => {
    expect(Object.values(ROUNDING_MODES).sort()).toEqual(
      ['CEILING', 'DOWN', 'FLOOR', 'HALF_DOWN', 'HALF_EVEN', 'HALF_UP', 'UP'],
    );
    expect(isRoundingMode('HALF_UP')).toBe(true);
    expect(isRoundingMode('half_up')).toBe(false);
  });

  // ── properties ─────────────────────────────────────────────────────────────
  const amount = fc.integer({ min: -10_000_000_000, max: 10_000_000_000 }).map((n) => toMoney(n).dividedBy(1_000_000));
  const mode = fc.constantFrom(...Object.values(ROUNDING_MODES));
  const dp = fc.integer({ min: 0, max: 4 });

  it('property: result has at most the requested decimals and moves by less than one unit', () => {
    fc.assert(fc.property(amount, mode, dp, (value, m, d) => {
      const rounded = roundMoney(value, { decimalPlaces: d, mode: m });
      expect(rounded.decimalPlaces()).toBeLessThanOrEqual(d);
      expect(rounded.minus(value).abs().lessThan(toMoney(10).pow(-d))).toBe(true);
    }));
  });

  it('property: idempotent (rounding a rounded value changes nothing)', () => {
    fc.assert(fc.property(amount, mode, dp, (value, m, d) => {
      const once = roundMoney(value, { decimalPlaces: d, mode: m });
      expect(roundMoney(once, { decimalPlaces: d, mode: m }).equals(once)).toBe(true);
    }));
  });

  it('property: increment results are multiples of the step', () => {
    fc.assert(fc.property(amount, mode, fc.integer({ min: 1, max: 100 }), (value, m, inc) => {
      const rounded = roundMoney(value, { decimalPlaces: 2, mode: m, incrementMinor: inc });
      expect(rounded.times(100).modulo(inc).isZero()).toBe(true);
    }));
  });
});

describe('allocateLargestRemainder', () => {
  it('FD-02: 10 over 3 pieces sums to exactly 10 (was 9.9999)', () => {
    const shares = allocateLargestRemainder('10', ['1', '1', '1'], 4);
    expect(str(shares)).toEqual(['3.3334', '3.3333', '3.3333']);
    expect(sumMoney(shares).toString()).toBe('10');
  });

  it('gives leftover units to the largest remainders, ties to the earlier row', () => {
    expect(str(allocateLargestRemainder('1', ['2', '1'], 2))).toEqual(['0.67', '0.33']);
    expect(str(allocateLargestRemainder('0.02', ['1', '1', '1'], 2))).toEqual(['0.01', '0.01', '0']);
  });

  it('splits equally when all weights are zero, and handles negative totals', () => {
    expect(str(allocateLargestRemainder('1', ['0', '0'], 3))).toEqual(['0.5', '0.5']);
    const negative = allocateLargestRemainder('-10', ['1', '1', '1'], 4);
    expect(str(negative)).toEqual(['-3.3334', '-3.3333', '-3.3333']);
  });

  it('rejects invalid input', () => {
    expect(() => allocateLargestRemainder('1', [], 2)).toThrow();
    expect(() => allocateLargestRemainder('1', ['-1', '2'], 2)).toThrow();
    expect(() => allocateLargestRemainder('1.005', ['1'], 2)).toThrow();
  });

  // ── properties ─────────────────────────────────────────────────────────────
  const dp = fc.integer({ min: 0, max: 4 });
  const input = dp.chain((d) => fc.tuple(
    fc.constant(d),
    fc.integer({ min: -100_000_000, max: 100_000_000 }).map((n) => toMoney(n).dividedBy(toMoney(10).pow(d))),
    fc.array(fc.integer({ min: 0, max: 1_000_000 }).map((n) => toMoney(n).dividedBy(1000)), { minLength: 1, maxLength: 12 }),
  ));

  it('property (I1): shares always sum to the total exactly, at the output precision', () => {
    fc.assert(fc.property(input, ([d, total, weights]) => {
      const shares = allocateLargestRemainder(total, weights, d);
      expect(shares).toHaveLength(weights.length);
      expect(sumMoney(shares).equals(total)).toBe(true);
      shares.forEach((share) => expect(share.decimalPlaces()).toBeLessThanOrEqual(d));
    }));
  });

  it('property: each share is within one unit of its exact proportion', () => {
    fc.assert(fc.property(input, ([d, total, weights]) => {
      const shares = allocateLargestRemainder(total, weights, d);
      const sum = sumMoney(weights);
      const unit = toMoney(10).pow(-d);
      shares.forEach((share, i) => {
        const exact = sum.isZero()
          ? total.dividedBy(weights.length)
          : total.times(weights[i]).dividedBy(sum);
        expect(share.minus(exact).abs().lessThan(unit)).toBe(true);
      });
    }));
  });

  it('property: deterministic (same input, same output)', () => {
    fc.assert(fc.property(input, ([d, total, weights]) => {
      expect(str(allocateLargestRemainder(total, weights, d)))
        .toEqual(str(allocateLargestRemainder(total, weights, d)));
    }));
  });
});

describe('allocateMatrix', () => {
  const grid = (rows: string[], cols: string[], dp = 3) => allocateMatrix(rows, cols, dp).map((r) => r.map(String));

  it('splits exactly when shares are whole', () => {
    expect(grid(['0.6', '0.4'], ['0.7', '0.3'])).toEqual([['0.42', '0.18'], ['0.28', '0.12']]);
  });

  it('keeps both margins where row-by-row splitting misses a column', () => {
    // Three discounts of 0.001 over three equal categories: one unit per row and per column.
    const cells = allocateMatrix(['0.001', '0.001', '0.001'], ['0.001', '0.001', '0.001'], 3);
    expect(cells.map((r) => sumMoney(r).toString())).toEqual(['0.001', '0.001', '0.001']);
    expect([0, 1, 2].map((j) => sumMoney(cells.map((r) => r[j])).toString())).toEqual(['0.001', '0.001', '0.001']);
  });

  it('rejects unequal sums', () => {
    expect(() => allocateMatrix(['1'], ['0.9'], 3)).toThrow(/differ/);
  });

  it('property: every row and column adds up, every cell within one unit of exact', () => {
    const units = fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 4 });
    fc.assert(fc.property(units, units, (rowUnits, colSeed) => {
      const total = rowUnits.reduce((a, b) => a + b, 0);
      // Columns: split the same total by the seed weights.
      const cols = allocateLargestRemainder(toMoney(total).dividedBy(1000), colSeed.map((w) => w + 1), 3);
      const rows = rowUnits.map((u) => toMoney(u).dividedBy(1000));
      const cells = allocateMatrix(rows, cols, 3);
      cells.forEach((r, i) => expect(sumMoney(r).equals(rows[i])).toBe(true));
      cols.forEach((c, j) => expect(sumMoney(cells.map((r) => r[j])).equals(c)).toBe(true));
      const t = sumMoney(rows);
      cells.forEach((r, i) => r.forEach((cell, j) => {
        if (t.isZero()) return;
        expect(cell.minus(rows[i].times(cols[j]).dividedBy(t)).abs().lessThan('0.001')).toBe(true);
      }));
    }), { numRuns: 300 });
  });
});
