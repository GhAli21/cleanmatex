/**
 * @jest-environment node
 *
 * HFC P3: POST /api/v1/orders/[id]/batch-update returns clear piece tag errors and saves nothing when any tag fails
 * (A-38). 400 PIECE_TAG_INVALID / PIECE_TAG_LOOKS_LIKE_CODE, 409 PIECE_TAG_IN_USE / PIECE_TAG_DUPLICATE_IN_BATCH.
 */
import { NextResponse } from 'next/server';

const batchUpdatePiecesBulk = jest.fn();
let holders: Array<Record<string, unknown>> = [];
let holderOrders: Array<Record<string, unknown>> = [];
const fromCalls: string[] = [];

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ tenantId: 't1', userId: 'u1', userName: 'Staff' }),
}));
jest.mock('@/lib/middleware/rate-limit', () => ({ checkAPIRateLimitTenant: async () => null }));
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: async () => null }));
jest.mock('@/lib/utils/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  executeAction: jest.fn(),
  listAvailableActions: jest.fn(async () => ({ actions: [], stateVersion: 1 })),
}));
jest.mock('@/lib/services/order-change/order-change-legacy-writer-guard', () => ({
  blockCommittedCommercialWrite: async () => null,
  committedCommercialEchoChanged: () => false,
}));
jest.mock('@/lib/services/order-piece-service', () => ({
  OrderPieceService: { batchUpdatePiecesBulk: (...a: unknown[]) => batchUpdatePiecesBulk(...a) },
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from(table: string) {
      fromCalls.push(table);
      const result = () => {
        if (table === 'org_orders_mst') return { data: holderOrders, error: null };
        if (table === 'org_order_item_pieces_dtl') return { data: holders, error: null };
        return { data: [], error: null };
      };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'update', 'order']) b[m] = () => b;
      b.is = () => b;
      b.single = async () => {
        if (table === 'org_order_item_pieces_dtl') return { data: { piece_status: 'processing', is_ready: false }, error: null };
        if (table === 'org_orders_mst') return { data: { id: 'o1', tenant_org_id: 't1' }, error: null };
        return result();
      };
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko);
      return b;
    },
  }),
}));

import { POST } from '@/app/api/v1/orders/[id]/batch-update/route';
import { resetCodePrefixCache } from '@/lib/services/piece-code/piece-code.service';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const P3 = '33333333-3333-4333-8333-333333333333';

async function call(updates: unknown[]) {
  const request = { json: async () => ({ updates }) } as never;
  const res = (await POST(request, { params: Promise.resolve({ id: 'o1' }) })) as NextResponse;
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  resetCodePrefixCache();
  holders = [];
  holderOrders = [{ id: 'o9', status: 'processing' }];
  fromCalls.length = 0;
  batchUpdatePiecesBulk.mockReset().mockResolvedValue({ success: true, updated: 1 });
});

describe('batch-update piece tags', () => {
  it('400 PIECE_TAG_INVALID for a bad tag, before any write', async () => {
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'A\tB' }]);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'PIECE_TAG_INVALID', tag: 'A\tB', reason: 'PIECE_TAG_BAD_CHARACTERS', piecesUpdated: 0 });
    expect(batchUpdatePiecesBulk).not.toHaveBeenCalled();
  });

  it('409 PIECE_TAG_IN_USE when another live piece has the tag', async () => {
    holders = [{ id: P2, order_id: 'o9', order_item_id: 'i9', piece_seq: 1, piece_code: 'ORD-9-1-1', barcode: 'TAG-1' }];
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: ' TAG-1 ' }]);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'PIECE_TAG_IN_USE', tag: 'TAG-1', heldByPieceCode: 'ORD-9-1-1' });
    expect(batchUpdatePiecesBulk).not.toHaveBeenCalled();
  });

  it('409 when the same tag is on two pieces of the batch', async () => {
    const r = await call([
      { pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'TAG-1' },
      { pieceId: P2, itemId: 'i1', pieceNumber: 2, barcode: 'TAG-1' },
    ]);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'PIECE_TAG_DUPLICATE_IN_BATCH', tag: 'TAG-1' });
    expect(batchUpdatePiecesBulk).not.toHaveBeenCalled();
  });

  it('400 PIECE_TAG_LOOKS_LIKE_CODE for a tag shaped like one of our codes', async () => {
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'ord-20261101-0001-1' }]);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'PIECE_TAG_LOOKS_LIKE_CODE' });
    expect(batchUpdatePiecesBulk).not.toHaveBeenCalled();
  });

  it('checks every tag first and saves nothing when one fails; lists all problems', async () => {
    holders = [{ id: P2, order_id: 'o9', order_item_id: 'i9', piece_seq: 1, piece_code: 'ORD-9-1-1', barcode: 'TAG-9' }];
    const r = await call([
      { pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'GOOD-1' },
      { pieceId: P3, itemId: 'i1', pieceNumber: 2, barcode: 'tag-9' },
      { pieceId: P1, itemId: 'i1', pieceNumber: 3, barcode: 'BAD TAG' },
    ]);
    expect(r.status).toBe(400); // a format problem wins the status; all are listed
    expect(r.body.issues.map((i: { code: string }) => i.code)).toEqual(['PIECE_TAG_IN_USE', 'PIECE_TAG_INVALID']);
    expect(batchUpdatePiecesBulk).not.toHaveBeenCalled();
  });

  it('a tag on a piece of a delivered order is free (A-35)', async () => {
    holders = [{ id: P2, order_id: 'o9', order_item_id: 'i9', piece_seq: 1, piece_code: 'ORD-9-1-1', barcode: 'TAG-1' }];
    holderOrders = [{ id: 'o9', status: 'delivered' }];
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'tag-1' }]);
    expect(r.status).toBe(200);
    expect(batchUpdatePiecesBulk.mock.calls[0][0].updates[0].updates.barcode).toBe('TAG-1');
  });

  it('saves the trimmed, upper-cased tag when only the same piece has it', async () => {
    holders = [{ id: P1, order_id: 'o1', order_item_id: 'i1', piece_seq: 1, piece_code: 'ORD-1-1-1', barcode: 'TAG-1' }];
    holderOrders = [{ id: 'o1', status: 'processing' }];
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'tag-1 ' }]);
    expect(r.status).toBe(200);
    const sent = batchUpdatePiecesBulk.mock.calls[0][0].updates[0].updates;
    expect(sent.barcode).toBe('TAG-1');
  });

  it('maps a DB unique error from a racing write to 409', async () => {
    batchUpdatePiecesBulk.mockResolvedValue({
      success: false,
      updated: 0,
      errors: [{ pieceId: P1, error: 'duplicate key value violates unique constraint "uq_ord_piece_barcode"' }],
    });
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, barcode: 'TAG-2' }]);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'PIECE_TAG_IN_USE', piecesUpdated: 0, partial: false });
  });

  it('skips the tag lookup when no update carries a tag', async () => {
    const r = await call([{ pieceId: P1, itemId: 'i1', pieceNumber: 1, notes: 'x' }]);
    expect(r.status).toBe(200);
    expect(fromCalls.filter((t) => t === 'org_order_item_pieces_dtl')).toHaveLength(1); // current-state read only
  });
});
