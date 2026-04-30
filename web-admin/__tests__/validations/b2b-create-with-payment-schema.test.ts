/**
 * Unit tests for B2B create-with-payment schema
 * Validates creditLimitOverride and B2B fields
 */

import {
  createWithPaymentRequestSchema,
  type CreateWithPaymentRequest,
} from '@/lib/validations/new-order-payment-schemas';

const basePayload = {
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  orderTypeId: 'POS',
  items: [
    {
      productId: '660e8400-e29b-41d4-a716-446655440001',
      quantity: 1,
      pricePerUnit: 10,
      totalPrice: 10,
    },
  ],
  paymentMethod: 'CASH',
  clientTotals: {
    subtotal: 10,
    manualDiscount: 0,
    promoDiscount: 0,
    vatValue: 1,
    finalTotal: 11,
  },
};

describe('createWithPaymentRequestSchema (B2B)', () => {
  it('accepts creditLimitOverride true', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...basePayload,
      creditLimitOverride: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as CreateWithPaymentRequest).creditLimitOverride).toBe(true);
    }
  });

  it('accepts creditLimitOverride false', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...basePayload,
      creditLimitOverride: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts creditLimitOverride undefined (omitted)', () => {
    const result = createWithPaymentRequestSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as CreateWithPaymentRequest).creditLimitOverride).toBeUndefined();
    }
  });

  it('accepts B2B fields b2bContractId, costCenterCode, poNumber', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...basePayload,
      b2bContractId: '770e8400-e29b-41d4-a716-446655440002',
      costCenterCode: 'CC-001',
      poNumber: 'PO-12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as CreateWithPaymentRequest;
      expect(data.b2bContractId).toBe('770e8400-e29b-41d4-a716-446655440002');
      expect(data.costCenterCode).toBe('CC-001');
      expect(data.poNumber).toBe('PO-12345');
    }
  });

  it('treats empty, null, or non-string promoCodeId / giftCardId as omitted (no promo/gift)', () => {
    const uuid = '770e8400-e29b-41d4-a716-446655440003';
    for (const extra of [
      {},
      { promoCodeId: '', giftCardId: '' },
      { promoCodeId: null, giftCardId: null },
      { promoCodeId: 0, giftCardId: 0 },
      { promoCodeId: false, giftCardId: false },
      { promoCodeId: '   ', giftCardId: '\t' },
    ]) {
      const result = createWithPaymentRequestSchema.safeParse({ ...basePayload, ...extra });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as CreateWithPaymentRequest;
        expect(data.promoCodeId).toBeUndefined();
        expect(data.giftCardId).toBeUndefined();
      }
    }
    const withIds = createWithPaymentRequestSchema.safeParse({
      ...basePayload,
      promoCodeId: uuid,
      giftCardId: uuid,
    });
    expect(withIds.success).toBe(true);
    if (withIds.success) {
      expect((withIds.data as CreateWithPaymentRequest).promoCodeId).toBe(uuid);
      expect((withIds.data as CreateWithPaymentRequest).giftCardId).toBe(uuid);
    }
  });
});
