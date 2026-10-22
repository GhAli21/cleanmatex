import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateOrderChangeTotals, digestOrderChangeCalculationFingerprint } from '@/lib/services/order-change/order-change-calculation.service';
import { ORDER_CHANGE_LIMITS } from '@/lib/constants/order-change';

const unchanged = {
  id: 'line-old',
  quantity: 2,
  active: true,
  repriced: false,
  persistedUnitPrice: '10.0000',
  quote: { basePrice: '12.0000', finalPrice: '9.0000', discountPercent: '25.0000' },
  lineEmbeddedExtra: '0.0000',
};

describe('calculateOrderChangeTotals', () => {
  it('applies a non-zero catalog adjustment once on a changed line and keeps an unchanged line', () => {
    const result = calculateOrderChangeTotals({
      lines: [
        unchanged,
        {
          id: 'line-new',
          quantity: 1,
          active: true,
          repriced: true,
          persistedUnitPrice: '0.0000',
          quote: { basePrice: '10.0000', finalPrice: '8.0000', discountPercent: '20.0000' },
          lineEmbeddedExtra: '2.5000',
        },
      ],
      taxMode: 'TAX_EXCLUSIVE',
      taxRatePercent: '0.0000',
      currencyDecimalPlaces: 3,
      overrideAllowed: false,
      orderPreferenceAddend: '3.0000',
      charges: [{ type: 'PREFERENCE', amount: '3.0000' }, { type: 'DELIVERY', amount: '1.0000' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.find((line) => line.id === 'line-old')).toMatchObject({ unitPrice: '10.0000', catalogAdjustment: '0.0000' });
    expect(result.lines.find((line) => line.id === 'line-new')).toMatchObject({ unitPrice: '8.0000', catalogAdjustment: '2.0000', embeddedExtra: '2.5000' });
    expect(result.orderPreferenceAddend).toBe('3.0000');
    expect(result.chargeTotal).toBe('1.0000');
    expect(result.totalAmount).toBe('34.5000');
  });

  it('rejects an override without permission and uses it without a second catalog discount', () => {
    const line = {
      id: 'line-new',
      quantity: 1,
      active: true,
      repriced: true,
      persistedUnitPrice: '0.0000',
      quote: { basePrice: '10.0000', finalPrice: '8.0000', discountPercent: '20.0000' },
      priceOverride: '7.0000',
      lineEmbeddedExtra: '0.0000',
    };
    expect(calculateOrderChangeTotals({
      lines: [line], taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 3, overrideAllowed: false, orderPreferenceAddend: '0.0000',
    })).toMatchObject({ ok: false, issue: { code: 'OVERRIDE_REQUIRED', lineId: 'line-new' } });

    const allowed = calculateOrderChangeTotals({
      lines: [line], taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 3, overrideAllowed: true, orderPreferenceAddend: '0.0000',
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.lines[0]).toMatchObject({ unitPrice: '7.0000', catalogAdjustment: '0.0000' });
  });

  it('extracts inclusive tax and adds exclusive tax once, with every preference level counted once', () => {
    const lines = [{
      id: 'line-1',
      quantity: 1,
      active: true,
      repriced: false,
      persistedUnitPrice: '10.0000',
      lineEmbeddedExtra: '2.5000',
    }];
    const exclusive = calculateOrderChangeTotals({
      lines, taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '10.0000', currencyDecimalPlaces: 3, overrideAllowed: false, orderPreferenceAddend: '3.0000',
    });
    const inclusive = calculateOrderChangeTotals({
      lines, taxMode: 'TAX_INCLUSIVE', taxRatePercent: '10.0000', currencyDecimalPlaces: 3, overrideAllowed: false, orderPreferenceAddend: '3.0000',
    });
    expect(exclusive.ok && inclusive.ok).toBe(true);
    if (!exclusive.ok || !inclusive.ok) return;
    expect(exclusive.taxAmount).toBe('1.2500');
    expect(exclusive.totalAmount).toBe('16.7500');
    expect(inclusive.taxAmount).toBe('1.1364');
    expect(inclusive.totalAmount).toBe('15.5000');
  });

  it('caps a promotion and does not redeem it again for the same order', () => {
    const lines = [{ id: 'line-1', quantity: 1, active: true, repriced: false, persistedUnitPrice: '20.0000', lineEmbeddedExtra: '0.0000' }];
    const capped = calculateOrderChangeTotals({
      lines, taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 2, overrideAllowed: false, orderPreferenceAddend: '0.0000',
      promotion: { amount: '15.0000', cap: '10.0000', used: '4.0000', alreadyRedeemedOnOrder: false },
    });
    const redeemed = calculateOrderChangeTotals({
      lines, taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 2, overrideAllowed: false, orderPreferenceAddend: '0.0000',
      promotion: { amount: '15.0000', cap: '10.0000', used: '4.0000', alreadyRedeemedOnOrder: true },
    });
    expect(capped.ok && redeemed.ok).toBe(true);
    if (!capped.ok || !redeemed.ok) return;
    expect(capped.promotionDiscount).toBe('6.0000');
    expect(capped.totalAmount).toBe('14.0000');
    expect(redeemed.promotionDiscount).toBe('0.0000');
    expect(redeemed.totalAmount).toBe('20.0000');
  });

  it('keeps four-decimal persistence, rounds the display boundary, and demands re-review on drift', () => {
    const first = calculateOrderChangeTotals({
      lines: [{ id: 'line-1', quantity: 3, active: true, repriced: false, persistedUnitPrice: '1.0001', lineEmbeddedExtra: '0.0000' }],
      taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 2, overrideAllowed: false, orderPreferenceAddend: '0.0000',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.totalAmount).toBe('3.0003');
    expect(first.displayTotal).toBe('3.00');

    const boundary = calculateOrderChangeTotals({
      lines: [{ id: 'line-1', quantity: 1, active: true, repriced: false, persistedUnitPrice: '1.0050', lineEmbeddedExtra: '0.0000' }],
      taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 2, overrideAllowed: false, orderPreferenceAddend: '0.0000',
      reviewedDisplayTotal: '1.00',
    });
    expect(boundary.ok).toBe(true);
    if (!boundary.ok) return;
    expect(boundary.displayTotal).toBe('1.01');
    expect(boundary.requiresReReview).toBe(true);
  });

  it('returns a digest that stays inside the Apply fingerprint limit', () => {
    const lineList = [
      'TAX_EXCLUSIVE|15.0000',
      '158f7e50-81a5-4b1e-b19d-a21973d5a103:1:10.5000:21.0000:0.0000',
      '44ea8124-980a-4c49-9c43-1d965e86724f:1:15.0000:30.0000:0.3000',
      '75a404cd-892f-4ad0-a324-c108d8acf882:1:22.5000:22.5000:0.5000',
      'b3405ccf-8eb5-4559-929a-46e5e7b9df6e:1:13.5000:13.5000:0.5000',
      '0.0000|0.0000|0.0000|0.0000|101.5450',
    ].join('|');
    expect(lineList.length).toBeGreaterThan(ORDER_CHANGE_LIMITS.MAX_CALCULATION_FINGERPRINT_LENGTH);
    const digest = digestOrderChangeCalculationFingerprint(lineList);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest.length).toBeLessThanOrEqual(ORDER_CHANGE_LIMITS.MAX_CALCULATION_FINGERPRINT_LENGTH);
    expect(digestOrderChangeCalculationFingerprint(lineList)).toBe(digest);
  });

  it('imports no database or server-only client', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/services/order-change/order-change-calculation.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|supabase|server-only|calculateTaxInTx|getPriceForOrderItem/);
  });
});
