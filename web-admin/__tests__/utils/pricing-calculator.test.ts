import { calculateDiscountPercent, calculateItemPrice, calculateOrderTotal } from '@/lib/utils/pricing-calculator';

describe('pricing-calculator', () => {
  it('calculates item price with express and tax', () => {
    const r = calculateItemPrice({
      basePrice: 1.5,
      quantity: 4,
      isExpress: true,
      expressMultiplier: 1.5,
      taxRate: 0.05,
    });
    expect(r.unitPrice).toBeCloseTo(2.25, 3);
    expect(r.total).toBeGreaterThan(0);
  });

  it('aggregates order totals across items', () => {
    const a = calculateItemPrice({
      basePrice: 1,
      quantity: 2,
      isExpress: false,
      expressMultiplier: 1.5,
      taxRate: 0.05,
    });
    const b = calculateItemPrice({
      basePrice: 3,
      quantity: 1,
      isExpress: false,
      expressMultiplier: 1.5,
      taxRate: 0.05,
    });
    const t = calculateOrderTotal({ items: [a, b] });
    expect(t.total).toBeCloseTo(a.total + b.total, 3);
    expect(t.totalItems).toBe(2);
  });

  it('respects decimalPlaces for money rounding', () => {
    const r3 = calculateItemPrice({
      basePrice: 10,
      quantity: 1,
      isExpress: false,
      expressMultiplier: 1,
      taxRate: 0.055,
      decimalPlaces: 3,
    });
    expect(r3.tax).toBe(0.55);

    const r2 = calculateItemPrice({
      basePrice: 10,
      quantity: 1,
      isExpress: false,
      expressMultiplier: 1,
      taxRate: 0.055,
      decimalPlaces: 2,
    });
    expect(r2.tax).toBe(0.55);
  });

  it('rounds discount percent ratios to 4 dp (not currency fractions)', () => {
    expect(calculateDiscountPercent(100, 90.3333)).toBeCloseTo(9.6667, 4);
  });
});
