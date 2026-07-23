/**
 * B32 — cash-drawer-wiring.handler.ts status gate tests.
 *
 * Confirms the M8 fix: `canHandle` only creates a CASH_SALE movement for an
 * effective-COMPLETED leg, using the same `resolvePaymentStatus` helper
 * order-payment-wiring.handler.ts uses — closing the gap where a
 * drawer-required method configured to create PENDING (D9 override) would
 * otherwise record cash-in while the money hasn't actually cleared.
 */

import { cashDrawerWiringHandler } from '@/lib/services/wiring/cash-drawer-wiring.handler';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';

function makeCashLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: 'ORDER_PAYMENT',
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CASH',
    payment_status: null,
    amount: 25 as never,
    currency_code: 'OMR',
    target_type: 'ORDER',
    target_id: ORDER_ID,
    order_id: ORDER_ID,
    customer_id: null,
    cash_drawer_session_id: SESSION_ID,
    tendered_amount: null,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: null,
    cash_drawer_mvt_id: null,
    card_brand_code: null,
    card_last4: null,
    gateway_code: null,
    gateway_reference: null,
    bank_reference: null,
    check_number: null,
    check_bank: null,
    check_date: null,
    org_payment_method_id: null,
    payment_terminal_id: null,
    branch_id: null,
    ...overrides,
  };
}

describe('cashDrawerWiringHandler.canHandle — B32 status gate', () => {
  it('returns true for a CASH + drawer-session line with no explicit status (resolves to COMPLETED)', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine())).toBe(true);
  });

  it('returns true when payment_status is explicitly COMPLETED', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ payment_status: 'COMPLETED' }))).toBe(true);
  });

  it('returns false when payment_status is explicitly PENDING (D9 override) — M8 fix', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ payment_status: 'PENDING' }))).toBe(false);
  });

  it('returns false when there is no cash_drawer_session_id', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ cash_drawer_session_id: null }))).toBe(false);
  });

  it('returns false for a non-CASH method even with a drawer session', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ payment_method_code: 'CARD' }))).toBe(false);
  });

  it('returns false when line_role is not ORDER_PAYMENT', () => {
    expect(
      cashDrawerWiringHandler.canHandle(makeCashLine({ line_role: 'CREDIT_APPLICATION' as never })),
    ).toBe(false);
  });

  it('returns false when direction is not IN', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ direction: 'OUT' as never }))).toBe(false);
  });
});
