/** @jest-environment node */
/**
 * Submission boundary contract tests replace the former placeholder integration suite.
 * Route/orchestrator protection lives in their scoped suites; this is not a browser/DB test.
 */
import { submitOrderRequestSchema } from '@/lib/validations/new-order-payment-schemas';

const baseInput = {
  customerId: '11111111-1111-4111-8111-111111111111',
  items: [{ productId: '22222222-2222-4222-8222-222222222222', quantity: 1, pricePerUnit: 20, totalPrice: 20 }],
  paymentMethod: 'CASH', idempotencyKey: 'wp01-schema',
  clientTotals: { subtotal: 20, manualDiscount: 0, promoDiscount: 0, vatValue: 0, saleTotal: 20 },
};

describe('New Order actual submission schema contract (WP01)', () => {
  it('applies the canonical Create defaults and excludes client tenant/actor claims', () => {
    const result = submitOrderRequestSchema.parse({ ...baseInput, tenantId: 'forged', userId: 'forged' });
    expect(result).toMatchObject({ orderTypeId: 'POS', orderSourceCode: 'pos', idempotencyKey: 'wp01-schema' });
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('userId');
  });
  it('preserves Quick Drop, piece condition and three preference levels', () => {
    const pref = { preference_code: 'IRON', source: 'USER', extra_price: 2 };
    const piece = { pieceSeq: 1, conditions: ['STAIN'], servicePrefs: [pref] };
    const result = submitOrderRequestSchema.parse({ ...baseInput, isQuickDrop: true, quickDropQuantity: 1,
      orderServicePrefs: [pref], items: [{ ...baseInput.items[0], servicePrefs: [pref], pieces: [piece] }] });
    expect(result.isQuickDrop).toBe(true);
    expect(result.orderServicePrefs).toEqual([pref]);
    expect(result.items[0]).toMatchObject({ servicePrefs: [pref], pieces: [piece] });
  });
  it.each([
    { idempotencyKey: '' }, { items: [] },
    { items: [{ ...baseInput.items[0], quantity: 0 }] },
    { items: [{ ...baseInput.items[0], priceOverride: -1 }] },
    { paymentMethod: 'UNREGISTERED_METHOD' }, { outstandingPolicy: 'SILENT_WRITE_OFF' },
  ])('rejects invalid request intent: %j', (invalid) => {
    expect(submitOrderRequestSchema.safeParse({ ...baseInput, ...invalid }).success).toBe(false);
  });
  it('keeps gift settlement independent of sale total and explicit payment legs', () => {
    const result = submitOrderRequestSchema.parse({ ...baseInput,
      giftCardId: '33333333-3333-4333-8333-333333333333', giftCardAmount: 5,
      amountToCharge: 15, outstandingPolicy: 'NONE', paymentLegs: [{ method: 'CASH', amount: 15 }] });
    expect(result.clientTotals.saleTotal).toBe(20);
    expect(result.giftCardAmount).toBe(5);
    expect(result.paymentLegs?.[0]).toMatchObject({ method: 'CASH', amount: 15 });
  });
});
