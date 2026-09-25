/**
 * Tests: voucher-line-reversal.service — reverseVoucherLinesInTx (CLF W9, ADR-057)
 *
 * Covers:
 * - creates a mirror reversal voucher with opposite-direction lines
 * - full vs selected-line (partial) reversal, target status REVERSED / PARTIALLY_REVERSED
 * - party_name fallback to the customer when the header left it blank
 * - cash mirrors go through the ledger gate in DEFERRED mode (never the original session hint)
 * - a PENDING/NONE cash original is abandoned, not mirrored into the ledger
 * - a pre-CLF original (no cash_effect_code) gets no one-sided gate stamp
 * - rejects: voucher not found, no POSTED lines, unknown selected line id
 */

const mockTx = {
  $queryRaw: jest.fn(),
  org_fin_vouchers_mst: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  org_fin_voucher_trx_lines_dtl: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  org_fin_voucher_audit_log: {
    create: jest.fn(),
  },
  org_domain_events_outbox: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/services/voucher-number.service', () => ({
  generateBizVoucherNo: jest.fn().mockResolvedValue('RV-REV-2026-000001'),
}));

const mockStampCashLinesTx = jest.fn();
const mockAbandonPendingCashLineTx = jest.fn();
jest.mock('@/lib/services/cash-drawer-ledger/cash-drawer-ledger-gate', () => ({
  stampCashLinesTx: (...args: unknown[]) => mockStampCashLinesTx(...args),
  abandonPendingCashLineTx: (...args: unknown[]) => mockAbandonPendingCashLineTx(...args),
}));

import { reverseVoucherLinesInTx } from '@/lib/services/voucher-line-reversal.service';
import { VOUCHER_STATUS, VOUCHER_TYPE } from '@/lib/constants/voucher';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-002';

const makeOriginalVoucher = (status: string = VOUCHER_STATUS.POSTED) => ({
  id: VOUCHER_ID,
  voucher_no: 'RV-2026-000123',
  voucher_type: VOUCHER_TYPE.RECEIPT,
  voucher_category: 'CASH',
  voucher_subtype: null,
  voucher_status: status,
  currency_code: 'OMR',
  currency_ex_rate: '1',
  branch_id: '44444444-4444-4444-4444-444444444444',
  direction: 'IN',
  party_type: 'CUSTOMER',
  party_name: 'Demo Customer',
  supplier_id: null,
  employee_id: null,
  customer_id: '66666666-6666-6666-6666-666666666666',
  order_id: '55555555-5555-5555-5555-555555555555',
  invoice_id: null,
  source_module: 'ORDERS',
  source_ref_type: 'ORDER',
  source_ref_id: '55555555-5555-5555-5555-555555555555',
  reason_code: null,
  notes: 'Counter receipt',
});

const makePostedLines = () => [
  {
    id: 'line-1',
    line_no: 1,
    line_type: 'RECEIPT',
    line_role: 'ORDER_PAYMENT',
    target_type: 'ORDER',
    target_id: 'target-1',
    order_id: '55555555-5555-5555-5555-555555555555',
    customer_id: '66666666-6666-6666-6666-666666666666',
    payment_method_code: 'CASH',
    amount: 120,
    currency_code: 'OMR',
    direction: 'IN',
    payment_status: 'COMPLETED',
    cash_effect_code: 'DRAWER',
    cash_drawer_id: 'drawer-1',
    cash_drawer_session_id: 'session-old',
    branch_id: '44444444-4444-4444-4444-444444444444',
  },
  {
    id: 'line-2',
    line_no: 2,
    line_type: 'FEE',
    line_role: 'CUSTOMER_CREDIT_RECEIPT',
    target_type: 'CUSTOMER',
    target_id: 'target-2',
    order_id: null,
    customer_id: '77777777-7777-7777-7777-777777777777',
    payment_method_code: 'CARD',
    amount: 80,
    currency_code: 'OMR',
    direction: 'OUT',
    payment_status: 'COMPLETED',
    cash_effect_code: null,
    cash_drawer_id: null,
    cash_drawer_session_id: null,
    branch_id: '44444444-4444-4444-4444-444444444444',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockStampCashLinesTx.mockResolvedValue(new Map());
  mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-x' });
  mockTx.org_fin_vouchers_mst.create.mockResolvedValue({ id: 'reversal-1' });
  mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
  mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
  mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
  mockTx.org_domain_events_outbox.create.mockResolvedValue({});
});

describe('reverseVoucherLinesInTx — full reversal', () => {
  it('creates a mirror voucher + opposite-direction lines, flips the original to REVERSED, writes audit + outbox', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());
    let call = 0;
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockImplementation(() =>
      Promise.resolve({ id: `rev-line-${++call}` }),
    );

    const result = await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Customer refund',
      userId: USER_ID,
    });

    expect(result.originalStatus).toBe(VOUCHER_STATUS.REVERSED);
    expect(result.reversalVoucherId).toBe('reversal-1');
    expect(result.pairs).toHaveLength(2);

    expect(mockTx.org_fin_vouchers_mst.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_type: VOUCHER_TYPE.RECEIPT,
          voucher_status: VOUCHER_STATUS.POSTED,
          ref_voucher_id: VOUCHER_ID,
          reversal_reason: 'Customer refund',
          posted_by: USER_ID,
          party_name: 'Demo Customer',
        }),
      }),
    );

    // Mirrors start DRAFT (the gate stamps DRAFT lines) then flip to POSTED together.
    expect(mockTx.org_fin_voucher_trx_lines_dtl.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_id: 'reversal-1', reversed_line_id: 'line-1', direction: 'OUT', line_status: 'DRAFT',
        }),
      }),
    );
    expect(mockTx.org_fin_voucher_trx_lines_dtl.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_id: 'reversal-1', reversed_line_id: 'line-2', direction: 'IN', line_status: 'DRAFT',
        }),
      }),
    );
    expect(mockTx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_org_id: TENANT, voucher_id: 'reversal-1', line_status: 'DRAFT' },
        data: expect.objectContaining({ line_status: 'POSTED' }),
      }),
    );
    expect(mockTx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_org_id: TENANT, id: { in: ['line-1', 'line-2'] } },
        data: expect.objectContaining({ line_status: 'REVERSED' }),
      }),
    );

    expect(mockTx.org_fin_vouchers_mst.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VOUCHER_ID, tenant_org_id: TENANT },
        data: expect.objectContaining({
          voucher_status: VOUCHER_STATUS.REVERSED,
          reversal_reason: 'Customer refund',
          reversed_by_voucher_id: 'reversal-1',
        }),
      }),
    );
    expect(mockTx.org_fin_voucher_audit_log.create).toHaveBeenCalledTimes(1);
    expect(mockTx.org_domain_events_outbox.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event_type: 'VOUCHER_REVERSED', aggregate_id: VOUCHER_ID }) }),
    );
  });

  it('sends only the cash-family line to the gate, in DEFERRED mode, and ignores the original session hint', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());

    await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Customer refund',
      userId: USER_ID,
    });

    expect(mockStampCashLinesTx).toHaveBeenCalledTimes(1);
    const [, ctx, , gateLines] = mockStampCashLinesTx.mock.calls[0];
    expect(ctx).toEqual({ tenantOrgId: TENANT, userId: USER_ID, mode: 'DEFERRED' });
    expect(gateLines).toHaveLength(1); // only the CASH line — the CARD line never reaches the gate
    expect(gateLines[0].direction).toBe('OUT'); // opposite of the original IN
  });

  it('reads the gate-decided session back onto the pair, not the original session', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[0]]);
    mockStampCashLinesTx.mockImplementation(async (_tx, _ctx, _voucher, lines) => {
      const map = new Map();
      for (const l of lines) {
        l.cash_drawer_session_id = 'session-current'; // gate mutates in place, per contract
        map.set(l.id, { effect: 'DRAWER', sessionId: 'session-current', error: null });
      }
      return map;
    });

    const result = await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Customer refund',
      userId: USER_ID,
    });

    expect(result.pairs[0].reversalSessionId).toBe('session-current');
    expect(result.pairs[0].reversalSessionId).not.toBe('session-old');
  });

  it('abandons a PENDING cash original (never received) instead of mirroring it into the ledger', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([
      { ...makePostedLines()[0], payment_status: 'PENDING', cash_effect_code: 'PENDING' },
    ]);

    await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Never cleared',
      userId: USER_ID,
    });

    expect(mockStampCashLinesTx).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), [], // no gate lines
    );
    expect(mockAbandonPendingCashLineTx).toHaveBeenCalledWith(
      expect.anything(),
      { tenantOrgId: TENANT, userId: USER_ID, mode: 'DEFERRED' },
      'line-1',
    );
  });

  it('does not one-sided-stamp a pre-CLF original that carries no cash_effect_code at all', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([
      { ...makePostedLines()[0], cash_effect_code: undefined },
    ]);

    await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Legacy row',
      userId: USER_ID,
    });

    expect(mockStampCashLinesTx).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), [],
    );
    expect(mockAbandonPendingCashLineTx).not.toHaveBeenCalled();
  });

  it('fills party_name from the header only — no customer lookup lives in this module', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ ...makeOriginalVoucher(), party_name: 'From Header' }]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[1]]);

    await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'test',
      userId: USER_ID,
    });

    expect(mockTx.org_fin_vouchers_mst.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ party_name: 'From Header' }) }),
    );
  });
});

describe('reverseVoucherLinesInTx — selected lines (partial)', () => {
  it('reverses only the selected line and leaves the voucher PARTIALLY_REVERSED', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());

    const result = await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Partial correction',
      userId: USER_ID,
      lineIds: ['line-1'],
    });

    expect(result.originalStatus).toBe(VOUCHER_STATUS.PARTIALLY_REVERSED);
    expect(result.pairs).toHaveLength(1);
    expect(mockTx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_org_id: TENANT, id: { in: ['line-1'] } },
        data: expect.objectContaining({ line_status: 'REVERSED' }),
      }),
    );
  });

  it('reverses the last remaining line and the voucher reaches REVERSED', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher(VOUCHER_STATUS.PARTIALLY_REVERSED)]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[1]]);

    const result = await reverseVoucherLinesInTx(mockTx as never, {
      tenantOrgId: TENANT,
      voucherId: VOUCHER_ID,
      reason: 'Finishing correction',
      userId: USER_ID,
      lineIds: ['line-2'],
    });

    expect(result.originalStatus).toBe(VOUCHER_STATUS.REVERSED);
  });

  it('rejects an unknown / already-reversed line id in the selection', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());

    await expect(
      reverseVoucherLinesInTx(mockTx as never, {
        tenantOrgId: TENANT,
        voucherId: VOUCHER_ID,
        reason: 'test',
        userId: USER_ID,
        lineIds: ['line-1', 'line-does-not-exist'],
      }),
    ).rejects.toThrow('VOUCHER_LINE_NOT_REVERSIBLE');
  });
});

describe('reverseVoucherLinesInTx — rejections', () => {
  it('throws when the original voucher is not found', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    await expect(
      reverseVoucherLinesInTx(mockTx as never, {
        tenantOrgId: TENANT, voucherId: VOUCHER_ID, reason: 'test', userId: USER_ID,
      }),
    ).rejects.toThrow('VOUCHER_NOT_FOUND');
  });

  it('throws when there are no POSTED lines to reverse', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([]);

    await expect(
      reverseVoucherLinesInTx(mockTx as never, {
        tenantOrgId: TENANT, voucherId: VOUCHER_ID, reason: 'test', userId: USER_ID,
      }),
    ).rejects.toThrow('NO_POSTED_LINES_TO_REVERSE');
  });

  it('requires a non-empty reason', async () => {
    await expect(
      reverseVoucherLinesInTx(mockTx as never, {
        tenantOrgId: TENANT, voucherId: VOUCHER_ID, reason: '  ', userId: USER_ID,
      }),
    ).rejects.toThrow('REVERSAL_REASON_REQUIRED');
  });

  it('rejects reversing an already-fully-reversed voucher', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher(VOUCHER_STATUS.REVERSED)]);

    await expect(
      reverseVoucherLinesInTx(mockTx as never, {
        tenantOrgId: TENANT, voucherId: VOUCHER_ID, reason: 'test', userId: USER_ID,
      }),
    ).rejects.toThrow(/Invalid voucher status transition/i);
  });
});
