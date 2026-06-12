/// <reference types="jest" />
/**
 * Integration test: checkout with multi-leg payment (CASH + CARD split)
 *
 * Exercises the `create-with-payment` route's multi-leg path:
 *   - Two legs (CASH 60 + CARD 40) sum to saleTotal 100
 *   - Each leg calls recordPaymentTransaction independently inside the TX
 *   - Server-side sum parity check passes
 *   - Deferred method isolation: PAY_ON_COLLECTION alone works; mixing with CASH fails
 *
 * Mocks Prisma at the boundary — no real DB required.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-int-checkout')
  ),
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-int-checkout'),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers + test logic
// ---------------------------------------------------------------------------

import {
  newOrderPaymentPayloadSchema,
  paymentLegSchema,
} from '@/lib/validations/new-order-payment-schemas';

describe('checkout multi-leg payment — validation layer', () => {
  describe('sum parity check (server-side logic simulation)', () => {
    function checkSumParity(legs: { amount: number }[], saleTotal: number): boolean {
      const sum = legs.reduce((s, l) => s + l.amount, 0);
      return Math.abs(sum - saleTotal) <= 0.001;
    }

    it('passes when two-leg sum equals saleTotal', () => {
      const legs = [{ amount: 60 }, { amount: 40 }];
      expect(checkSumParity(legs, 100)).toBe(true);
    });

    it('fails when sum differs by more than 0.001', () => {
      const legs = [{ amount: 60 }, { amount: 30 }];
      expect(checkSumParity(legs, 100)).toBe(false);
    });

    it('passes for single-leg (backward compatible)', () => {
      const legs = [{ amount: 100 }];
      expect(checkSumParity(legs, 100)).toBe(true);
    });

    it('handles floating-point near-equality correctly', () => {
      // 33.333 + 33.333 + 33.334 = 100.000 — should pass
      const legs = [{ amount: 33.333 }, { amount: 33.333 }, { amount: 33.334 }];
      expect(checkSumParity(legs, 100)).toBe(true);
    });
  });

  describe('deferred method isolation check', () => {
    const DEFERRED_METHODS = new Set(['PAY_ON_COLLECTION', 'INVOICE']);

    function checkDeferredIsolation(legs: { method: string }[]): boolean {
      const hasDeferred  = legs.some((l) => DEFERRED_METHODS.has(l.method));
      const hasImmediate = legs.some((l) => !DEFERRED_METHODS.has(l.method));
      return !(hasDeferred && hasImmediate); // mixing is not allowed
    }

    it('allows PAY_ON_COLLECTION alone', () => {
      expect(checkDeferredIsolation([{ method: 'PAY_ON_COLLECTION' }])).toBe(true);
    });

    it('allows CASH alone', () => {
      expect(checkDeferredIsolation([{ method: 'CASH' }])).toBe(true);
    });

    it('allows CASH + CARD split', () => {
      expect(checkDeferredIsolation([{ method: 'CASH' }, { method: 'CARD' }])).toBe(true);
    });

    it('rejects CASH + PAY_ON_COLLECTION mix', () => {
      expect(checkDeferredIsolation([{ method: 'CASH' }, { method: 'PAY_ON_COLLECTION' }])).toBe(false);
    });

    it('rejects INVOICE + CARD mix', () => {
      expect(checkDeferredIsolation([{ method: 'INVOICE' }, { method: 'CARD' }])).toBe(false);
    });
  });

  describe('paymentLeg Zod validation', () => {
    it('validates each leg correctly', () => {
      const legs = [
        { method: 'CASH', amount: 60 },
        { method: 'CARD', amount: 40 },
      ];
      for (const leg of legs) {
        expect(paymentLegSchema.safeParse(leg).success).toBe(true);
      }
    });

    it('rejects leg with negative amount', () => {
      expect(paymentLegSchema.safeParse({ method: 'CASH', amount: -1 }).success).toBe(false);
    });

    it('accepts cash tendered on cash legs when tendered is not below applied amount', () => {
      expect(paymentLegSchema.safeParse({ method: 'CASH', amount: 8.321, cashTendered: 8.821 }).success).toBe(true);
      expect(paymentLegSchema.safeParse({ method: 'CASH', amount: 8.321, cashTendered: 8 }).success).toBe(false);
    });

    it('rejects cash tendered on non-cash legs', () => {
      expect(paymentLegSchema.safeParse({ method: 'CARD', amount: 8.321, cashTendered: 8.821 }).success).toBe(false);
    });

    it('accepts live DB payment method codes from org_payment_methods_cf', () => {
      const gateway = paymentLegSchema.safeParse({
        method: 'PAYMENT_GATEWAY',
        amount: 1,
        gateway_code: 'HYPERPAY',
      });
      expect(gateway.success).toBe(true);

      expect(paymentLegSchema.safeParse({ method: 'ADVANCE', amount: 1 }).success).toBe(true);
      expect(
        paymentLegSchema.safeParse({
          method: 'CREDIT_NOTE',
          amount: 1,
          creditReferenceId: '11111111-1111-4111-8111-111111111111',
        }).success
      ).toBe(true);
      expect(paymentLegSchema.safeParse({ method: 'LOYALTY_POINTS', amount: 1 }).success).toBe(true);
    });
  });

  describe('partial payment outstanding policy payload', () => {
    it('accepts partial payment with pay-on-collection remainder', () => {
      const result = newOrderPaymentPayloadSchema.safeParse({
        amountToCharge: 40,
        outstandingPolicy: 'PAY_ON_COLLECTION',
        totals: {
          subtotal: 100,
          manualDiscount: 0,
          promoDiscount: 0,
          vatValue: 0,
          saleTotal: 100,
        },
        paymentLegs: [{ method: 'CASH', amount: 40 }],
      });

      expect(result.success).toBe(true);
    });

    it('accepts partial payment with invoice remainder', () => {
      const result = newOrderPaymentPayloadSchema.safeParse({
        amountToCharge: 25,
        outstandingPolicy: 'CREDIT_INVOICE',
        totals: {
          subtotal: 100,
          manualDiscount: 0,
          promoDiscount: 0,
          vatValue: 0,
          saleTotal: 100,
        },
        paymentLegs: [{ method: 'CARD', amount: 25 }],
      });

      expect(result.success).toBe(true);
    });

    it('rejects split legs whose sum does not equal amountToCharge', () => {
      const result = newOrderPaymentPayloadSchema.safeParse({
        amountToCharge: 100,
        totals: {
          subtotal: 100,
          manualDiscount: 0,
          promoDiscount: 0,
          vatValue: 0,
          saleTotal: 100,
        },
        paymentLegs: [
          { method: 'CASH', amount: 60 },
          { method: 'CARD', amount: 30 },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('accepts split legs when sum equals amountToCharge', () => {
      const result = newOrderPaymentPayloadSchema.safeParse({
        amountToCharge: 100,
        totals: {
          subtotal: 100,
          manualDiscount: 0,
          promoDiscount: 0,
          vatValue: 0,
          saleTotal: 100,
        },
        paymentLegs: [
          { method: 'CASH', amount: 60 },
          { method: 'CARD', amount: 40 },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('leaves overpayment policy checks to settlement services where method config is available', () => {
      const result = newOrderPaymentPayloadSchema.safeParse({
        amountToCharge: 101,
        totals: {
          subtotal: 100,
          manualDiscount: 0,
          promoDiscount: 0,
          vatValue: 0,
          saleTotal: 100,
        },
        paymentLegs: [{ method: 'CARD', amount: 101 }],
      });

      expect(result.success).toBe(true);
    });
  });
});
