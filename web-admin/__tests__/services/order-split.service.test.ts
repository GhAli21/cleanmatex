/** @jest-environment node */

const T = '11111111-1111-4111-8111-111111111111';
const O = '22222222-2222-4222-8222-222222222222';
const I1 = '33333333-3333-4333-8333-333333333333';
const I2 = '44444444-4444-4444-8444-444444444444';
const U = '55555555-5555-4555-8555-555555555555';
const SUB = '66666666-6666-4666-8666-666666666666';
const ROOT = '77777777-7777-4777-8777-777777777777';

/** Locked parent row (raw lock query) and the root the DB trigger stored on the new sub-order. */
let lockedParent: { id: string; parent_order_id: string | null; root_order_id: string | null };
let storedSubRoot: string | null;

function sqlText(q: unknown): string {
  const sql = q as { strings?: string[]; sql?: string };
  return (sql?.strings ?? [sql?.sql ?? '']).join('?');
}

const tx = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  org_orders_mst: { findFirstOrThrow: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  org_order_items_dtl: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  org_order_history: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/services/order-numbering', () => ({
  nextSubOrderNoWithTx: jest.fn(),
  parseOrderNumberError: (m: string) => (/ORD_[A-Z_]+/.exec(m ?? '') ?? [null])[0],
}));
jest.mock('@/lib/services/order-created-pos-session', () => ({
  findOpenPosSessionIdForOrder: jest.fn().mockResolvedValue(null),
  stampCreatedPosSession: jest.fn(),
}));
jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: jest.fn().mockResolvedValue({}),
}));

import { prisma } from '@/lib/db/prisma';
import { nextSubOrderNoWithTx } from '@/lib/services/order-numbering';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import {
  splitOrderUnits,
  piecesToSplitLines,
  buildSplitLines,
  ORDER_SPLIT_ERRORS,
} from '@/lib/services/order-split.service';

const p = prisma as unknown as {
  org_orders_mst: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

const parent = {
  id: O,
  tenant_org_id: T,
  order_no: 'ORD-20261030-0007',
  branch_id: null,
  customer_id: 'c1',
  status: 'processing',
  rec_status: 1,
  customer_details: null,
};

function item(id: string, quantity: number, metadata: Record<string, unknown> = {}) {
  return { id, quantity, metadata, product_name: 'Shirt', order_item_srno: 'ORD-20261030-0007-1', barcode: 'ORD-20261030-0007-1' };
}

beforeEach(() => {
  jest.clearAllMocks();
  p.org_orders_mst.findFirst.mockResolvedValue({ branch_id: null });
  p.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  lockedParent = { id: O, parent_order_id: null, root_order_id: null };
  storedSubRoot = O;
  tx.$queryRaw.mockImplementation(async (q: unknown) => {
    const text = sqlText(q);
    if (text.includes('SELECT root_order_id FROM public.org_orders_mst')) return [{ root_order_id: storedSubRoot }];
    if (text.includes('parent_order_id, root_order_id FROM public.org_orders_mst')) return [lockedParent];
    return [{ id: O }];
  });
  tx.org_orders_mst.findFirstOrThrow.mockResolvedValue(parent);
  tx.org_orders_mst.create.mockResolvedValue({ id: SUB, order_no: 'ORD-20261030-0007-S1' });
  (nextSubOrderNoWithTx as jest.Mock).mockResolvedValue('ORD-20261030-0007-S1');
});

describe('piecesToSplitLines', () => {
  it('groups piece ids by item and sorts piece numbers', () => {
    expect(piecesToSplitLines([`${I1}-piece-3`, `${I1}-piece-1`, `${I2}-piece-2`, `${I1}-piece-3`])).toEqual([
      { itemId: I1, pieceSeqs: [1, 3] },
      { itemId: I2, pieceSeqs: [2] },
    ]);
  });
  it('rejects malformed ids', () => {
    expect(buildSplitLines({ pieceIds: ['x-piece-1'] })).toMatchObject({ ok: false, errorCode: ORDER_SPLIT_ERRORS.BAD_PIECE_ID });
    expect(buildSplitLines({ pieceIds: [`${I1}-piece-0`] })).toMatchObject({ ok: false });
  });
});

describe('splitOrderUnits', () => {
  it('splits selected pieces in one transaction, number taken after validation, money untouched', async () => {
    tx.org_order_items_dtl.findMany
      .mockResolvedValueOnce([item(I1, 3)])
      .mockResolvedValueOnce([item(I1, 3), item(I2, 2)]);

    const result = await splitOrderUnits({
      tenantId: T,
      orderId: O,
      userId: U,
      reason: 'Delicate',
      lines: [{ itemId: I1, pieceSeqs: [2, 3] }],
    });

    expect(result).toEqual({
      success: true,
      suborder: { id: SUB, order_no: 'ORD-20261030-0007-S1' },
      rootOrderId: O,
      movedUnits: 2,
    });
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(nextSubOrderNoWithTx).toHaveBeenCalledWith(tx, T, O);

    const header = tx.org_orders_mst.create.mock.calls[0][0].data;
    expect(header).toMatchObject({ tenant_org_id: T, parent_order_id: O, order_no: 'ORD-20261030-0007-S1', order_subtype: 'split_child' });

    const line = tx.org_order_items_dtl.create.mock.calls[0][0].data;
    expect(line).toMatchObject({ tenant_org_id: T, order_id: SUB, quantity: 2, price_per_unit: 0, total_price: 0 });
    // HFC P3: serials are unique per tenant, so the sub-order line gets its own serial; the parent's is in metadata.
    expect(line).toMatchObject({ order_item_srno: 'ORD-20261030-0007-S1-1', barcode: 'ORD-20261030-0007-S1-1' });
    expect(line.metadata).toMatchObject({
      split_from_item_id: I1,
      split_from_item_srno: 'ORD-20261030-0007-1',
      split_root_order_id: O,
      split_piece_seqs: [2, 3],
      money_on_parent: true,
    });

    const parentLine = tx.org_order_items_dtl.updateMany.mock.calls[0][0];
    expect(parentLine.where).toEqual({ tenant_org_id: T, order_id: O, id: I1 });
    expect(parentLine.data).not.toHaveProperty('quantity');
    expect(parentLine.data).not.toHaveProperty('total_price');
    expect(parentLine.data.metadata).toMatchObject({ split_out_qty: 2, split_out_piece_seqs: [2, 3] });

    expect(tx.org_orders_mst.updateMany.mock.calls[0][0].where).toEqual({ tenant_org_id: T, id: O });
    expect(tx.org_order_history.create.mock.calls[0][0].data).toMatchObject({ tenant_org_id: T, order_id: O, action_type: 'SPLIT' });
    expect(recalculateOrderFinancialSnapshotTx).toHaveBeenCalledWith(tx, T, SUB);
  });

  it('splitting a sub-order keeps the family root (A-28)', async () => {
    lockedParent = { id: O, parent_order_id: ROOT, root_order_id: ROOT };
    storedSubRoot = ROOT;
    tx.org_order_items_dtl.findMany.mockResolvedValueOnce([item(I1, 3)]).mockResolvedValueOnce([item(I1, 3)]);
    (nextSubOrderNoWithTx as jest.Mock).mockResolvedValueOnce('ORD-20261030-0007-S2');
    tx.org_orders_mst.create.mockResolvedValueOnce({ id: SUB, order_no: 'ORD-20261030-0007-S2' });

    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [1] }] });

    expect(result).toMatchObject({ success: true, rootOrderId: ROOT, suborder: { order_no: 'ORD-20261030-0007-S2' } });
    expect(tx.org_orders_mst.create.mock.calls[0][0].data).toMatchObject({ parent_order_id: O });
    expect(tx.org_order_items_dtl.create.mock.calls[0][0].data.metadata).toMatchObject({ split_root_order_id: ROOT });
    expect(tx.org_order_history.create.mock.calls[0][0].data.payload).toMatchObject({ root_order_id: ROOT });
  });

  it('fails closed when the new sub-order did not get the expected root', async () => {
    storedSubRoot = null;
    tx.org_order_items_dtl.findMany.mockResolvedValueOnce([item(I1, 3)]).mockResolvedValueOnce([item(I1, 3)]);
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [1] }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.NUMBERING_FAILED });
    expect(tx.org_order_items_dtl.create).not.toHaveBeenCalled();
  });

  it('refuses a parent with a broken family (parent but no root)', async () => {
    lockedParent = { id: O, parent_order_id: ROOT, root_order_id: null };
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [1] }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.NUMBERING_FAILED });
    expect(nextSubOrderNoWithTx).not.toHaveBeenCalled();
    expect(tx.org_orders_mst.create).not.toHaveBeenCalled();
  });

  it('refuses pieces that were already split out', async () => {
    tx.org_order_items_dtl.findMany.mockResolvedValueOnce([item(I1, 3, { split_out_qty: 1, split_out_piece_seqs: [2] })]);
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [2] }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.UNITS_NOT_AVAILABLE });
    expect(nextSubOrderNoWithTx).not.toHaveBeenCalled();
  });

  it('refuses a split that would empty the order', async () => {
    tx.org_order_items_dtl.findMany.mockResolvedValueOnce([item(I1, 2)]).mockResolvedValueOnce([item(I1, 2)]);
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1 }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.WHOLE_ORDER });
    expect(nextSubOrderNoWithTx).not.toHaveBeenCalled();
  });

  it('refuses items of another order', async () => {
    tx.org_order_items_dtl.findMany.mockResolvedValueOnce([]);
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I2 }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.ITEM_NOT_FOUND });
  });

  it('returns not found for an order of another tenant', async () => {
    p.org_orders_mst.findFirst.mockResolvedValueOnce(null);
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1 }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.ORDER_NOT_FOUND });
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it('maps DB numbering errors and lock timeouts', async () => {
    tx.org_order_items_dtl.findMany.mockResolvedValue([item(I1, 3)]);
    (nextSubOrderNoWithTx as jest.Mock).mockRejectedValueOnce(new Error('ORD_SPLIT_DEPTH_EXCEEDED: too deep'));
    const r1 = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [1] }] });
    expect(r1).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.NUMBERING_FAILED });

    p.$transaction.mockRejectedValueOnce(new Error('canceling statement due to lock timeout'));
    const r2 = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1, pieceSeqs: [1] }] });
    expect(r2).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.BUSY });
  });

  it('refuses closed orders', async () => {
    tx.org_orders_mst.findFirstOrThrow.mockResolvedValueOnce({ ...parent, status: 'delivered' });
    const result = await splitOrderUnits({ tenantId: T, orderId: O, userId: U, reason: 'x', lines: [{ itemId: I1 }] });
    expect(result).toMatchObject({ success: false, errorCode: ORDER_SPLIT_ERRORS.ORDER_CLOSED });
  });
});
