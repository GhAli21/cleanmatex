/**
 * Tests: cash-rounding — change-only cash rounding arithmetic (A6-1b)
 *
 * Covers: all 7 modes on the increment grid, bearer→mode mapping, OMR 5-baisa
 * scenario, "never more than tendered", no-op cases (no increment, increment 1,
 * already on the grid, zero change), sign convention of `adjustment`.
 */
import {
  CHANGE_BEARER_ROUNDING_MODE,
  computeCashChangeRounding,
  roundMinorToIncrement,
} from '@/lib/money/cash-rounding';

describe('roundMinorToIncrement', () => {
  // 2997 minor units on a 5-minor grid: remainder 2 → below half.
  it.each([
    ['FLOOR', 2997, 5, 2995],
    ['DOWN', 2997, 5, 2995],
    ['CEILING', 2997, 5, 3000],
    ['UP', 2997, 5, 3000],
    ['HALF_UP', 2997, 5, 2995],
    ['HALF_UP', 2998, 5, 3000],
    ['HALF_DOWN', 2998, 5, 3000],
    ['HALF_UP', 25, 10, 30],
    ['HALF_DOWN', 25, 10, 20],
    ['HALF_EVEN', 25, 10, 20],
    ['HALF_EVEN', 35, 10, 40],
  ] as const)('%s %i/%i → %i', (mode, value, inc, expected) => {
    expect(roundMinorToIncrement(value, inc, mode)).toBe(expected);
  });

  it('keeps a value already on the grid', () => {
    expect(roundMinorToIncrement(3000, 5, 'CEILING')).toBe(3000);
    expect(roundMinorToIncrement(0, 5, 'CEILING')).toBe(0);
  });

  it('is a no-op for a bad increment or a negative value', () => {
    expect(roundMinorToIncrement(2997, 0, 'CEILING')).toBe(2997);
    expect(roundMinorToIncrement(2997, -5, 'CEILING')).toBe(2997);
    expect(roundMinorToIncrement(2997, 2.5, 'CEILING')).toBe(2997);
    expect(roundMinorToIncrement(-12, 5, 'CEILING')).toBe(-12);
  });
});

describe('CHANGE_BEARER_ROUNDING_MODE', () => {
  it('maps D16 bearers to rounding modes', () => {
    expect(CHANGE_BEARER_ROUNDING_MODE.BUSINESS).toBe('CEILING');
    expect(CHANGE_BEARER_ROUNDING_MODE.CUSTOMER).toBe('FLOOR');
    expect(CHANGE_BEARER_ROUNDING_MODE.NEAREST).toBe('HALF_UP');
  });
});

describe('computeCashChangeRounding (OMR, 3dp, 5-baisa grid)', () => {
  const base = { decimalPlaces: 3, incrementMinor: 5 };

  it('BUSINESS rounds change up: drawer holds less → negative adjustment (loss)', () => {
    const r = computeCashChangeRounding({ ...base, exactChange: 2.997, mode: 'CEILING' });
    expect(r.roundedChange).toBe(3);
    expect(r.adjustment).toBeCloseTo(-0.003, 6);
  });

  it('CUSTOMER rounds change down: drawer holds more → positive adjustment (gain)', () => {
    const r = computeCashChangeRounding({ ...base, exactChange: 2.997, mode: 'FLOOR' });
    expect(r.roundedChange).toBe(2.995);
    expect(r.adjustment).toBeCloseTo(0.002, 6);
  });

  it('never hands out more than was tendered', () => {
    // Change 4.998 would round up to 5.000, but only 4.999 was tendered.
    const r = computeCashChangeRounding({ ...base, exactChange: 4.998, maxChange: 4.999, mode: 'CEILING' });
    expect(r.roundedChange).toBe(4.995);
    expect(r.adjustment).toBeCloseTo(0.003, 6);
  });

  it('is a no-op when the change already sits on the grid', () => {
    const r = computeCashChangeRounding({ ...base, exactChange: 3, mode: 'CEILING' });
    expect(r).toEqual({ exactChange: 3, roundedChange: 3, adjustment: 0 });
  });

  it.each([
    ['no increment', { incrementMinor: null }],
    ['increment of one minor unit', { incrementMinor: 1 }],
    ['non-integer increment', { incrementMinor: 2.5 }],
  ])('is a no-op with %s', (_name, override) => {
    const r = computeCashChangeRounding({ ...base, ...override, exactChange: 2.997, mode: 'CEILING' });
    expect(r.adjustment).toBe(0);
    expect(r.roundedChange).toBe(2.997);
  });

  it('is a no-op for zero or negative change', () => {
    expect(computeCashChangeRounding({ ...base, exactChange: 0, mode: 'CEILING' }).adjustment).toBe(0);
    expect(computeCashChangeRounding({ ...base, exactChange: -1, mode: 'CEILING' }).adjustment).toBe(0);
  });

  it('works on a 2dp currency with a 5-cent grid (no float drift)', () => {
    const r = computeCashChangeRounding({ decimalPlaces: 2, incrementMinor: 5, exactChange: 0.07, mode: 'HALF_UP' });
    expect(r.roundedChange).toBe(0.05);
    expect(r.adjustment).toBeCloseTo(0.02, 6);
  });
});
