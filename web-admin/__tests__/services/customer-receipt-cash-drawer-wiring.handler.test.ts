/**
 * CLF W6 — temporary legacy mirror for customer account receipts.
 *
 * Fires only for a CASH CUSTOMER_CREDIT_RECEIPT IN line the gate attached to a
 * session, and writes exactly one net IN movement (no change row — receipt
 * rows carry no order_payment_id, so a change OUT would be subtracted twice by
 * the legacy expected-cash formula).
 */

import { customerReceiptCashDrawerWiringHandler as handler } from '@/lib/services/wiring/customer-receipt-cash-drawer-wiring.handler';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const CUSTOMER_ID = '33333333-3333-3333-3333-333333333333';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = 'user-1';

function makeLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: 'CUSTOMER_CREDIT_RECEIPT',
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CASH',
    payment_status: 'COMPLETED',
    amount: 30 as never,
    currency_code: 'OMR',
    target_type: 'CUSTOMER',
    target_id: CUSTOMER_ID,
    order_id: null,
    customer_id: CUSTOMER_ID,
    cash_drawer_session_id: SESSION_ID,
    tendered_amount: 50 as never,
    change_returned_amount: 20 as never,
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

describe('customerReceiptCashDrawerWiringHandler.canHandle', () => {
  it('handles a CASH receipt line the gate put in a session', () => {
    expect(handler.canHandle(makeLine())).toBe(true);
  });

  it('ignores a receipt line with no session (gate did not put it in a drawer)', () => {
    expect(handler.canHandle(makeLine({ cash_drawer_session_id: null }))).toBe(false);
  });

  it('ignores non-cash receipt lines', () => {
    expect(handler.canHandle(makeLine({ payment_method_code: 'CARD' }))).toBe(false);
  });

  it('ignores other line roles (e.g. ORDER_PAYMENT, CUSTOMER_ADVANCE_RECEIPT)', () => {
    expect(handler.canHandle(makeLine({ line_role: 'ORDER_PAYMENT' }))).toBe(false);
    expect(handler.canHandle(makeLine({ line_role: 'CUSTOMER_ADVANCE_RECEIPT' }))).toBe(false);
  });

  it('ignores OUT lines', () => {
    expect(handler.canHandle(makeLine({ direction: 'OUT' }))).toBe(false);
  });
});

describe('customerReceiptCashDrawerWiringHandler.wire', () => {
  it('writes one net CASH_SALE IN movement (no change row) and links it back to the line', async () => {
    const sessionFindFirst = jest.fn().mockResolvedValue({
      id: SESSION_ID,
      cash_drawer_id: 'drawer-1',
      branch_id: 'branch-1',
      currency_code: 'OMR',
    });
    const movementCreate = jest.fn().mockResolvedValue({ id: 'mvt-1' });
    const lineUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_cash_drawer_sessions_mst: { findFirst: sessionFindFirst },
      org_cash_drawer_movements_dtl: { create: movementCreate },
      org_fin_voucher_trx_lines_dtl: { updateMany: lineUpdateMany },
    };
    const line = makeLine();

    const id = await handler.wire(line, VOUCHER_ID, TENANT, USER_ID, tx as never);

    expect(id).toBe('mvt-1');
    expect(sessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: SESSION_ID, tenant_org_id: TENANT, status: 'OPEN' }),
      }),
    );
    expect(movementCreate).toHaveBeenCalledTimes(1);
    expect(movementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id: TENANT,
          cash_drawer_id: 'drawer-1',
          cash_drawer_session_id: SESSION_ID,
          movement_type: 'CASH_SALE',
          direction: 'IN',
          amount: 30,
          fin_voucher_id: VOUCHER_ID,
          fin_voucher_trx_line_id: 'line-001',
        }),
      }),
    );
    expect(lineUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-001', tenant_org_id: TENANT },
        data: expect.objectContaining({ cash_drawer_mvt_id: 'mvt-1' }),
      }),
    );
    expect(line.cash_drawer_mvt_id).toBe('mvt-1');
  });

  it('throws (rolling back the post) when the session is not OPEN', async () => {
    const tx = {
      org_cash_drawer_sessions_mst: { findFirst: jest.fn().mockResolvedValue(null) },
      org_cash_drawer_movements_dtl: { create: jest.fn() },
      org_fin_voucher_trx_lines_dtl: { updateMany: jest.fn() },
    };
    await expect(handler.wire(makeLine(), VOUCHER_ID, TENANT, USER_ID, tx as never)).rejects.toThrow(
      /not found or not OPEN/,
    );
    expect(tx.org_cash_drawer_movements_dtl.create).not.toHaveBeenCalled();
  });
});
