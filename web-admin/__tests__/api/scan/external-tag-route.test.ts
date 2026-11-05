/**
 * @jest-environment node
 *
 * HFC P3b: PUT / DELETE /api/v1/orders/pieces/[pieceId]/external-tag and the PATCH piece route use the same tag
 * errors as batch-update.
 */
import type { NextRequest } from 'next/server';
import { fakeSupabase, type Row } from '../../services/scan-resolve/fake-supabase';

let tables: Record<string, Row[]>;
const updatePiece = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ tenantId: 't1', userId: 'u1', userName: 'Staff' }),
}));
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: async () => null }));
jest.mock('@/lib/utils/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/services/order-piece-service', () => ({
  OrderPieceService: {
    updatePiece: (...a: unknown[]) => updatePiece(...a),
    getPieceById: jest.fn(async () => ({ success: true, piece: { id: 'p1' } })),
  },
}));
jest.mock('@/lib/services/order-change/order-change-legacy-writer-guard', () => ({
  blockCommittedCommercialFields: async () => null,
  blockCommittedCommercialWrite: async () => null,
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeSupabase(tables).client }));

import { PUT, DELETE } from '@/app/api/v1/orders/pieces/[pieceId]/external-tag/route';

function seed(): Record<string, Row[]> {
  return {
    org_orders_mst: [
      { id: 'o1', tenant_org_id: 't1', status: 'processing', current_status: null },
      { id: 'o2', tenant_org_id: 't1', status: 'delivered', current_status: 'delivered' },
    ],
    org_order_items_dtl: [{ id: 'i1', tenant_org_id: 't1', order_id: 'o1' }],
    org_order_item_pieces_dtl: [
      { id: 'p1', tenant_org_id: 't1', order_id: 'o1', order_item_id: 'i1', piece_code: 'ORD-20261031-0001-1-1', deleted_order_change_id: null },
      { id: 'p2', tenant_org_id: 't1', order_id: 'o2', order_item_id: 'i9', piece_code: 'ORD-20261030-0001-1-1', deleted_order_change_id: null },
      { id: 'p3', tenant_org_id: 't1', order_id: 'o1', order_item_id: 'i1', piece_code: 'ORD-20261031-0001-1-2', deleted_order_change_id: 'oc1' },
      { id: 'px', tenant_org_id: 't2', order_id: 'ox', order_item_id: 'ix', piece_code: 'ORD-20261031-0009-1-1', deleted_order_change_id: null },
    ],
  };
}

beforeEach(() => {
  tables = seed();
  updatePiece.mockReset().mockResolvedValue({ success: true, piece: { id: 'p1', barcode: 'TAG-1' } });
});

const req = (body?: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const ctx = (pieceId: string) => ({ params: Promise.resolve({ pieceId }) });
async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('external-tag route', () => {
  it('PUT links a tag through OrderPieceService.updatePiece', async () => {
    const r = await read(await PUT(req({ tag: 'tag-1' }), ctx('p1')));
    expect(r).toMatchObject({ status: 200, body: { success: true, data: { pieceId: 'p1', pieceCode: 'ORD-20261031-0001-1-1', externalTag: 'TAG-1' } } });
    expect(updatePiece).toHaveBeenCalledWith({ pieceId: 'p1', tenantId: 't1', updates: { barcode: 'tag-1', updated_by: 'u1', updated_info: 'Staff' } });
  });
  it('PUT 409 PIECE_TAG_IN_USE with the holder piece code', async () => {
    updatePiece.mockResolvedValue({
      success: false,
      code: 'PIECE_TAG_IN_USE',
      tagIssue: { index: 0, code: 'PIECE_TAG_IN_USE', tag: 'TAG-1', heldByPieceCode: 'ORD-20261031-0002-1-1' },
    });
    const r = await read(await PUT(req({ tag: 'TAG-1' }), ctx('p1')));
    expect(r).toMatchObject({ status: 409, body: { success: false, code: 'PIECE_TAG_IN_USE', tag: 'TAG-1', heldByPieceCode: 'ORD-20261031-0002-1-1' } });
  });
  it('PUT 400 PIECE_TAG_LOOKS_LIKE_CODE', async () => {
    updatePiece.mockResolvedValue({ success: false, code: 'PIECE_TAG_LOOKS_LIKE_CODE', tagIssue: { index: 0, code: 'PIECE_TAG_LOOKS_LIKE_CODE', tag: 'INV-1' } });
    const r = await read(await PUT(req({ tag: 'INV-1' }), ctx('p1')));
    expect(r).toMatchObject({ status: 400, body: { code: 'PIECE_TAG_LOOKS_LIKE_CODE' } });
  });
  it('PUT 409 PIECE_TAG_ORDER_CLOSED on a delivered order, 409 PIECE_TAG_PIECE_REMOVED on a removed piece', async () => {
    expect(await read(await PUT(req({ tag: 'T1' }), ctx('p2')))).toMatchObject({ status: 409, body: { code: 'PIECE_TAG_ORDER_CLOSED' } });
    expect(await read(await PUT(req({ tag: 'T1' }), ctx('p3')))).toMatchObject({ status: 409, body: { code: 'PIECE_TAG_PIECE_REMOVED' } });
    expect(updatePiece).not.toHaveBeenCalled();
  });
  it('404 for another tenant piece; 400 for a bad body', async () => {
    expect((await PUT(req({ tag: 'T1' }), ctx('px'))).status).toBe(404);
    expect((await PUT(req({}), ctx('p1'))).status).toBe(400);
  });
  it('DELETE removes the tag (also allowed on a delivered order)', async () => {
    updatePiece.mockResolvedValue({ success: true, piece: { id: 'p2', barcode: null } });
    const r = await read(await DELETE(req(), ctx('p2')));
    expect(r).toMatchObject({ status: 200, body: { data: { externalTag: null } } });
    expect(updatePiece).toHaveBeenCalledWith(expect.objectContaining({ updates: expect.objectContaining({ barcode: null }) }));
  });
});

describe('PATCH piece route tag errors', () => {
  it('maps a refused tag to the batch-update body', async () => {
    const { PATCH } = await import('@/app/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/route');
    updatePiece.mockResolvedValue({
      success: false,
      error: 'Piece tag already in use',
      code: 'PIECE_TAG_IN_USE',
      tagIssue: { index: 0, code: 'PIECE_TAG_IN_USE', tag: 'TAG-1', heldByPieceCode: 'ORD-20261031-0002-1-1' },
    });
    const res = await PATCH(req({ barcode: 'TAG-1' }), { params: Promise.resolve({ id: 'o1', itemId: 'i1', pieceId: 'p1' }) });
    const r = await read(res);
    expect(r).toMatchObject({ status: 409, body: { success: false, code: 'PIECE_TAG_IN_USE', heldByPieceCode: 'ORD-20261031-0002-1-1' } });
  });
});
