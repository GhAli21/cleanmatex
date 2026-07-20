/**
 * Tests: cash-drawer-wiring.handler (D-12 / F-07, doc-19 rule — cash-change idempotency).
 *
 * Locks the cash-drawer movement wiring + its idempotency DESIGN:
 *  - the CASH_IN (sale) movement carries `fin_voucher_trx_line_id = line.id`, which is
 *    the anchor of the sparse unique index `uq_cd_mov_vch_line` that prevents a voucher
 *    line from being wired twice at the DB level (the real idempotency guard);
 *  - the CASH_OUT (change) movement is intentionally written WITHOUT
 *    `fin_voucher_trx_line_id`, so change is a separate physical movement and does NOT
 *    collide with the per-line guard;
 *  - no change → only the CASH_IN movement is created;
 *  - the line's `cash_drawer_mvt_id` is back-written for downstream handlers;
 *  - `getLinkedEffect` re-reads the movement by the same line-id anchor (the lookup the
 *    orchestrator uses to skip re-wiring an already-wired line).
 *
 * Mock-based (matches invoice/statement wiring-handler tests). The live DB-level guard
 * is exercised structurally; double-wire rejection by `uq_cd_mov_vch_line` is a DB
 * constraint asserted by the F-T5 DB-integration harness class.
 */

import { cashDrawerWiringHandler } from '@/lib/services/wiring/cash-drawer-wiring.handler';
import { LINE_ROLE } from '@/lib/constants/voucher';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = 'user-001';

function makeCashLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-cash-1',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: LINE_ROLE.ORDER_PAYMENT,
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CASH',
    payment_status: 'POSTED',
    amount: 30 as never,
    currency_code: 'OMR',
    target_type: null,
    target_id: null,
    order_id: 'order-1',
    customer_id: null,
    cash_drawer_session_id: SESSION_ID,
    tendered_amount: 50 as never,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: 'pay-1',
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

/** Builds a mock tx whose movement create() captures the inserted rows. */
function makeTx(sessionFound = true) {
  const created: Array<Record<string, unknown>> = [];
  let n = 0;
  const tx = {
    org_cash_drawer_sessions_mst: {
      findFirst: jest.fn().mockResolvedValue(
        sessionFound
          ? { id: SESSION_ID, cash_drawer_id: 'drawer-1', branch_id: 'branch-1', currency_code: 'OMR' }
          : null
      ),
    },
    org_cash_drawer_movements_dtl: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ id: `mvt-${++n}` });
      }),
      findFirst: jest.fn(),
    },
    org_fin_voucher_trx_lines_dtl: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { tx, created };
}

describe('cashDrawerWiringHandler.canHandle', () => {
  it('matches only CASH / IN / ORDER_PAYMENT lines that have a drawer session', () => {
    expect(cashDrawerWiringHandler.canHandle(makeCashLine())).toBe(true);
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ payment_method_code: 'CARD' }))).toBe(false);
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ direction: 'OUT' }))).toBe(false);
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ cash_drawer_session_id: null }))).toBe(false);
    expect(cashDrawerWiringHandler.canHandle(makeCashLine({ line_role: LINE_ROLE.INVOICE_PAYMENT }))).toBe(false);
  });
});

describe('cashDrawerWiringHandler.validate', () => {
  it('throws when the cash drawer session id is missing', async () => {
    await expect(
      cashDrawerWiringHandler.validate(makeCashLine({ cash_drawer_session_id: null }))
    ).rejects.toThrow(/cash_drawer_session_id/);
  });
  it('passes when the session id is present', async () => {
    await expect(cashDrawerWiringHandler.validate(makeCashLine())).resolves.toBeUndefined();
  });
});

describe('cashDrawerWiringHandler.wire', () => {
  it('creates a CASH_IN anchored on the voucher line id (the idempotency guard)', async () => {
    const { tx, created } = makeTx();
    const id = await cashDrawerWiringHandler.wire(makeCashLine(), VOUCHER_ID, TENANT, USER_ID, tx as never);

    expect(id).toBe('mvt-1');
    expect(created).toHaveLength(1); // no change → single movement
    expect(created[0]).toMatchObject({
      movement_type: 'CASH_SALE',
      direction: 'IN',
      amount: 30, // settled amount, NOT tendered (50)
      fin_voucher_trx_line_id: 'line-cash-1', // unique-index anchor (uq_cd_mov_vch_line)
      fin_voucher_id: VOUCHER_ID,
      order_payment_id: 'pay-1',
    });
    // line back-written for downstream handlers
    expect(tx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledTimes(1);
  });

  it('creates a separate CASH_OUT for change WITHOUT the per-line anchor', async () => {
    const { tx, created } = makeTx();
    await cashDrawerWiringHandler.wire(
      makeCashLine({ change_returned_amount: 20 as never }),
      VOUCHER_ID, TENANT, USER_ID, tx as never
    );

    expect(created).toHaveLength(2);
    const cashOut = created.find((r) => r.movement_type === 'CASH_OUT');
    expect(cashOut).toMatchObject({ direction: 'OUT', amount: 20, fin_voucher_id: VOUCHER_ID });
    // CASH_OUT must NOT carry fin_voucher_trx_line_id (so it can't collide with the CASH_IN guard)
    expect(cashOut?.fin_voucher_trx_line_id).toBeUndefined();
  });

  it('does not create a CASH_OUT when change is within epsilon', async () => {
    const { tx, created } = makeTx();
    await cashDrawerWiringHandler.wire(
      makeCashLine({ change_returned_amount: 0.0005 as never }),
      VOUCHER_ID, TENANT, USER_ID, tx as never
    );
    expect(created).toHaveLength(1);
    expect(created[0].movement_type).toBe('CASH_SALE');
  });

  it('throws when the drawer session is not found / not OPEN', async () => {
    const { tx } = makeTx(false);
    await expect(
      cashDrawerWiringHandler.wire(makeCashLine(), VOUCHER_ID, TENANT, USER_ID, tx as never)
    ).rejects.toThrow(/not found or not OPEN/);
  });
});

describe('cashDrawerWiringHandler.getLinkedEffect', () => {
  it('re-reads the movement by the same line-id anchor (orchestrator skip-rewire lookup)', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'mvt-9', amount: 30, currency_code: 'OMR' });
    const tx = { org_cash_drawer_movements_dtl: { findFirst } };

    const effect = await cashDrawerWiringHandler.getLinkedEffect(makeCashLine(), TENANT, tx as never);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fin_voucher_trx_line_id: 'line-cash-1', tenant_org_id: TENANT } })
    );
    expect(effect).toEqual({
      effectType: 'CASH_DRAWER_MOVEMENT',
      effectId: 'mvt-9',
      tableRef: 'org_cash_drawer_movements_dtl',
      amount: 30,
      currency_code: 'OMR',
    });
  });

  it('returns null when no movement is linked yet', async () => {
    const tx = { org_cash_drawer_movements_dtl: { findFirst: jest.fn().mockResolvedValue(null) } };
    const effect = await cashDrawerWiringHandler.getLinkedEffect(makeCashLine(), TENANT, tx as never);
    expect(effect).toBeNull();
  });
});
