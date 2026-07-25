/**
 * Tests: lib/money/currency-rounding (B17)
 *
 * Covers:
 * - roundToIncrement — all 4 modes, native and non-native increments, no-op guard
 * - resolveCurrencyRoundingRule — active row found, inactive/missing row, invalid rounding_unit, unknown method falls back to HALF_UP
 */

const mockFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_currency_rounding_rules_cd: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
  },
}));

import { roundToIncrement, resolveCurrencyRoundingRule } from '@/lib/money/currency-rounding';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';

describe('roundToIncrement', () => {
  it('rounds HALF_UP to the nearest 0.005 increment', () => {
    expect(roundToIncrement(12.343, 0.005, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(12.342, 0.005, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(12.34, 4);
  });

  it('FLOOR always rounds down to the increment', () => {
    expect(roundToIncrement(12.349, 0.005, CURRENCY_ROUNDING_MODES.FLOOR)).toBeCloseTo(12.345, 4);
  });

  it('CEIL always rounds up to the increment', () => {
    expect(roundToIncrement(12.341, 0.005, CURRENCY_ROUNDING_MODES.CEIL)).toBeCloseTo(12.345, 4);
  });

  it('HALF_DOWN rounds exact halves down, not up', () => {
    // 12.3425 / 0.005 = 2468.5 exactly -> HALF_DOWN takes the lower step
    expect(roundToIncrement(12.3425, 0.005, CURRENCY_ROUNDING_MODES.HALF_DOWN)).toBeCloseTo(12.34, 4);
  });

  it('is a no-op at the native increment (0.01 for a 2dp currency, HALF_UP) — matches plain toFixed(2)', () => {
    expect(roundToIncrement(19.995, 0.01, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(20.0, 4);
    expect(roundToIncrement(19.994, 0.01, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(19.99, 4);
  });

  it('is a no-op at the native 3dp increment (0.001, HALF_UP) — matches the seeded OMR row', () => {
    expect(roundToIncrement(12.3455, 0.001, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(12.346, 4);
  });

  it('never invents a rounding behavior when increment is zero, negative, or non-finite', () => {
    expect(roundToIncrement(12.343, 0, CURRENCY_ROUNDING_MODES.HALF_UP)).toBe(12.343);
    expect(roundToIncrement(12.343, -0.005, CURRENCY_ROUNDING_MODES.HALF_UP)).toBe(12.343);
    expect(roundToIncrement(12.343, NaN, CURRENCY_ROUNDING_MODES.HALF_UP)).toBe(12.343);
  });
});

describe('resolveCurrencyRoundingRule', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the active rule for a configured currency', async () => {
    mockFindFirst.mockResolvedValue({
      currency_code: 'OMR',
      rounding_method: 'HALF_UP',
      rounding_unit: 0.005,
      is_active: true,
      rec_status: 1,
    });

    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule).toEqual({ roundingMethod: 'HALF_UP', roundingUnit: 0.005 });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { currency_code: 'OMR', is_active: true, rec_status: 1 },
    });
  });

  it('returns null when no active rule row exists — never assumes a rounding behavior', async () => {
    mockFindFirst.mockResolvedValue(null);
    const rule = await resolveCurrencyRoundingRule('XYZ');
    expect(rule).toBeNull();
  });

  it('returns null when rounding_unit is not a usable positive number', async () => {
    mockFindFirst.mockResolvedValue({
      currency_code: 'OMR',
      rounding_method: 'HALF_UP',
      rounding_unit: 0,
      is_active: true,
      rec_status: 1,
    });
    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule).toBeNull();
  });

  it('falls back to HALF_UP when the stored rounding_method is not a recognized mode', async () => {
    mockFindFirst.mockResolvedValue({
      currency_code: 'OMR',
      rounding_method: 'SOMETHING_UNKNOWN',
      rounding_unit: 0.005,
      is_active: true,
      rec_status: 1,
    });
    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule?.roundingMethod).toBe('HALF_UP');
  });
});
