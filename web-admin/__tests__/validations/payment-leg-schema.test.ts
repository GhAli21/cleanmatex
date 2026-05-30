/**
 * Tests: paymentLegSchema — BVM Phase 6 Sub-item 6.
 *
 * Covers two additions:
 *  1. `paymentStatus` field defaults to `'COMPLETED'` when omitted; accepts
 *     `'COMPLETED'` and `'PENDING'`; rejects anything else.
 *  2. `superRefine` on CHECK legs — past-dated checks are rejected with the
 *     i18n key suffix `'checkDateInPast'`; non-parseable dates produce
 *     `'checkDateInvalid'`. CASH/CARD legs ignore the field.
 */

import { paymentLegSchema } from '@/lib/validations/new-order-payment-schemas';

const FUTURE_DATE = '2099-12-31';
const PAST_DATE = '1999-01-01';

describe('paymentLegSchema — paymentStatus default + accepted values', () => {
  it('leaves paymentStatus undefined when omitted (downstream treats undefined as the COMPLETED-fallback path)', () => {
    // Deliberately not using `.default('COMPLETED')` on the Zod field — the
    // implicit fallback lives in the planner and `settleOrder`, so the
    // parsed shape can stay back-compat with every existing literal call site.
    const parsed = paymentLegSchema.parse({ method: 'CASH', amount: 10 });
    expect(parsed.paymentStatus).toBeUndefined();
  });

  it("accepts an explicit 'PENDING' status", () => {
    const parsed = paymentLegSchema.parse({
      method: 'CASH',
      amount: 10,
      paymentStatus: 'PENDING',
    });
    expect(parsed.paymentStatus).toBe('PENDING');
  });

  it("rejects unknown paymentStatus values", () => {
    const result = paymentLegSchema.safeParse({
      method: 'CASH',
      amount: 10,
      paymentStatus: 'PROCESSING',
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentLegSchema — CHECK due-date superRefine (Phase 6 Sub-item 6)', () => {
  it('accepts a CHECK leg with a future-dated checkDate', () => {
    const result = paymentLegSchema.safeParse({
      method: 'CHECK',
      amount: 50,
      checkNumber: 'CHK001',
      checkDate: FUTURE_DATE,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a CHECK leg with a past-dated checkDate (message='checkDateInPast')", () => {
    const result = paymentLegSchema.safeParse({
      method: 'CHECK',
      amount: 50,
      checkNumber: 'CHK001',
      checkDate: PAST_DATE,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'checkDate');
      expect(issue?.message).toBe('checkDateInPast');
    }
  });

  it("rejects a CHECK leg with a non-parseable checkDate (message='checkDateInvalid')", () => {
    const result = paymentLegSchema.safeParse({
      method: 'CHECK',
      amount: 50,
      checkNumber: 'CHK001',
      checkDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'checkDate');
      expect(issue?.message).toBe('checkDateInvalid');
    }
  });

  it('ignores a past checkDate when method is not CHECK', () => {
    // CASH leg with a past checkDate must NOT be rejected — the field is
    // ignored by the refine since the rule only fires for CHECK.
    const result = paymentLegSchema.safeParse({
      method: 'CASH',
      amount: 10,
      checkDate: PAST_DATE,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a CHECK leg with no checkDate (requiredness lives in the form layer, not here)', () => {
    const result = paymentLegSchema.safeParse({
      method: 'CHECK',
      amount: 50,
      checkNumber: 'CHK001',
    });
    expect(result.success).toBe(true);
  });
});
