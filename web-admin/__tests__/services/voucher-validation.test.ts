/**
 * Unit tests: voucher-validation.service
 *
 * Pure functions — no DB, no mocks needed.
 * Covers: status transitions, role restrictions, line validation, posting pre-checks.
 */

import {
  validateStatusTransition,
  assertVoucherIsMutable,
  validateRoleForVoucher,
  validateVoucherLine,
  validateVoucherForPosting,
} from '@/lib/services/voucher-validation.service';

import { VOUCHER_STATUS, VOUCHER_TYPE, LINE_ROLE } from '@/lib/constants/voucher';
import type { VoucherStatus } from '@/lib/types/voucher';

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe('validateStatusTransition', () => {
  it('allows DRAFT → POSTED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.DRAFT, VOUCHER_STATUS.POSTED)
    ).not.toThrow();
  });

  it('allows DRAFT → CANCELLED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.DRAFT, VOUCHER_STATUS.CANCELLED)
    ).not.toThrow();
  });

  it('allows POSTED → REVERSED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.POSTED, VOUCHER_STATUS.REVERSED)
    ).not.toThrow();
  });

  it('allows POSTED → PARTIALLY_REVERSED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.POSTED, VOUCHER_STATUS.PARTIALLY_REVERSED)
    ).not.toThrow();
  });

  it('allows PARTIALLY_REVERSED → REVERSED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.PARTIALLY_REVERSED, VOUCHER_STATUS.REVERSED)
    ).not.toThrow();
  });

  it('blocks DRAFT → REVERSED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.DRAFT, VOUCHER_STATUS.REVERSED)
    ).toThrow(/Invalid voucher status transition/);
  });

  it('blocks POSTED → DRAFT', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.POSTED, VOUCHER_STATUS.DRAFT as VoucherStatus)
    ).toThrow(/Invalid voucher status transition/);
  });

  it('blocks CANCELLED → POSTED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.CANCELLED, VOUCHER_STATUS.POSTED)
    ).toThrow(/Invalid voucher status transition/);
  });

  it('blocks REVERSED → POSTED', () => {
    expect(() =>
      validateStatusTransition(VOUCHER_STATUS.REVERSED, VOUCHER_STATUS.POSTED)
    ).toThrow(/Invalid voucher status transition/);
  });
});

// ---------------------------------------------------------------------------
// Mutability guard
// ---------------------------------------------------------------------------

describe('assertVoucherIsMutable', () => {
  it('passes for DRAFT', () => {
    expect(() => assertVoucherIsMutable(VOUCHER_STATUS.DRAFT)).not.toThrow();
  });

  it('throws for POSTED', () => {
    expect(() => assertVoucherIsMutable(VOUCHER_STATUS.POSTED)).toThrow(/DRAFT vouchers/);
  });

  it('throws for CANCELLED', () => {
    expect(() => assertVoucherIsMutable(VOUCHER_STATUS.CANCELLED)).toThrow(/DRAFT vouchers/);
  });

  it('throws for REVERSED', () => {
    expect(() => assertVoucherIsMutable(VOUCHER_STATUS.REVERSED)).toThrow(/DRAFT vouchers/);
  });
});

// ---------------------------------------------------------------------------
// Role-based voucher type / line role restrictions
// ---------------------------------------------------------------------------

describe('validateRoleForVoucher', () => {
  it('cashier can create RECEIPT_VOUCHER', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.RECEIPT)
    ).not.toThrow();
  });

  it('cashier blocked from PAYMENT_VOUCHER', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.PAYMENT)
    ).toThrow(/cashier/);
  });

  it('cashier blocked from REFUND_VOUCHER', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.REFUND)
    ).toThrow(/cashier/);
  });

  it('cashier blocked from ADJUSTMENT_VOUCHER', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.ADJUSTMENT)
    ).toThrow(/cashier/);
  });

  it('cashier can use ORDER_PAYMENT line role on RECEIPT_VOUCHER', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.RECEIPT, LINE_ROLE.ORDER_PAYMENT)
    ).not.toThrow();
  });

  it('cashier can use WALLET_TOPUP line role', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.RECEIPT, LINE_ROLE.WALLET_TOPUP)
    ).not.toThrow();
  });

  it('cashier blocked from EXPENSE_PAYMENT line role', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.RECEIPT, LINE_ROLE.EXPENSE_PAYMENT)
    ).toThrow(/cashier/);
  });

  it('cashier blocked from SUPPLIER_PAYMENT line role', () => {
    expect(() =>
      validateRoleForVoucher('cashier', VOUCHER_TYPE.RECEIPT, LINE_ROLE.SUPPLIER_PAYMENT)
    ).toThrow(/cashier/);
  });

  it('branch_manager can create any voucher type', () => {
    expect(() =>
      validateRoleForVoucher('branch_manager', VOUCHER_TYPE.PAYMENT)
    ).not.toThrow();
  });

  it('admin can create any voucher type', () => {
    expect(() =>
      validateRoleForVoucher('admin', VOUCHER_TYPE.REFUND)
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Line validation
// ---------------------------------------------------------------------------

describe('validateVoucherLine', () => {
  const baseInput = {
    line_role: LINE_ROLE.ORDER_PAYMENT,
    line_type: 'RECEIPT' as const,
    order_id: '11111111-1111-1111-1111-111111111111',
    amount: 100,
  };

  it('passes a valid cash payment line', () => {
    expect(() =>
      validateVoucherLine({
        ...baseInput,
        payment_method_code: 'CASH',
        tendered_amount: 100,
      })
    ).not.toThrow();
  });

  it('blocks negative amount', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, amount: -1 })
    ).toThrow(/amount must be >= 0/);
  });

  it('blocks card_last4 longer than 4 chars', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, card_last4: '12345' })
    ).toThrow(/card_last4/);
  });

  it('blocks BANK_TRANSFER without bank_reference', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'BANK_TRANSFER' })
    ).toThrow(/bank_reference/);
  });

  it('passes BANK_TRANSFER with bank_reference', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'BANK_TRANSFER', bank_reference: 'BK-001' })
    ).not.toThrow();
  });

  it('blocks CHECK without check_number', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CHECK', check_bank: 'B', check_date: '2026-01-01' })
    ).toThrow(/check_number/);
  });

  it('blocks CHECK without check_bank', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CHECK', check_number: '001', check_date: '2026-01-01' })
    ).toThrow(/check_bank/);
  });

  it('blocks CHECK without check_date', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CHECK', check_number: '001', check_bank: 'B' })
    ).toThrow(/check_date/);
  });

  it('passes CHECK with all three fields', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CHECK', check_number: '001', check_bank: 'B', check_date: '2026-01-01' })
    ).not.toThrow();
  });

  it('blocks CASH where tendered_amount < amount', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CASH', tendered_amount: 50 })
    ).toThrow(/tendered_amount/);
  });

  it('accepts CASH where tendered_amount equals amount', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CASH', tendered_amount: 100 })
    ).not.toThrow();
  });

  it('derives change correctly — tendered 120 for amount 100 does not throw', () => {
    expect(() =>
      validateVoucherLine({ ...baseInput, payment_method_code: 'CASH', tendered_amount: 120 })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Posting pre-check
// ---------------------------------------------------------------------------

describe('validateVoucherForPosting', () => {
  const makeLine = (amount: number, line_status = 'DRAFT', is_active = true) => ({
    amount,
    line_status,
    is_active,
  });

  it('passes when header total matches active DRAFT line sum', () => {
    expect(() =>
      validateVoucherForPosting(250, [makeLine(100), makeLine(150)])
    ).not.toThrow();
  });

  it('throws when no active DRAFT lines', () => {
    expect(() =>
      validateVoucherForPosting(100, [makeLine(100, 'POSTED')])
    ).toThrow(/at least one active DRAFT line/);
  });

  it('throws when header total does not match line sum', () => {
    expect(() =>
      validateVoucherForPosting(300, [makeLine(100), makeLine(150)])
    ).toThrow(/does not match/);
  });

  it('tolerates floating-point rounding within 0.0001', () => {
    expect(() =>
      validateVoucherForPosting(100.00001, [makeLine(100)])
    ).not.toThrow();
  });

  it('ignores inactive lines when summing', () => {
    expect(() =>
      validateVoucherForPosting(100, [makeLine(100), makeLine(50, 'DRAFT', false)])
    ).not.toThrow();
  });

  it('accepts Decimal-like object amounts (toNumber shim)', () => {
    const decimalLine = { amount: { toNumber: () => 100 }, line_status: 'DRAFT', is_active: true };
    expect(() =>
      validateVoucherForPosting(100, [decimalLine])
    ).not.toThrow();
  });
});
