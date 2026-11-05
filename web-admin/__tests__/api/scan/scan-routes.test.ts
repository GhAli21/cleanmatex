/**
 * @jest-environment node
 *
 * HFC P3b: POST /api/v1/scan/resolve, GET /api/v1/orders/lookup, GET /api/v1/orders/pieces/lookup,
 * POST /api/v1/orders/[id]/items/[itemId]/pieces/scan (plan section 7.1).
 */
import { NextRequest, NextResponse } from 'next/server';
import { fakeSupabase, type Row } from '../../services/scan-resolve/fake-supabase';

let tables: Record<string, Row[]>;
const updatePiece = jest.fn();
let limited: NextResponse | null = null;

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ tenantId: 't1', userId: 'u1', userName: 'Staff' }),
}));
jest.mock('@/lib/middleware/rate-limit', () => ({ checkScanRateLimit: async () => limited }));
jest.mock('@/lib/utils/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/services/order-piece-service', () => ({
  OrderPieceService: { updatePiece: (...a: unknown[]) => updatePiece(...a) },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeSupabase(tables).client }));

import { POST as resolvePOST } from '@/app/api/v1/scan/resolve/route';
import { GET as orderLookup } from '@/app/api/v1/orders/lookup/route';
import { GET as pieceLookup } from '@/app/api/v1/orders/pieces/lookup/route';
import { POST as pieceScan } from '@/app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route';

function seed(): Record<string, Row[]> {
  return {
    org_orders_mst: [
      { id: 'o1', tenant_org_id: 't1', order_no: 'ORD-20261031-0001', status: 'processing', current_status: null, branch_id: 'b1', parent_order_id: null },
      { id: 'o9', tenant_org_id: 't2', order_no: 'ORD-20261031-0009', status: 'processing', current_status: null, branch_id: 'b9', parent_order_id: null },
    ],
    org_order_items_dtl: [
      { id: 'i1', tenant_org_id: 't1', order_id: 'o1', order_item_srno: 'ORD-20261031-0001-1', product_name: 'Shirt', product_name2: null },
      { id: 'i2', tenant_org_id: 't1', order_id: 'o1', order_item_srno: 'ORD-20261031-0001-2', product_name: 'Pants', product_name2: null },
    ],
    org_order_item_pieces_dtl: [
      { id: 'p1', tenant_org_id: 't1', order_id: 'o1', order_item_id: 'i1', piece_seq: 1, piece_code: 'ORD-20261031-0001-1-1', barcode: 'TAG-1', piece_status: 'processing', tag_released_at: null, deleted_order_change_id: null },
    ],
  };
}

beforeEach(() => {
  tables = seed();
  limited = null;
  updatePiece.mockReset().mockResolvedValue({ success: true, piece: { id: 'p1', scan_state: 'scanned' } });
});

const post = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const get = (url: string) => new NextRequest(new URL(url, 'http://localhost'));
async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('POST /api/v1/scan/resolve', () => {
  it('200 with the ScanResult', async () => {
    const r = await read(await resolvePOST(post({ raw: 'tag-1', context: 'assembly' })));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, data: { kind: 'PIECE', matchedBy: 'EXTERNAL_TAG', context: 'assembly', piece: { pieceCode: 'ORD-20261031-0001-1-1' } } });
  });
  it('400 VALIDATION_ERROR for a bad body', async () => {
    for (const b of [null, {}, { raw: '' }, { raw: 'x'.repeat(129) }, { raw: 'x', context: 'bad' }]) {
      const r = await read(await resolvePOST(post(b)));
      expect(r).toMatchObject({ status: 400, body: { success: false, code: 'VALIDATION_ERROR' } });
    }
  });
  it('404 SCAN_NOT_FOUND for another tenant, same as missing', async () => {
    const other = await read(await resolvePOST(post({ raw: 'ORD-20261031-0009' })));
    const missing = await read(await resolvePOST(post({ raw: 'ORD-20261031-0404' })));
    expect(other).toEqual(missing);
    expect(other).toMatchObject({ status: 404, body: { code: 'SCAN_NOT_FOUND' } });
  });
  it('422 SCAN_UNSUPPORTED_PAYLOAD', async () => {
    const r = await read(await resolvePOST(post({ raw: 'CMX9:PEC:X' })));
    expect(r).toMatchObject({ status: 422, body: { code: 'SCAN_UNSUPPORTED_PAYLOAD' } });
  });
  it('returns the rate-limit response when limited', async () => {
    limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    expect((await resolvePOST(post({ raw: 'TAG-1' }))).status).toBe(429);
  });
});

describe('GET /api/v1/orders/lookup', () => {
  it('finds an exact order number', async () => {
    const r = await read(await orderLookup(get('/api/v1/orders/lookup?code=ord-20261031-0001')));
    expect(r).toMatchObject({ status: 200, body: { success: true, data: { order: { id: 'o1', orderNo: 'ORD-20261031-0001' } } } });
  });
  it('400 for a value that is not an order number, 404 when missing', async () => {
    expect((await orderLookup(get('/api/v1/orders/lookup?code=TAG-1'))).status).toBe(400);
    const r = await read(await orderLookup(get('/api/v1/orders/lookup?code=ORD-20261031-0009')));
    expect(r).toMatchObject({ status: 404, body: { code: 'ORDER_NOT_FOUND' } });
  });
});

describe('GET /api/v1/orders/pieces/lookup', () => {
  it('finds by piece code and by tag', async () => {
    const byCode = await read(await pieceLookup(get('/api/v1/orders/pieces/lookup?code=ORD-20261031-0001-1-1')));
    expect(byCode).toMatchObject({ status: 200, body: { data: { piece: { id: 'p1' }, item: { id: 'i1' }, order: { id: 'o1' } } } });
    const byTag = await read(await pieceLookup(get('/api/v1/orders/pieces/lookup?code=tag-1')));
    expect(byTag.body.data.matchedBy).toBe('EXTERNAL_TAG');
  });
  it('404 PIECE_NOT_FOUND for an order number or unknown value', async () => {
    for (const code of ['ORD-20261031-0001', 'NOPE']) {
      const r = await read(await pieceLookup(get(`/api/v1/orders/pieces/lookup?code=${code}`)));
      expect(r).toMatchObject({ status: 404, body: { code: 'PIECE_NOT_FOUND' } });
    }
  });
});

describe('POST pieces/scan (refactored)', () => {
  const scan = (body: unknown, itemId = 'i1') =>
    pieceScan(post(body), { params: Promise.resolve({ id: 'o1', itemId }) });

  it('matches the piece code and keeps the response shape', async () => {
    const r = await read(await scan({ barcode: 'ORD-20261031-0001-1-1' }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, scanned: false, piece: { id: 'p1', piece_code: 'ORD-20261031-0001-1-1' } });
  });
  it('matches the live tag in any case, and updates when asked', async () => {
    const r = await read(await scan({ barcode: ' tag-1 ', updateStatus: true }));
    expect(r.body).toMatchObject({ success: true, scanned: true });
    expect(updatePiece).toHaveBeenCalledWith(expect.objectContaining({ pieceId: 'p1', tenantId: 't1' }));
  });
  it('404 when the piece is on another line', async () => {
    const r = await read(await scan({ barcode: 'TAG-1' }, 'i2'));
    expect(r.status).toBe(404);
  });
  it('400 when barcode is missing', async () => {
    expect((await scan({})).status).toBe(400);
  });
});
