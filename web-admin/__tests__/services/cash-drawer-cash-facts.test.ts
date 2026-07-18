/**
 * Tests: cash-drawer-cash-facts (B16)
 *
 * The effective-cash predicate is the heart of the B16 M2 fix: expected drawer
 * cash must count only active, COMPLETED-set, cash-family payments. These pure
 * tests pin that behaviour independent of Prisma/flag plumbing.
 */

import {
  CASH_PAYMENT_METHOD_CODES,
  EFFECTIVE_CASH_PAYMENT_STATUSES,
  effectiveCashPaymentWhere,
  isCashFamilyMethod,
  isEffectiveCashPaymentRow,
  sumEffectiveCashPayments,
} from '@/lib/services/cash-drawer-cash-facts';

const cash = (over: Record<string, unknown> = {}) => ({
  payment_status: 'COMPLETED',
  payment_method_code: 'CASH',
  is_active: true,
  amount: 10,
  ...over,
});

describe('cash-drawer-cash-facts — constants', () => {
  it('COMPLETED set is the frozen {COMPLETED, CAPTURED, SETTLED}', () => {
    expect([...EFFECTIVE_CASH_PAYMENT_STATUSES].sort()).toEqual(['CAPTURED', 'COMPLETED', 'SETTLED']);
  });

  it('cash family contains CASH', () => {
    expect(CASH_PAYMENT_METHOD_CODES).toContain('CASH');
  });
});

describe('cash-drawer-cash-facts — isCashFamilyMethod', () => {
  it('accepts CASH case-insensitively and rejects non-cash methods', () => {
    expect(isCashFamilyMethod('CASH')).toBe(true);
    expect(isCashFamilyMethod('cash')).toBe(true);
    expect(isCashFamilyMethod(' Cash ')).toBe(true);
    expect(isCashFamilyMethod('CARD')).toBe(false);
    expect(isCashFamilyMethod('CHEQUE')).toBe(false);
    expect(isCashFamilyMethod(null)).toBe(false);
    expect(isCashFamilyMethod(undefined)).toBe(false);
  });
});

describe('cash-drawer-cash-facts — isEffectiveCashPaymentRow', () => {
  it('includes an active COMPLETED cash payment', () => {
    expect(isEffectiveCashPaymentRow(cash())).toBe(true);
  });

  it('includes CAPTURED and SETTLED cash (gateway-cleared synonyms)', () => {
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'CAPTURED' }))).toBe(true);
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'SETTLED' }))).toBe(true);
  });

  it('excludes a PENDING cheque leg (M2 core case)', () => {
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'PENDING', payment_method_code: 'CHEQUE' }))).toBe(false);
  });

  it('excludes a gateway PENDING / AUTHORIZED / PROCESSING leg', () => {
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'PENDING' }))).toBe(false);
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'AUTHORIZED' }))).toBe(false);
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'PROCESSING' }))).toBe(false);
  });

  it('excludes FAILED / CANCELLED / REVERSED', () => {
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'FAILED' }))).toBe(false);
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'CANCELLED' }))).toBe(false);
    expect(isEffectiveCashPaymentRow(cash({ payment_status: 'REVERSED' }))).toBe(false);
  });

  it('excludes a soft-deleted (inactive) cash payment', () => {
    expect(isEffectiveCashPaymentRow(cash({ is_active: false }))).toBe(false);
  });

  it('excludes a completed non-cash (card) payment', () => {
    expect(isEffectiveCashPaymentRow(cash({ payment_method_code: 'CARD' }))).toBe(false);
  });
});

describe('cash-drawer-cash-facts — sumEffectiveCashPayments', () => {
  it('sums only the effective cash subset', () => {
    const rows = [
      cash({ amount: 10 }), // effective
      cash({ amount: 5, payment_status: 'PENDING' }), // excluded
      cash({ amount: 7, payment_method_code: 'CARD' }), // excluded
      cash({ amount: 3, is_active: false }), // excluded
      cash({ amount: 20, payment_status: 'CAPTURED' }), // effective
    ];
    expect(sumEffectiveCashPayments(rows)).toBe(30);
  });

  it('is zero for an all-excluded set', () => {
    expect(sumEffectiveCashPayments([cash({ payment_status: 'PENDING' })])).toBe(0);
  });

  it('handles Decimal-like string amounts', () => {
    expect(sumEffectiveCashPayments([cash({ amount: '12.5' })])).toBe(12.5);
  });
});

describe('cash-drawer-cash-facts — effectiveCashPaymentWhere', () => {
  it('produces a Prisma where fragment with active + COMPLETED-set + cash-family', () => {
    const where = effectiveCashPaymentWhere();
    expect(where.is_active).toBe(true);
    expect(where.payment_status.in.sort()).toEqual(['CAPTURED', 'COMPLETED', 'SETTLED']);
    expect(where.payment_method_code.in).toContain('CASH');
  });
});
