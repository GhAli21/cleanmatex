/**
 * W0-16 (POS Session & Cash Drawer Hardening) — `varianceToleranceFor`, the
 * currency-aware replacement for the flat `CASH_VARIANCE_TOLERANCE`. The
 * flat 0.01 is wrong for 3-decimal currencies (OMR/BHD/KWD): their smallest
 * circulating unit is 0.001, so a correct tolerance is 0.0005, not 0.01 (20x
 * too wide — real variance up to 0.0099 would be silently accepted).
 */
import { CASH_VARIANCE_TOLERANCE, varianceToleranceFor } from '@/lib/constants/financial-tolerances';

describe('varianceToleranceFor', () => {
  it('returns 0.0005 for OMR (3 decimal places)', () => {
    expect(varianceToleranceFor(3)).toBe(0.0005);
  });

  it('returns 0.005 for AED (2 decimal places)', () => {
    expect(varianceToleranceFor(2)).toBe(0.005);
  });

  it('returns 0.5 for a zero-decimal currency', () => {
    expect(varianceToleranceFor(0)).toBe(0.5);
  });

  it('is half the flat legacy tolerance at 2dp, confirming the flat constant matches the 2dp case', () => {
    expect(varianceToleranceFor(2) * 2).toBe(CASH_VARIANCE_TOLERANCE);
  });

  it('is 20x tighter than the flat legacy tolerance at 3dp — the bug this replaces', () => {
    expect(CASH_VARIANCE_TOLERANCE / varianceToleranceFor(3)).toBe(20);
  });

  it('falls back to 2dp behavior for invalid input rather than throwing', () => {
    expect(varianceToleranceFor(Number.NaN)).toBe(varianceToleranceFor(2));
    expect(varianceToleranceFor(-1)).toBe(varianceToleranceFor(2));
  });

  it('floors a fractional decimalPlaces input', () => {
    expect(varianceToleranceFor(3.9)).toBe(varianceToleranceFor(3));
  });
});
