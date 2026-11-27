/**
 * Cart Line Grouping P1 (docs/features/Order_Cart_Line_Grouping/DESIGN.md §6): a cart line is found by its
 * line key, never by its product, so two lines of the same product stay independent.
 */
import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import { newCartLineKey, savedLineKey } from '@/src/features/orders/model/cart-line-key';
import type { LineKey, NewOrderAction, NewOrderState, OrderItem } from '@/src/features/orders/model/new-order-types';

const A = 'line-a' as LineKey;
const B = 'line-b' as LineKey;
const uom = { code: 'M', dimension: 'LENGTH', qtyDecimals: 3, symbol: 'm', symbol2: null, minBillableQty: null, billingIncrement: null };

function line(lineKey: LineKey): OrderItem {
  return {
    lineKey,
    productId: 'shirt',
    productName: 'Shirt',
    productName2: null,
    quantity: 2,
    pricePerUnit: 1.5,
    totalPrice: 3,
    defaultSellPrice: 1.5,
    uom,
    measure: { measuredQty: '2', length: '', width: '' },
    pieces: [
      { id: `temp-${lineKey}-1`, itemId: lineKey, pieceSeq: 1 },
      { id: `temp-${lineKey}-2`, itemId: lineKey, pieceSeq: 2 },
    ],
  };
}

const twoLines = (): NewOrderState => ({ ...initialState, items: [line(A), line(B)] });
const lineOf = (state: NewOrderState, key: LineKey) => state.items.find((item) => item.lineKey === key);

const actionsOnB: Array<[string, NewOrderAction]> = [
  ['UPDATE_ITEM_QUANTITY', { type: 'UPDATE_ITEM_QUANTITY', payload: { lineKey: B, quantity: 3 } }],
  ['UPDATE_ITEM_MEASURE', { type: 'UPDATE_ITEM_MEASURE', payload: { lineKey: B, measure: { measuredQty: '4', length: '', width: '' } } }],
  ['UPDATE_ITEM_NOTES', { type: 'UPDATE_ITEM_NOTES', payload: { lineKey: B, notes: 'collar stain' } }],
  ['UPDATE_ITEM_PIECES', { type: 'UPDATE_ITEM_PIECES', payload: { lineKey: B, pieces: [{ id: `temp-${B}-1`, itemId: B, pieceSeq: 1, notes: 'x' }] } }],
  ['UPDATE_ITEM_SERVICE_PREFS', { type: 'UPDATE_ITEM_SERVICE_PREFS', payload: { lineKey: B, servicePrefs: [{ preference_code: 'STARCH', source: 'manual', extra_price: 0.3 }], servicePrefCharge: 0.3 } }],
  ['UPDATE_ITEM_PACKING_PREF', { type: 'UPDATE_ITEM_PACKING_PREF', payload: { lineKey: B, packingPrefCode: 'BOX', packingPrefCharge: 0.5 } }],
  ['ADJUST_ITEM_PACKING_PREF_CHARGE', { type: 'ADJUST_ITEM_PACKING_PREF_CHARGE', payload: { lineKey: B, packingPrefCharge: 0.7 } }],
  ['UPDATE_ITEM_PRICE_OVERRIDE', { type: 'UPDATE_ITEM_PRICE_OVERRIDE', payload: { lineKey: B, priceOverride: 1, overrideReason: 'Goodwill', overrideBy: 'u1' } }],
  ['SET_ITEM_SERVICE_SPEED', { type: 'SET_ITEM_SERVICE_SPEED', payload: { lineKey: B, serviceSpeed: 'EXPRESS' } }],
  ['SET_ITEM_LINE_DISCOUNT', { type: 'SET_ITEM_LINE_DISCOUNT', payload: { lineKey: B, lineDiscount: { type: 'PERCENTAGE', value: 10, reason: 'Loyal' } } }],
  ['UPDATE_PIECE_CONDITIONS', { type: 'UPDATE_PIECE_CONDITIONS', payload: { pieceId: `temp-${B}-2`, conditions: ['wine'] } }],
];

describe('Cart Line Grouping P1 — two lines of one product stay independent', () => {
  it.each(actionsOnB)('%s changes only the targeted line', (_name, action) => {
    const before = twoLines();
    const after = newOrderReducer(before, action);
    expect(lineOf(after, A)).toEqual(lineOf(before, A));
    expect(lineOf(after, B)).not.toEqual(lineOf(before, B));
  });

  it('REMOVE_ITEM removes only the targeted line', () => {
    const after = newOrderReducer(twoLines(), { type: 'REMOVE_ITEM', payload: B });
    expect(after.items.map((item) => item.lineKey)).toEqual([A]);
  });

  it('a quantity of 0 removes only the targeted line', () => {
    const after = newOrderReducer(twoLines(), { type: 'UPDATE_ITEM_QUANTITY', payload: { lineKey: A, quantity: 0 } });
    expect(after.items.map((item) => item.lineKey)).toEqual([B]);
  });

  it('new pieces from a quantity change carry the line key', () => {
    const after = newOrderReducer(twoLines(), { type: 'UPDATE_ITEM_QUANTITY', payload: { lineKey: B, quantity: 3 } });
    expect(lineOf(after, B)?.pieces?.[2]).toEqual({ id: `temp-${B}-3`, itemId: B, pieceSeq: 3 });
  });

  it('the price override dialog targets one line', () => {
    const after = newOrderReducer(twoLines(), { type: 'OPEN_PRICE_OVERRIDE_MODAL', payload: B });
    expect(after.priceOverrideItemId).toBe(B);
  });
});

describe('ADD_ITEM into a chosen line keeps its pieces', () => {
  it('a second tap on a product adds a piece to its line and keeps the existing pieces', () => {
    const tapped = { ...line(newCartLineKey()), quantity: 1, measure: undefined, uom: undefined };
    tapped.pieces = [{ id: `temp-${tapped.lineKey}-1`, itemId: tapped.lineKey, pieceSeq: 1 }];
    const start: NewOrderState = { ...initialState, items: [{ ...line(A), uom: undefined, measure: undefined, pieces: [
      { id: `temp-${A}-1`, itemId: A, pieceSeq: 1, notes: 'keep me' },
      { id: `temp-${A}-2`, itemId: A, pieceSeq: 2 },
    ] }] };
    const after = newOrderReducer(start, { type: 'ADD_ITEM', payload: tapped, mergeInto: A });
    expect(after.items).toHaveLength(1);
    expect(after.items[0].quantity).toBe(3);
    expect(after.items[0].pieces).toEqual([
      { id: `temp-${A}-1`, itemId: A, pieceSeq: 1, notes: 'keep me' },
      { id: `temp-${A}-2`, itemId: A, pieceSeq: 2 },
      { id: `temp-${A}-3`, itemId: A, pieceSeq: 3 },
    ]);
  });
});

describe('line keys', () => {
  it('a new key is unique; a saved line keeps its item id', () => {
    expect(newCartLineKey()).not.toBe(newCartLineKey());
    expect(savedLineKey('9f1c0000-0000-4000-8000-000000000001')).toBe('9f1c0000-0000-4000-8000-000000000001');
  });
});
