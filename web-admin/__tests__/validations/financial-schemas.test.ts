/**
 * Tests: financial-schemas (Zod validation)
 *
 * Covers:
 * - paymentLegSchema — valid legs accepted
 * - paymentLegSchema — negative amount rejected
 * - paymentLegSchema — zero amount rejected
 * - paymentLegSchema — invalid method rejected
 * - createWithPaymentRequestSchema — paymentLegs accepted when present
 * - createWithPaymentRequestSchema — single legacy paymentMethod still valid
 * - newOrderPaymentPayloadSchema — paymentLegs optional
 * - newOrderPaymentPayloadSchema — overpayment policy deferred to settlement services
 */

import {
  paymentLegSchema,
  createWithPaymentRequestSchema,
  newOrderPaymentPayloadSchema,
} from '@/lib/validations/new-order-payment-schemas';

// ---------------------------------------------------------------------------
// paymentLegSchema
// ---------------------------------------------------------------------------

describe('paymentLegSchema', () => {
  it('accepts a valid CASH leg', () => {
    const result = paymentLegSchema.safeParse({ method: 'CASH', amount: 50 });
    expect(result.success).toBe(true);
  });

  it('accepts a CHECK leg with optional check fields when checkDate is not in the past', () => {
    const result = paymentLegSchema.safeParse({
      method: 'CHECK', amount: 25,
      checkNumber: '1234', checkBank: 'NBD', checkDate: '2099-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = paymentLegSchema.safeParse({ method: 'CASH', amount: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const result = paymentLegSchema.safeParse({ method: 'CASH', amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown payment method', () => {
    const result = paymentLegSchema.safeParse({ method: 'BITCOIN', amount: 10 });
    expect(result.success).toBe(false);
  });

  it('accepts all known method codes', () => {
    const methods = ['CASH', 'CARD', 'CHECK', 'PAY_ON_COLLECTION', 'CREDIT_INVOICE', 'INVOICE',
                     'HYPERPAY', 'PAYTABS', 'STRIPE', 'BANK_TRANSFER', 'MOBILE_PAYMENT'];
    for (const method of methods) {
      const result = paymentLegSchema.safeParse({ method, amount: 1 });
      expect(result.success).toBe(true);
    }
  });

  it('normalizes legacy INVOICE payloads to CREDIT_INVOICE', () => {
    const result = paymentLegSchema.safeParse({ method: 'INVOICE', amount: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('CREDIT_INVOICE');
    }
  });
});

// ---------------------------------------------------------------------------
// createWithPaymentRequestSchema — paymentLegs
// ---------------------------------------------------------------------------

const minimalOrder = {
  customerId:    'cust-1',
  paymentMethod: 'CASH',
  clientTotals:  { subtotal: 100, vatValue: 0, saleTotal: 100 },
  items: [{
    productId:    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    quantity:     1,
    pricePerUnit: 100,
    totalPrice:   100,
  }],
};

describe('createWithPaymentRequestSchema — paymentLegs', () => {
  it('accepts schema without paymentLegs (backward compatible)', () => {
    const result = createWithPaymentRequestSchema.safeParse(minimalOrder);
    expect(result.success).toBe(true);
  });

  it('accepts schema with valid paymentLegs array', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...minimalOrder,
      paymentLegs: [
        { method: 'CASH',  amount: 60 },
        { method: 'CARD',  amount: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial settlement with explicit outstanding policy', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...minimalOrder,
      amountToCharge: 40,
      outstandingPolicy: 'PAY_ON_COLLECTION',
      paymentLegs: [{ method: 'CASH', amount: 40 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects paymentLegs with empty array (min 1)', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...minimalOrder,
      paymentLegs: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects paymentLegs containing invalid leg', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...minimalOrder,
      paymentLegs: [{ method: 'CASH', amount: -5 }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// newOrderPaymentPayloadSchema
// ---------------------------------------------------------------------------

const minimalPayload = {
  amountToCharge: 100,
  totals: {
    subtotal: 100, vatValue: 0, saleTotal: 100,
  },
};

describe('newOrderPaymentPayloadSchema', () => {
  it('accepts minimal payload without paymentLegs', () => {
    const result = newOrderPaymentPayloadSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
  });

  it('accepts canonical saleTotal as the primary totals field', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      amountToCharge: 100,
      totals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totals.saleTotal).toBe(100);
    }
  });

  it('accepts payload with paymentLegs', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      ...minimalPayload,
      paymentLegs: [{ method: 'CASH', amount: 60 }, { method: 'CARD', amount: 40 }],
    });
    expect(result.success).toBe(true);
  });

  // Overpayment is a first-class flow since the ADR-046 overpayment policy (11-06-2026):
  // the schema-level `amountToCharge <= saleTotal` guard was intentionally removed so that
  // paying more than saleTotal is accepted here. Excess routing/resolution is enforced
  // downstream by the settlement services (overpaymentResolution + customer-receipt-excess
  // executor), not by this payload schema.
  it('accepts overpayment (amountToCharge > saleTotal) — excess routed by settlement services', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      amountToCharge: 200,
      totals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts amountToCharge <= saleTotal', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      amountToCharge: 100,
      totals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial payment (amountToCharge < saleTotal)', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      amountToCharge: 50,
      totals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
      outstandingPolicy: 'PAY_ON_COLLECTION',
    });
    expect(result.success).toBe(true);
  });

  it('accepts explicit credit-invoice remainder policy', () => {
    const result = newOrderPaymentPayloadSchema.safeParse({
      amountToCharge: 25,
      totals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
      outstandingPolicy: 'CREDIT_INVOICE',
    });
    expect(result.success).toBe(true);
  });
});

describe('createWithPaymentRequestSchema — canonical saleTotal alias', () => {
  it('accepts clientTotals.saleTotal as the primary totals field', () => {
    const result = createWithPaymentRequestSchema.safeParse({
      ...minimalOrder,
      clientTotals: { subtotal: 100, vatValue: 0, saleTotal: 100 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientTotals.saleTotal).toBe(100);
    }
  });

});
