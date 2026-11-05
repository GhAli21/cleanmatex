/**
 * HFC P3b: the single-piece PATCH path (OrderPieceService.updatePiece) checks the external tag like batch-update.
 */
import { fakeSupabase, type Row } from '../scan-resolve/fake-supabase';

const T1 = 'tenant-1';
let tables: Record<string, Row[]>;
let fake: ReturnType<typeof fakeSupabase>;

// Prisma is never reached by updatePiece's tag path; stub it so the test needs no generated client.
jest.mock('@prisma/client', () => ({ Prisma: { sql: jest.fn(), join: jest.fn() }, PrismaClient: jest.fn() }));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => fake.client),
}));

import { OrderPieceService } from '@/lib/services/order-piece-service';
import { resetCodePrefixCache } from '@/lib/services/piece-code/piece-code.service';

function seed() {
  return {
    sys_doc_seq_type_cd: [{ prefix: 'ORD', type_prefix: 'ORD' }, { prefix: 'INV', type_prefix: 'INV' }],
    org_orders_mst: [
      { id: 'o1', tenant_org_id: T1, status: 'processing', current_status: 'processing' },
      { id: 'o2', tenant_org_id: T1, status: 'delivered', current_status: 'delivered' },
    ],
    org_order_item_pieces_dtl: [
      { id: 'p1', tenant_org_id: T1, order_id: 'o1', order_item_id: 'i1', piece_seq: 1, piece_code: 'ORD-20261031-0001-1-1', barcode: null, deleted_order_change_id: null },
      { id: 'p2', tenant_org_id: T1, order_id: 'o1', order_item_id: 'i1', piece_seq: 2, piece_code: 'ORD-20261031-0001-1-2', barcode: 'TAG-1', deleted_order_change_id: null },
      { id: 'p3', tenant_org_id: T1, order_id: 'o2', order_item_id: 'i2', piece_seq: 1, piece_code: 'ORD-20261030-0001-1-1', barcode: 'OLD-9', deleted_order_change_id: null },
    ],
    org_order_piece_hist_tr: [],
  } as Record<string, Row[]>;
}

beforeEach(() => {
  resetCodePrefixCache();
  tables = seed();
  fake = fakeSupabase(tables);
  jest.spyOn(OrderPieceService, 'attachPieceLevelPreferencesFromDtl').mockImplementation(async (_s, _t, pieces) => pieces);
  jest.spyOn(OrderPieceService, 'syncItemQuantityReady').mockResolvedValue({ success: true, quantityReady: 0 } as never);
});
afterEach(() => jest.restoreAllMocks());

const piece = (id: string) => tables.org_order_item_pieces_dtl.find((p) => p.id === id)!;

describe('updatePiece external tag', () => {
  it('normalises and saves a free tag', async () => {
    const res = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: '  tag-2 ' } });
    expect(res.success).toBe(true);
    expect(piece('p1').barcode).toBe('TAG-2');
  });

  it('refuses a tag held by another live piece, with the holder code, and saves nothing', async () => {
    const res = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: 'tag-1' } });
    expect(res).toMatchObject({ success: false, code: 'PIECE_TAG_IN_USE', tagIssue: { tag: 'TAG-1', heldByPieceCode: 'ORD-20261031-0001-1-2' } });
    expect(piece('p1').barcode).toBeNull();
    expect(fake.updates).toHaveLength(0);
  });

  it('allows a tag whose holder is on a delivered order (released)', async () => {
    const res = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: 'OLD-9' } });
    expect(res.success).toBe(true);
  });

  it('allows re-saving the piece’s own tag', async () => {
    const res = await OrderPieceService.updatePiece({ pieceId: 'p2', tenantId: T1, updates: { barcode: 'TAG-1' } });
    expect(res.success).toBe(true);
  });

  it('refuses bad characters and code look-alikes', async () => {
    const bad = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: 'TAG 1' } });
    expect(bad).toMatchObject({ success: false, code: 'PIECE_TAG_INVALID' });
    const code = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: 'INV-0001' } });
    expect(code).toMatchObject({ success: false, code: 'PIECE_TAG_LOOKS_LIKE_CODE' });
    expect(fake.updates).toHaveLength(0);
  });

  it('clears the tag for blank or null', async () => {
    expect((await OrderPieceService.updatePiece({ pieceId: 'p2', tenantId: T1, updates: { barcode: '  ' } })).success).toBe(true);
    expect(piece('p2').barcode).toBeNull();
    piece('p2').barcode = 'TAG-1';
    expect((await OrderPieceService.updatePiece({ pieceId: 'p2', tenantId: T1, updates: { barcode: null } })).success).toBe(true);
    expect(piece('p2').barcode).toBeNull();
  });

  it('does not touch the tag when barcode is not sent', async () => {
    const res = await OrderPieceService.updatePiece({ pieceId: 'p2', tenantId: T1, updates: { notes: 'x' } });
    expect(res.success).toBe(true);
    expect(piece('p2').barcode).toBe('TAG-1');
    expect(fake.updates[0].patch).not.toHaveProperty('barcode');
  });

  it('maps a same-instant DB unique violation to PIECE_TAG_IN_USE', async () => {
    const realFrom = (fake.client as unknown as { from: (t: string) => Record<string, unknown> }).from;
    let calls = 0;
    (fake.client as unknown as { from: unknown }).from = (t: string) => {
      const b = realFrom(t);
      if (t === 'org_order_item_pieces_dtl') {
        calls += 1;
        const original = b.update as (p: Row) => unknown;
        b.update = () => {
          void original;
          const chain: Record<string, unknown> = {};
          chain.eq = () => chain;
          chain.select = () => chain;
          chain.single = async () => ({ data: null, error: { message: 'duplicate key value violates unique constraint "uq_ord_piece_barcode"' } });
          return chain;
        };
      }
      return b;
    };
    const res = await OrderPieceService.updatePiece({ pieceId: 'p1', tenantId: T1, updates: { barcode: 'TAG-NEW' } });
    expect(calls).toBeGreaterThan(0);
    expect(res).toMatchObject({ success: false, code: 'PIECE_TAG_IN_USE' });
  });
});
