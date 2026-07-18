/**
 * B34 — Initiate-refund dialog model helpers.
 *
 * Covers the client-side mirrors of the B01 rules: source-leg cap math
 * (per-payment / per-credit-app / overall), inline validation (no silent
 * money mutation — invalid entries are explained, never rewritten), the
 * pre-B27 context whitelist, and the per-attempt idempotency key.
 */

import {
  REFUND_UI_CONTEXTS,
  computeRefundLegOptions,
  createRefundAttemptKey,
  validateRefundInitiate,
} from '@features/orders/model/refund-initiate';
import type {
  OrderCreditApplicationRow,
  OrderPaymentRow,
  OrderRefundRow,
} from '@/lib/services/order-financial-summary.service';

const payment = (overrides: Partial<OrderPaymentRow>): OrderPaymentRow => ({
  id: 'pay-1',
  payment_method_code: 'CASH',
  payment_method_name_snapshot: null,
  payment_nature_snapshot: 'REAL_PAYMENT',
  amount: 100,
  currency_code: 'OMR',
  tendered_amount: null,
  change_returned_amount: null,
  payment_status: 'COMPLETED',
  received_by: null,
  gateway_code: null,
  gateway_transaction_id: null,
  gateway_reference: null,
  card_brand_code: null,
  card_last4: null,
  check_no: null,
  bank_reference: null,
  branch_payment_method_id: null,
  paid_at: null,
  created_at: '2026-07-17T00:00:00.000Z',
  rec_notes: null,
  fin_voucher_id: null,
  ...overrides,
});

const creditApp = (overrides: Partial<OrderCreditApplicationRow>): OrderCreditApplicationRow => ({
  id: 'app-1',
  credit_type: 'WALLET',
  application_status: 'APPLIED',
  credit_source_id: null,
  applied_amount: 40,
  currency_code: 'OMR',
  reference_no: null,
  applied_by: null,
  applied_at: '2026-07-17T00:00:00.000Z',
  fin_voucher_id: null,
  ...overrides,
});

const refund = (overrides: Partial<OrderRefundRow>): OrderRefundRow => ({
  id: 'ref-1',
  refund_no: 'REF-1',
  refund_amount: 10,
  refund_status: 'PROCESSED',
  refund_method_code: 'WALLET',
  reason_code: null,
  currency_code: 'OMR',
  original_payment_id: null,
  original_credit_app_id: null,
  refund_source_type: 'REAL_PAYMENT_REFUND',
  refund_context: 'STANDARD',
  reopens_due_amount: 0,
  metadata: {},
  created_at: '2026-07-17T00:00:00.000Z',
  ...overrides,
});

describe('computeRefundLegOptions', () => {
  it('offers COMPLETED real payments and APPLIED credits with per-leg remaining caps', () => {
    const { legs, overallRemaining } = computeRefundLegOptions({
      payments: [payment({ id: 'pay-1', amount: 100 })],
      creditApplications: [creditApp({ id: 'app-1', applied_amount: 40 })],
      refunds: [
        refund({ refund_amount: 30, original_payment_id: 'pay-1' }),
        refund({ id: 'ref-2', refund_amount: 15, original_credit_app_id: 'app-1' }),
      ],
    });

    const payLeg = legs.find((l) => l.id === 'pay-1');
    const appLeg = legs.find((l) => l.id === 'app-1');
    expect(payLeg?.remaining).toBe(70); // 100 − 30 consumed
    expect(appLeg?.remaining).toBe(25); // 40 − 15 consumed
    expect(overallRemaining).toBe(95); // 140 gross − 45 processed
  });

  it('excludes pending payments, non-real legs, and non-APPLIED credits', () => {
    const { legs } = computeRefundLegOptions({
      payments: [
        payment({ id: 'pending', payment_status: 'PENDING' }),
        payment({ id: 'credit-nature', payment_nature_snapshot: 'CREDIT_APPLICATION' }),
      ],
      creditApplications: [creditApp({ id: 'reversed', application_status: 'REVERSED' })],
      refunds: [],
    });
    expect(legs).toHaveLength(0);
  });

  it('ignores unprocessed refunds when computing consumed amounts', () => {
    const { legs } = computeRefundLegOptions({
      payments: [payment({ id: 'pay-1', amount: 100 })],
      creditApplications: [],
      refunds: [
        refund({ refund_amount: 60, original_payment_id: 'pay-1', refund_status: 'PENDING_APPROVAL' }),
      ],
    });
    expect(legs[0].remaining).toBe(100);
  });
});

describe('validateRefundInitiate', () => {
  const leg = {
    kind: 'PAYMENT' as const,
    id: 'pay-1',
    code: 'CASH',
    reference: null,
    amount: 100,
    remaining: 70,
  };

  it('requires a positive amount', () => {
    expect(validateRefundInitiate({ amount: 0, selectedLeg: leg, overallRemaining: 95, notes: '' }))
      .toEqual({ valid: false, errorKey: 'amountRequired' });
  });

  it('explains a leg-cap breach instead of rewriting the amount (no silent money mutation)', () => {
    expect(validateRefundInitiate({ amount: 71, selectedLeg: leg, overallRemaining: 95, notes: '' }))
      .toEqual({ valid: false, errorKey: 'amountExceedsLegCap' });
  });

  it('explains an overall-cap breach', () => {
    expect(
      validateRefundInitiate({ amount: 96, selectedLeg: { ...leg, remaining: 200 }, overallRemaining: 95, notes: '' }),
    ).toEqual({ valid: false, errorKey: 'amountExceedsOverallCap' });
  });

  it('requires a reason for goodwill (no-lineage) refunds', () => {
    expect(validateRefundInitiate({ amount: 10, selectedLeg: null, overallRemaining: 95, notes: '  ' }))
      .toEqual({ valid: false, errorKey: 'reasonRequiredForGoodwill' });
    expect(validateRefundInitiate({ amount: 10, selectedLeg: null, overallRemaining: 95, notes: 'damaged garment' }))
      .toEqual({ valid: true, errorKey: null });
  });

  it('accepts a valid leg-scoped amount', () => {
    expect(validateRefundInitiate({ amount: 70, selectedLeg: leg, overallRemaining: 95, notes: '' }))
      .toEqual({ valid: true, errorKey: null });
  });
});

describe('pre-B27 context whitelist + attempt key', () => {
  it('offers only STANDARD and PRICE_ADJUSTMENT_GOODWILL (rebill/manual arrive with B27)', () => {
    expect(REFUND_UI_CONTEXTS).toEqual(['STANDARD', 'PRICE_ADJUSTMENT_GOODWILL']);
  });

  it('creates unique, prefixed attempt keys within the 120-char API limit', () => {
    const a = createRefundAttemptKey();
    const b = createRefundAttemptKey();
    expect(a).toMatch(/^ui-refund-/);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(120);
  });
});
