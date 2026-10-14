/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';

import { createEditOrderController } from '@features/orders/order-change/edit-order-controller';
import { mapLoadedOrderToEditBaseline, type EditOrderBaseline } from '@features/orders/order-change/edit-order-view-model';
import { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

const PRODUCT = '66666666-6666-4666-8666-666666666666';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const PIECE_A = '33333333-3333-4333-8333-333333333333';
const PIECE_B = '77777777-7777-4777-8777-777777777777';
const PREF_ORDER = '44444444-4444-4444-8444-444444444444';
const PREF_ITEM = '88888888-8888-4888-8888-888888888888';
const PREF_PIECE = '99999999-9999-4999-8999-999999999999';
const CATALOG = '55555555-5555-4555-8555-555555555555';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function baseline(): EditOrderBaseline {
  return {
    orderId: ORDER_ID,
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'order-edit',
    notes: 'Keep',
    lines: [
      {
        identity: { kind: 'persisted', id: ITEM_A },
        productId: PRODUCT,
        quantity: 2,
        pieces: [{
          identity: { kind: 'persisted', id: PIECE_A },
          preferences: [{ identity: { kind: 'persisted', id: PREF_PIECE }, preferenceId: CATALOG, preferenceCode: 'STARCH', preferenceContent: 'light' }],
        }],
        preferences: [{ identity: { kind: 'persisted', id: PREF_ITEM }, preferenceId: CATALOG, preferenceCode: 'SCENT', preferenceContent: 'none' }],
      },
      {
        identity: { kind: 'persisted', id: ITEM_B },
        productId: PRODUCT,
        quantity: 1,
        pieces: [{ identity: { kind: 'persisted', id: PIECE_B }, preferences: [] }],
        preferences: [],
      },
    ],
    preferences: [{ identity: { kind: 'persisted', id: PREF_ORDER }, preferenceId: CATALOG, preferenceCode: 'FOLD', preferenceContent: 'loose' }],
  };
}

function requestOf(controller: ReturnType<typeof createEditOrderController>) {
  return orderChangeRequestSchema.parse({
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'order-edit',
    operations: controller.buildOperations(),
  });
}

describe('edit order controller', () => {
  it('changes only the repeated product line that was edited', () => {
    const controller = createEditOrderController();
    controller.load(baseline());
    controller.setQuantity({ kind: 'persisted', id: ITEM_B }, 4, [PIECE_B]);
    const request = requestOf(controller);
    expect(request.operations).toEqual([
      {
        seq: 1,
        code: 'CHANGE_ITEM_QUANTITY',
        target: { kind: 'PERSISTED_ITEM', id: ITEM_B },
        payload: { quantity: 4, selectedPieceIds: [PIECE_B] },
      },
    ]);
  });

  it('cancels a local item that is removed before commit', () => {
    const controller = createEditOrderController({ createId: () => '12121212-1212-4212-8212-121212121212' });
    controller.load(baseline());
    const added = controller.addItem({ productId: PRODUCT, quantity: 1 });
    controller.removeLine(added);
    expect(controller.buildOperations()).toEqual([]);
  });

  it('targets the persisted piece and each preference level', () => {
    const ids = [
      '13131313-1313-4313-8313-131313131313',
      '14141414-1414-4414-8414-141414141414',
      '15151515-1515-4515-8515-151515151515',
      '16161616-1616-4616-8616-161616161616',
    ];
    const controller = createEditOrderController({ createId: () => ids.shift() as string });
    controller.load(baseline());
    controller.removePiece({ kind: 'persisted', id: ITEM_A }, { kind: 'persisted', id: PIECE_A });
    controller.addPreference({ level: 'ORDER', preferenceId: CATALOG, preferenceCode: 'HANG' });
    controller.addPreference({ level: 'ITEM', parent: { kind: 'persisted', id: ITEM_B }, preferenceId: CATALOG, preferenceCode: 'BOX' });
    const piece = controller.addPiece({ kind: 'persisted', id: ITEM_B }, { color: 'blue' });
    controller.addPreference({ level: 'PIECE', parent: piece, preferenceId: CATALOG, preferenceCode: 'STARCH', preferenceContent: 'heavy' });
    const codes = requestOf(controller).operations.map((operation) => ({
      code: operation.code,
      target: operation.target,
    }));
    expect(codes).toEqual([
      { code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: PIECE_A } },
      { code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: ITEM_B } },
      { code: 'ADD_PREFERENCE', target: { kind: 'LOCAL_PIECE', clientRef: piece.kind === 'local' ? piece.clientRef : '' } },
      { code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_ITEM', id: ITEM_B } },
      { code: 'ADD_PREFERENCE', target: { kind: 'ORDER' } },
    ]);
  });

  it('keeps a loaded piece id and rejects a line without one', () => {
    const mapped = mapLoadedOrderToEditBaseline({
      edit_state_version: 2,
      state_version: 4,
      items: [{ id: ITEM_A, product_id: PRODUCT, quantity: 1, pieces: [{ id: PIECE_A }] }],
    }, ORDER_ID);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.baseline.lines[0].pieces[0].identity).toEqual({ kind: 'persisted', id: PIECE_A });
    expect(mapLoadedOrderToEditBaseline({
      edit_state_version: 2,
      state_version: 4,
      items: [{ product_id: PRODUCT, quantity: 1 }],
    }, ORDER_ID)).toEqual({ ok: false, code: 'EDIT_BASELINE_INVALID' });
  });

  it('previews and applies through the Change routes and does not call Create', async () => {
    const calls: Array<{ url: string; method: string; headers: Headers }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', headers: new Headers(init?.headers) });
      return new Response(JSON.stringify({
        ok: true,
        data: { reviewProof: 'proof-1', calculationFingerprint: 'fingerprint-1' },
      }), { status: 200 });
    }) as typeof fetch;
    const controller = createEditOrderController({ fetchImpl });
    controller.load(baseline());
    controller.setNotes('Leave at desk');
    await expect(controller.preview(ORDER_ID)).resolves.toMatchObject({ ok: true, status: 200 });
    await expect(controller.apply(ORDER_ID, 'key-1')).resolves.toMatchObject({ ok: true });
    expect(calls.map((call) => call.url)).toEqual([
      `/api/v1/orders/${ORDER_ID}/changes/preview`,
      `/api/v1/orders/${ORDER_ID}/changes`,
    ]);
    expect(calls[1].headers.get('Idempotency-Key')).toBe('key-1');
    const source = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-order-controller.ts'), 'utf8');
    expect(source).not.toMatch(/submit-order|\/update/);
  });
});
