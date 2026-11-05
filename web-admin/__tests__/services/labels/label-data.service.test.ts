/**
 * LabelDataService (HFC P4, T4.2): tenant-scoped label data, CMX1 staff QR payloads, CODE128 values with hyphens,
 * piece selection, removed lines/pieces skipped, released tags hidden, config rows -> settings with safe fallbacks.
 */
// The resolver is injected in these tests; the config service is mocked so no RPC is made.
jest.mock('@/lib/services/labels/label-printing-config.service', () => ({
  LabelPrintingConfigService: { resolveLabelSettings: jest.fn() },
}));

import { fakeSupabase, type Row } from '../scan-resolve/fake-supabase';
import {
  DEFAULT_LABEL_SETTINGS,
  LabelDataService,
  parsePieceSelection,
  shortCustomerName,
  toLabelSettings,
} from '@/lib/services/labels/label-data.service';
import { decodeCmxPayload } from '@/lib/services/scan-resolve/cmx-code-payload';
import type { LabelSettings, ResolvedLabelPrinting } from '@/lib/services/labels/label-types';

const T = 't1';
const O = '0a000000-0000-4000-8000-000000000001';
const P = (n: number) => `0c000000-0000-4000-8000-00000000000${n}`;

function tables(): Record<string, Row[]> {
  return {
    org_orders_mst: [
      { id: O, tenant_org_id: T, order_no: 'ORD-260101-0001', branch_id: 'b1', customer_id: 'c1', customer_name: null,
        ready_by: '2026-01-02T10:00:00', ready_by_at_new: '2026-01-02T10:00:00+04:00' },
      { id: 'other', tenant_org_id: 't2', order_no: 'ORD-260101-0001', branch_id: null, customer_id: null, customer_name: 'X' },
    ],
    org_order_items_dtl: [
      { id: 'i2', tenant_org_id: T, order_id: O, order_item_srno: 'ORD-260101-0001-2', product_name: 'Shirt', product_name2: 'قميص', deleted_order_change_id: null },
      { id: 'i1', tenant_org_id: T, order_id: O, order_item_srno: 'ORD-260101-0001-1', product_name: 'Suit', product_name2: 'بدلة', deleted_order_change_id: null },
      { id: 'i9', tenant_org_id: T, order_id: O, order_item_srno: 'ORD-260101-0001-9', product_name: 'Removed', product_name2: null, deleted_order_change_id: 'chg' },
    ],
    org_order_item_pieces_dtl: [
      { id: P(1), tenant_org_id: T, order_id: O, order_item_id: 'i1', piece_seq: 1, piece_code: 'ORD-260101-0001-1-1', barcode: 'HS-778', tag_released_at: null, deleted_order_change_id: null },
      { id: P(2), tenant_org_id: T, order_id: O, order_item_id: 'i1', piece_seq: 2, piece_code: 'ORD-260101-0001-1-2', barcode: 'HS-779', tag_released_at: '2026-01-03T00:00:00Z', deleted_order_change_id: null },
      { id: P(3), tenant_org_id: T, order_id: O, order_item_id: 'i2', piece_seq: 1, piece_code: '', barcode: null, tag_released_at: null, deleted_order_change_id: null },
      { id: P(4), tenant_org_id: T, order_id: O, order_item_id: 'i1', piece_seq: 3, piece_code: 'ORD-260101-0001-1-3', barcode: null, tag_released_at: null, deleted_order_change_id: 'chg' },
      { id: P(5), tenant_org_id: T, order_id: O, order_item_id: 'i9', piece_seq: 1, piece_code: 'ORD-260101-0001-9-1', barcode: null, tag_released_at: null, deleted_order_change_id: null },
    ],
    org_branches_mst: [{ id: 'b1', tenant_org_id: T, name: 'Main', name2: 'الرئيسي', branch_name: null }],
    org_customers_mst: [{ id: 'c1', tenant_org_id: T, display_name: 'Ahmed Al Balushi', name: null, first_name: 'Ahmed', last_name: 'Al Balushi' }],
  };
}

const settings = (m: Partial<LabelSettings> = {}) => jest.fn(async () => ({ ...DEFAULT_LABEL_SETTINGS, ...m }));

describe('LabelDataService.getLabelData', () => {
  it('builds the order label with CMX1:ORD payload and the order no as CODE128 value', async () => {
    const { client, queries } = fakeSupabase(tables());
    const resolve = settings({ orderLabelSize: '80mm' });
    const r = await LabelDataService.getLabelData(client, { tenantId: T, orderId: O, userId: 'u1' }, resolve);
    expect(r?.order).toEqual({
      orderId: O,
      orderNo: 'ORD-260101-0001',
      staffQr: 'CMX1:ORD:ORD-260101-0001',
      barcodeValue: 'ORD-260101-0001',
      branchName: 'Main',
      branchName2: 'الرئيسي',
      readyBy: '2026-01-02T10:00:00+04:00',
      itemCount: 2,
      pieceCount: 3,
      customerShort: 'Ahmed B.',
    });
    expect(decodeCmxPayload(r!.order.staffQr)).toEqual({ ok: true, payload: { version: 1, type: 'ORD', code: 'ORD-260101-0001' } });
    expect(r?.pieces).toEqual([]);
    expect(r?.settings.orderLabelSize).toBe('80mm');
    expect(resolve).toHaveBeenCalledWith(T, 'b1');
    // every query is tenant-scoped
    for (const q of queries) expect(q.filters).toContainEqual(['eq', 'tenant_org_id', T]);
  });

  it('builds piece tags for all live pieces, sorted, with piece x of n and live external tags only', async () => {
    const { client } = fakeSupabase(tables());
    const r = await LabelDataService.getLabelData(client, { tenantId: T, orderId: O, pieces: 'all' }, settings());
    expect(r?.pieces.map((p) => [p.pieceCode, p.pieceSeq, p.pieceTotal, p.externalTag])).toEqual([
      ['ORD-260101-0001-1-1', 1, 2, 'HS-778'],
      ['ORD-260101-0001-1-2', 2, 2, null], // tag released
      ['ORD-260101-0001-2-1', 1, 1, null], // empty piece_code -> <line serial>-<seq>
    ]);
    const first = r!.pieces[0];
    expect(first.staffQr).toBe('CMX1:PEC:ORD-260101-0001-1-1');
    expect(first.barcodeValue).toBe('ORD-260101-0001-1-1');
    expect([first.itemName, first.itemName2, first.orderNo]).toEqual(['Suit', 'بدلة', 'ORD-260101-0001']);
  });

  it('builds only the selected pieces but keeps the line total', async () => {
    const { client } = fakeSupabase(tables());
    const r = await LabelDataService.getLabelData(client, { tenantId: T, orderId: O, pieces: [P(2), 'not-on-order'] }, settings());
    expect(r?.pieces.map((p) => [p.pieceCode, p.pieceTotal])).toEqual([['ORD-260101-0001-1-2', 2]]);
  });

  it('returns null for another tenant order and hides the customer when the setting is off', async () => {
    const { client } = fakeSupabase(tables());
    expect(await LabelDataService.getLabelData(client, { tenantId: T, orderId: 'other' }, settings())).toBeNull();
    const r = await LabelDataService.getLabelData(client, { tenantId: T, orderId: O }, settings({ showCustomerName: false }));
    expect(r?.order.customerShort).toBeNull();
  });

  it('uses the order customer_name snapshot when present (no customer lookup)', async () => {
    const t = tables();
    t.org_orders_mst[0].customer_name = 'Fatma';
    const { client, queries } = fakeSupabase(t);
    const r = await LabelDataService.getLabelData(client, { tenantId: T, orderId: O }, settings());
    expect(r?.order.customerShort).toBe('Fatma');
    expect(queries.some((q) => q.table === 'org_customers_mst')).toBe(false);
  });
});

describe('label settings and helpers', () => {
  it('maps resolved config rows and falls back on missing rows or bad values', () => {
    const row = (r: Partial<ResolvedLabelPrinting> & Pick<ResolvedLabelPrinting, 'labelType'>): ResolvedLabelPrinting => ({
      sizeCode: null, showQr: null, showCustomerName: null, showOrderBarcode: null, copies: null,
      showOrderBarcodeConfigured: null, sources: {}, ...r,
    });
    expect(toLabelSettings([])).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(toLabelSettings(null)).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(
      toLabelSettings([
        row({ labelType: 'ORDER_LABEL', sizeCode: 'A6', showQr: false, showCustomerName: false, copies: 2 }),
        row({ labelType: 'PIECE_TAG', sizeCode: '80x40mm', showQr: true, copies: 3 }),
        row({ labelType: 'RECEIPT', showOrderBarcode: true, showOrderBarcodeConfigured: true }),
      ]),
    ).toEqual({
      orderLabelSize: 'A6', orderLabelQr: false, showCustomerName: false, orderLabelCopies: 2,
      pieceTagSize: '80x40mm', pieceTagQr: true, pieceTagCopies: 3, receiptOrderCode128: true,
    });
    const bad = toLabelSettings([
      row({ labelType: 'ORDER_LABEL', sizeCode: '4x4in', copies: 11 }),
      row({ labelType: 'PIECE_TAG', sizeCode: '7', copies: 0 }),
    ]);
    expect([bad.orderLabelSize, bad.orderLabelCopies, bad.pieceTagSize, bad.pieceTagCopies]).toEqual(['4x6in', 1, '58x30mm', 1]);
  });

  it('shortens customer names', () => {
    expect(shortCustomerName('Ahmed Al Balushi')).toBe('Ahmed B.');
    expect(shortCustomerName('  Sara ')).toBe('Sara');
    expect(shortCustomerName('')).toBeNull();
    expect(shortCustomerName(null)).toBeNull();
  });

  it('parses the pieces query', () => {
    expect(parsePieceSelection(null)).toBe('none');
    expect(parsePieceSelection('all')).toBe('all');
    expect(parsePieceSelection(`${P(1)}, ${P(1).toUpperCase()},${P(2)}`)).toEqual([P(1), P(2)]);
    expect(parsePieceSelection('abc')).toBeNull();
    expect(parsePieceSelection(',')).toBeNull();
  });
});
