/**
 * Tests: lib/money/currency-rounding (B17, extended by the HQ Currency Setup
 * handoff §3.4 — context-scoped resolution against sys_currency_rounding_rules_cf)
 *
 * Covers:
 * - roundToIncrement — all 7 modes, native and non-native increments, no-op guard
 * - resolveCurrencyRoundingRule — active row found, context fallback to
 *   ACCOUNTING, inactive/missing row, invalid increment, unknown mode falls
 *   back to HALF_UP
 */

const mockRuleFindFirst = jest.fn();
const mockCurrencyFindUnique = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_currency_rounding_rules_cf: { findFirst: (...a: unknown[]) => mockRuleFindFirst(...a) },
    sys_currency_cd: { findUnique: (...a: unknown[]) => mockCurrencyFindUnique(...a) },
  },
}));

import { roundToIncrement, resolveCurrencyRoundingRule } from '@/lib/money/currency-rounding';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';

describe('roundToIncrement', () => {
  it('rounds HALF_UP to the nearest 0.005 increment', () => {
    expect(roundToIncrement(12.343, 0.005, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(12.342, 0.005, CURRENCY_ROUNDING_MODES.HALF_UP)).toBeCloseTo(12.34, 4);
  });

  it('FLOOR always rounds toward -Infinity', () => {
    expect(roundToIncrement(12.349, 0.005, CURRENCY_ROUNDING_MODES.FLOOR)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(-12.341, 0.005, CURRENCY_ROUNDING_MODES.FLOOR)).toBeCloseTo(-12.345, 4);
  });

  it('CEILING always rounds toward +Infinity', () => {
    expect(roundToIncrement(12.341, 0.005, CURRENCY_ROUNDING_MODES.CEILING)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(-12.349, 0.005, CURRENCY_ROUNDING_MODES.CEILING)).toBeCloseTo(-12.345, 4);
  });

  it('UP always rounds away from zero, regardless of sign', () => {
    expect(roundToIncrement(12.341, 0.005, CURRENCY_ROUNDING_MODES.UP)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(-12.341, 0.005, CURRENCY_ROUNDING_MODES.UP)).toBeCloseTo(-12.345, 4);
  });

  it('DOWN always truncates toward zero, regardless of sign', () => {
    expect(roundToIncrement(12.349, 0.005, CURRENCY_ROUNDING_MODES.DOWN)).toBeCloseTo(12.345, 4);
    expect(roundToIncrement(-12.349, 0.005, CURRENCY_ROUNDING_MODES.DOWN)).toBeCloseTo(-12.345, 4);
  });

  it('HALF_DOWN rounds exact halves toward zero, not away', () => {
    // 12.3425 / 0.005 = 2468.5 exactly -> HALF_DOWN takes the lower step
    expect(roundToIncrement(12.3425, 0.005, CURRENCY_ROUNDING_MODES.HALF_DOWN)).toBeCloseTo(12.34, 4);
  });

  it('HALF_EVEN rounds exact halves to the nearest even step (banker\'s rounding)', () => {
    // 12.3475 / 0.005 = 2469.5 exactly, floor step 2469 is odd -> ties to the
    // even step above, 2470 -> 12.35
    expect(roundToIncrement(12.3475, 0.005, CURRENCY_ROUNDING_MODES.HALF_EVEN)).toBeCloseTo(12.35, 4);
    // 12.3425 / 0.005 = 2468.5 exactly, floor step 2468 is already even -> stays
    expect(roundToIncrement(12.3425, 0.005, CURRENCY_ROUNDING_MODES.HALF_EVEN)).toBeCloseTo(12.34, 4);
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

  it('returns the active ACCOUNTING rule for a configured currency (default context)', async () => {
    mockRuleFindFirst.mockResolvedValueOnce({
      currency_code: 'OMR',
      rounding_context: 'ACCOUNTING',
      rounding_mode: 'HALF_UP',
      rounding_increment_minor: 5,
      output_decimal_places: null,
      is_active: true,
      rec_status: 1,
    });
    mockCurrencyFindUnique.mockResolvedValueOnce({ minor_unit: 3 });

    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule).toEqual({ roundingMethod: 'HALF_UP', roundingUnit: 0.005 });
    expect(mockRuleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { currency_code: 'OMR', rounding_context: 'ACCOUNTING', is_active: true, rec_status: 1 },
      }),
    );
  });

  it('resolves a non-default context directly when a row exists for it', async () => {
    mockRuleFindFirst.mockResolvedValueOnce({
      currency_code: 'AED',
      rounding_context: 'CASH_TENDER',
      rounding_mode: 'HALF_UP',
      rounding_increment_minor: 25,
      output_decimal_places: null,
      is_active: true,
      rec_status: 1,
    });
    mockCurrencyFindUnique.mockResolvedValueOnce({ minor_unit: 2 });

    const rule = await resolveCurrencyRoundingRule('AED', 'CASH_TENDER');
    expect(rule).toEqual({ roundingMethod: 'HALF_UP', roundingUnit: 0.25 });
    expect(mockCurrencyFindUnique).toHaveBeenCalled();
  });

  it('falls back to ACCOUNTING when the requested context has no row', async () => {
    mockRuleFindFirst
      .mockResolvedValueOnce(null) // CASH_TENDER lookup — absent
      .mockResolvedValueOnce({
        currency_code: 'XYZ',
        rounding_context: 'ACCOUNTING',
        rounding_mode: 'HALF_UP',
        rounding_increment_minor: 1,
        output_decimal_places: null,
        is_active: true,
        rec_status: 1,
      });
    mockCurrencyFindUnique.mockResolvedValueOnce({ minor_unit: 2 });

    const rule = await resolveCurrencyRoundingRule('XYZ', 'CASH_TENDER');
    expect(rule).toEqual({ roundingMethod: 'HALF_UP', roundingUnit: 0.01 });
    expect(mockRuleFindFirst).toHaveBeenCalledTimes(2);
  });

  it('returns null when no rule resolves at all — never assumes a rounding behavior', async () => {
    mockRuleFindFirst.mockResolvedValue(null);
    const rule = await resolveCurrencyRoundingRule('ZZZ');
    expect(rule).toBeNull();
  });

  it('returns null when rounding_increment_minor is absent', async () => {
    mockRuleFindFirst.mockResolvedValueOnce({
      currency_code: 'OMR',
      rounding_context: 'ACCOUNTING',
      rounding_mode: 'HALF_UP',
      rounding_increment_minor: null,
      output_decimal_places: null,
      is_active: true,
      rec_status: 1,
    });
    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule).toBeNull();
  });

  it('falls back to HALF_UP when the stored rounding_mode is not a recognized mode', async () => {
    mockRuleFindFirst.mockResolvedValueOnce({
      currency_code: 'OMR',
      rounding_context: 'ACCOUNTING',
      rounding_mode: 'SOMETHING_UNKNOWN',
      rounding_increment_minor: 5,
      output_decimal_places: null,
      is_active: true,
      rec_status: 1,
    });
    mockCurrencyFindUnique.mockResolvedValueOnce({ minor_unit: 3 });

    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule?.roundingMethod).toBe('HALF_UP');
  });
});
