import { isCashPayableAmount } from '@/lib/money/cash-rounding';

describe('isCashPayableAmount', () => {
  it('rejects an amount below the smallest coin step', () => {
    expect(isCashPayableAmount(17.532, 3, 5)).toBe(false);
  });
  it('accepts amounts on the coin step, including float-noisy ones', () => {
    expect(isCashPayableAmount(17.535, 3, 5)).toBe(true);
    expect(isCashPayableAmount(17.5, 3, 5)).toBe(true);
    expect(isCashPayableAmount(0.1 + 0.2, 2, 5)).toBe(true);
  });
  it('accepts everything without an increment', () => {
    expect(isCashPayableAmount(17.532, 3, null)).toBe(true);
  });
});
