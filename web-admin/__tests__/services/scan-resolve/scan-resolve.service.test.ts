/**
 * HFC P3b: ScanResolveService (plan section 6.5).
 */
import { ScanResolveService, SCAN_ERROR_CODES, scanErrorStatus } from '@/lib/services/scan-resolve/scan-resolve.service';
import { fakeSupabase } from './fake-supabase';

const T1 = 'tenant-1';
const T2 = 'tenant-2';

function data() {
  return {
    org_orders_mst: [
      { id: 'o1', tenant_org_id: T1, order_no: 'ORD-20261031-0007', status: 'processing', current_status: 'processing', branch_id: 'b1', parent_order_id: null },
      { id: 'o2', tenant_org_id: T1, order_no: 'ORD-20261031-0007-S1', status: 'ready', current_status: null, branch_id: 'b1', parent_order_id: 'o1' },
      { id: 'o9', tenant_org_id: T2, order_no: 'ORD-20261031-0099', status: 'processing', current_status: null, branch_id: 'bx', parent_order_id: null },
    ],
    org_order_items_dtl: [
      { id: 'i1', tenant_org_id: T1, order_id: 'o1', order_item_srno: 'ORD-20261031-0007-1', product_name: 'Shirt', product_name2: 'قميص' },
      { id: 'i9', tenant_org_id: T2, order_id: 'o9', order_item_srno: 'ORD-20261031-0099-1', product_name: 'Coat', product_name2: null },
    ],
    org_order_item_pieces_dtl: [
      { id: 'p1', tenant_org_id: T1, order_id: 'o1', order_item_id: 'i1', piece_seq: 1, piece_code: 'ORD-20261031-0007-1-1', barcode: 'TAG-77', piece_status: 'processing', tag_released_at: null, deleted_order_change_id: null },
      { id: 'p2', tenant_org_id: T1, order_id: 'o1', order_item_id: 'i1', piece_seq: 2, piece_code: 'ORD-20261031-0007-1-2', barcode: 'OLD-1', piece_status: 'processing', tag_released_at: '2026-10-30T00:00:00Z', deleted_order_change_id: null },
      { id: 'p3', tenant_org_id: T1, order_id: 'o1', order_item_id: 'i1', piece_seq: 3, piece_code: 'ORD-20261031-0007-1-3', barcode: 'GONE-1', piece_status: 'processing', tag_released_at: null, deleted_order_change_id: 'oc1' },
      { id: 'p9', tenant_org_id: T2, order_id: 'o9', order_item_id: 'i9', piece_seq: 1, piece_code: 'ORD-20261031-0099-1-1', barcode: 'TAG-99', piece_status: 'processing', tag_released_at: null, deleted_order_change_id: null },
    ],
  };
}

async function resolve(raw: string, tenant = T1) {
  const { client, queries } = fakeSupabase(data());
  const out = await ScanResolveService.resolve(client, tenant, raw, 'assembly');
  return { out, queries };
}

describe('ScanResolveService.resolve', () => {
  it('finds an order by number (any case, spaces, CR/LF)', async () => {
    const { out } = await resolve('  ord-20261031-0007\r\n');
    expect(out).toMatchObject({ ok: true, result: { kind: 'ORDER', matchedBy: 'ORDER_NO', context: 'assembly', order: { id: 'o1', orderNo: 'ORD-20261031-0007', branchId: 'b1', parentOrderNo: null } } });
  });

  it('gives the parent number of a sub-order', async () => {
    const { out } = await resolve('ORD-20261031-0007-S1');
    expect(out).toMatchObject({ ok: true, result: { order: { id: 'o2', parentOrderNo: 'ORD-20261031-0007', status: 'ready' } } });
  });

  it('finds a line by its code', async () => {
    const { out } = await resolve('ORD-20261031-0007-1');
    expect(out).toMatchObject({ ok: true, result: { kind: 'ORDER_ITEM', matchedBy: 'ITEM_SRNO', item: { id: 'i1', name: 'Shirt', name2: 'قميص' }, order: { id: 'o1' } } });
  });

  it('finds a piece by its code, with Arabic-Indic digits and an AIM prefix', async () => {
    const { out } = await resolve(']C0ORD-٢٠٢٦١٠٣١-٠٠٠٧-١-١');
    expect(out).toMatchObject({ ok: true, result: { kind: 'PIECE', matchedBy: 'PIECE_CODE', piece: { id: 'p1', pieceCode: 'ORD-20261031-0007-1-1', externalTag: 'TAG-77', removed: false }, item: { id: 'i1' }, order: { id: 'o1' } } });
  });

  it('finds a piece by a staff QR payload', async () => {
    const { out } = await resolve('CMX1:PEC:ORD-20261031-0007-1-1');
    expect(out).toMatchObject({ ok: true, result: { kind: 'PIECE', matchedBy: 'CMX_QR', piece: { id: 'p1' } } });
    const order = await resolve('cmx1:ord:ord-20261031-0007');
    expect(order.out).toMatchObject({ ok: true, result: { kind: 'ORDER', matchedBy: 'CMX_QR' } });
  });

  it('refuses unknown or mismatched payloads with SCAN_UNSUPPORTED_PAYLOAD', async () => {
    for (const raw of ['CMX2:PEC:ORD-20261031-0007-1-1', 'CMX1:INV:INV-1', 'CMX1:PEC:ORD-20261031-0007', 'CMX1:PEC:']) {
      const { out } = await resolve(raw);
      expect(out).toEqual({ ok: false, code: SCAN_ERROR_CODES.UNSUPPORTED_PAYLOAD });
    }
  });

  it('finds a piece by its live external tag (upper-cased)', async () => {
    const { out } = await resolve(' tag-77 ');
    expect(out).toMatchObject({ ok: true, result: { kind: 'PIECE', matchedBy: 'EXTERNAL_TAG', code: 'TAG-77', piece: { id: 'p1' } } });
  });

  it('does not find released or removed tags', async () => {
    expect((await resolve('OLD-1')).out).toEqual({ ok: false, code: 'SCAN_NOT_FOUND' });
    expect((await resolve('GONE-1')).out).toEqual({ ok: false, code: 'SCAN_NOT_FOUND' });
  });

  it('still finds a removed piece by its code and says it is removed', async () => {
    const { out } = await resolve('ORD-20261031-0007-1-3');
    expect(out).toMatchObject({ ok: true, result: { piece: { id: 'p3', removed: true, externalTag: null } } });
  });

  it('gives the same SCAN_NOT_FOUND for another tenant and for a missing code', async () => {
    for (const raw of ['ORD-20261031-0099', 'ORD-20261031-0099-1', 'ORD-20261031-0099-1-1', 'TAG-99', 'ORD-20261031-1234', 'NOPE']) {
      expect((await resolve(raw)).out).toEqual({ ok: false, code: 'SCAN_NOT_FOUND' });
    }
  });

  it('scopes every query by tenant', async () => {
    const { queries } = await resolve('ORD-20261031-0007-1-1');
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q.filters).toContainEqual(['eq', 'tenant_org_id', T1]);
  });

  it('looks a code-shaped value up as a code only, never as a tag', async () => {
    const { queries } = await resolve('ORD-20261031-0007-1-9');
    expect(queries.some((q) => q.filters.some(([, c]) => c === 'barcode'))).toBe(false);
  });

  it('rejects empty and over-long input with SCAN_INVALID', async () => {
    expect((await resolve('  \r\n')).out).toEqual({ ok: false, code: 'SCAN_INVALID' });
    expect((await resolve('A'.repeat(129))).out).toEqual({ ok: false, code: 'SCAN_INVALID' });
  });

  it('a tag with characters a tag cannot have is not found (no format hint)', async () => {
    expect((await resolve('TAG 77')).out).toEqual({ ok: false, code: 'SCAN_NOT_FOUND' });
  });

  it('maps error codes to HTTP statuses', () => {
    expect(scanErrorStatus('SCAN_NOT_FOUND')).toBe(404);
    expect(scanErrorStatus('SCAN_AMBIGUOUS')).toBe(409);
    expect(scanErrorStatus('SCAN_UNSUPPORTED_PAYLOAD')).toBe(422);
    expect(scanErrorStatus('SCAN_INVALID')).toBe(400);
  });
});
