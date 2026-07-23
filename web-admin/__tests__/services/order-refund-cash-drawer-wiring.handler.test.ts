/**
 * B9 — order-refund-cash-drawer-wiring.handler.ts tests.
 *
 * Mirrors cash-drawer-change.idempotency.test.ts's structure for the sibling
 * ORDER_PAYMENT/IN handler. This handler owns ORDER_REFUND/OUT lines — a
 * self-contained CASH_OUT leg, so (unlike the change-return sub-leg) its
 * movement links BOTH fin_voucher_id AND fin_voucher_trx_line_id.
 */

import { orderRefundCashDrawerWiringHandler } from '@/lib/services/wiring/order-refund-cash-drawer-wiring.handler';
import { LINE_ROLE } from '@/lib/constants/voucher';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';
const ORDER_ID = '55555555-5555-5555-5555-555555555555';
const USER_ID = 'user-001';

function makeRefundLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-refund-1',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: LINE_ROLE.ORDER_REFUND,
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'OUT',
    payment_method_code: 'CASH',
    payment_status: 'COMPLETED',
    amount: 30 as never,
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
    branch_id: 'branch-1',
    ...overrides,
  };
}

describe('orderRefundCashDrawerWiringHandler.canHandle', () => {
  it('matches CASH / OUT / ORDER_REFUND lines with a drawer session', () => {
    expect(orderRefundCashDrawerWiringHandler.canHandle(makeRefundLine())).toBe(true);
  });

  it('does not match ORDER_PAYMENT/IN lines (owned by cashDrawerWiringHandler)', () => {
    expect(
      orderRefundCashDrawerWiringHandler.canHandle(
        makeRefundLine({ line_role: LINE_ROLE.ORDER_PAYMENT, direction: 'IN' }),
      ),
    ).toBe(false);
  });

  it('does not match a refund line with no drawer session (ORIGINAL_METHOD)', () => {
    expect(
      orderRefundCashDrawerWiringHandler.canHandle(makeRefundLine({ cash_drawer_session_id: null })),
    ).toBe(false);
  });

  it('does not match a non-CASH refund method', () => {
    expect(
      orderRefundCashDrawerWiringHandler.canHandle(makeRefundLine({ payment_method_code: 'ORIGINAL_METHOD' })),
    ).toBe(false);
  });
});

describe('orderRefundCashDrawerWiringHandler.validate', () => {
  it('throws when the cash drawer session id is missing', async () => {
    await expect(
      orderRefundCashDrawerWiringHandler.validate(makeRefundLine({ cash_drawer_session_id: null })),
    ).rejects.toThrow(/cash_drawer_session_id/);
  });
});

describe('orderRefundCashDrawerWiringHandler.wire', () => {
  function makeTx() {
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      org_cash_drawer_sessions_mst: {
        findFirst: jest.fn().mockResolvedValue({
          id: SESSION_ID, cash_drawer_id: 'drawer-1', branch_id: 'branch-1', currency_code: 'OMR',
        }),
      },
      org_cash_drawer_movements_dtl: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return Promise.resolve({ id: 'mvt-refund-1' });
        }),
      },
      org_fin_voucher_trx_lines_dtl: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { tx, created };
  }

  it('creates a CASH_OUT movement linking both fin_voucher_id AND fin_voucher_trx_line_id', async () => {
    const { tx, created } = makeTx();
    const id = await orderRefundCashDrawerWiringHandler.wire(
      makeRefundLine(), VOUCHER_ID, TENANT, USER_ID, tx as never,
    );

    expect(id).toBe('mvt-refund-1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      movement_type: 'CASH_OUT',
      direction: 'OUT',
      amount: 30,
      order_id: ORDER_ID,
      fin_voucher_id: VOUCHER_ID,
      fin_voucher_trx_line_id: 'line-refund-1',
    });
    expect(tx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws when the drawer session is not found or not OPEN', async () => {
    const { tx } = makeTx();
    tx.org_cash_drawer_sessions_mst.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      orderRefundCashDrawerWiringHandler.wire(makeRefundLine(), VOUCHER_ID, TENANT, USER_ID, tx as never),
    ).rejects.toThrow(/not found or not OPEN/);
  });
});

describe('orderRefundCashDrawerWiringHandler.getLinkedEffect', () => {
  it('re-reads the movement by the line-id anchor', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'mvt-refund-9', amount: 30, currency_code: 'OMR' });
    const tx = { org_cash_drawer_movements_dtl: { findFirst } };

    const effect = await orderRefundCashDrawerWiringHandler.getLinkedEffect(makeRefundLine(), TENANT, tx as never);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fin_voucher_trx_line_id: 'line-refund-1', tenant_org_id: TENANT } }),
    );
    expect(effect).toEqual({
      effectType: 'CASH_DRAWER_MOVEMENT',
      effectId: 'mvt-refund-9',
      tableRef: 'org_cash_drawer_movements_dtl',
      amount: 30,
      currency_code: 'OMR',
    });
  });

  it('returns null when no movement is linked yet', async () => {
    const tx = { org_cash_drawer_movements_dtl: { findFirst: jest.fn().mockResolvedValue(null) } };
    const effect = await orderRefundCashDrawerWiringHandler.getLinkedEffect(makeRefundLine(), TENANT, tx as never);
    expect(effect).toBeNull();
  });
});
