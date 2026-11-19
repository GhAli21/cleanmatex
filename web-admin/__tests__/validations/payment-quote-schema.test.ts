/**
 * Payment-quote input must accept Postgres uuid-shaped seed ids (non-RFC) that
 * demo branches/products still use; RFC-only Zod uuid() rejected those and
 * blocked New Order payment modal open with INVALID_QUOTE_INPUT.
 */
import { paymentQuoteRequestSchema } from '@/lib/validations/payment-quote-schema';

const SEED_BRANCH_ID = '22222222-2222-2222-2222-222222222222';
const SEED_PRODUCT_ID = '20000002-2222-2222-2222-222222222228';
const RFC_PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

describe('paymentQuoteRequestSchema', () => {
  it('accepts seeded non-RFC branch and product ids', () => {
    const parsed = paymentQuoteRequestSchema.safeParse({
      requestId: 'quote-seed-1',
      branchId: SEED_BRANCH_ID,
      items: [{ productId: SEED_PRODUCT_ID, quantity: 1 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.branchId).toBe(SEED_BRANCH_ID);
      expect(parsed.data.items[0]?.productId).toBe(SEED_PRODUCT_ID);
    }
  });

  it('treats empty preferenceCfId as absent', () => {
    const parsed = paymentQuoteRequestSchema.safeParse({
      requestId: 'quote-pref-1',
      items: [{ productId: RFC_PRODUCT_ID, quantity: 1 }],
      orderServicePrefs: [{
        preference_code: 'FRAGILE',
        source: 'manual',
        extra_price: 0.5,
        preferenceCfId: '',
      }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.orderServicePrefs?.[0]?.preferenceCfId).toBeUndefined();
    }
  });

  it('still rejects non-uuid-shaped branch ids', () => {
    const parsed = paymentQuoteRequestSchema.safeParse({
      requestId: 'quote-bad-1',
      branchId: 'bad-id',
      items: [{ productId: RFC_PRODUCT_ID, quantity: 1 }],
    });
    expect(parsed.success).toBe(false);
  });
});
