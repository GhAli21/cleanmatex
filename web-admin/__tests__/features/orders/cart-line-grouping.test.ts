/**
 * Cart Line Grouping P2 (docs/features/Order_Cart_Line_Grouping/DESIGN.md §4, §4.1, §4.3, §5.5):
 * the add rule, measured matching, exact equal-share split, and line numbers.
 */
import {
  equalMeasureShare,
  findMatchingMeasuredLines,
  isOpenLine,
  measureWithArticle,
  productLineNumber,
  resolveCartAddTarget,
} from '@/src/features/orders/model/cart-line-grouping';
import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import type { LineKey, NewOrderState, OrderItem, OrderItemUom } from '@/src/features/orders/model/new-order-types';

const M: OrderItemUom = { code: 'M', dimension: 'LENGTH', qtyDecimals: 3, symbol: 'm', symbol2: null, minBillableQty: null, billingIncrement: null };
const KG: OrderItemUom = { ...M, code: 'KG', dimension: 'MASS', symbol: 'kg' };
const SQM: OrderItemUom = { ...M, code: 'SQM', dimension: 'AREA', symbol: 'm²' };

function line(key: string, over: Partial<OrderItem> = {}): OrderItem {
  const lineKey = key as LineKey;
  return {
    lineKey,
    productId: 'shirt',
    productName: 'Shirt',
    productName2: null,
    quantity: 1,
    pricePerUnit: 2.5,
    totalPrice: 2.5,
    defaultSellPrice: 2.5,
    serviceCategoryCode: 'LAUNDRY',
    pieces: [{ id: `temp-${lineKey}-1`, itemId: lineKey, pieceSeq: 1 }],
    ...over,
  };
}

const measured = (key: string, qty: number, total: string, over: Partial<OrderItem> = {}) =>
  line(key, {
    productId: 'cardigan', uom: M, quantity: qty, measure: { measuredQty: total, length: '', width: '' },
    pieces: Array.from({ length: qty }, (_, i) => ({ id: `temp-${key}-${i + 1}`, itemId: key as LineKey, pieceSeq: i + 1 })),
    ...over,
  });
const article = { productId: 'cardigan', serviceCategoryCode: 'LAUNDRY', uomCode: 'M' };
const entered = (qty: string) => ({ measuredQty: qty, length: '', width: '' });

describe('isOpenLine / resolveCartAddTarget (§4)', () => {
  it.each([
    ['price override', { priceOverride: 1 }],
    ['line discount', { lineDiscount: { type: 'PERCENTAGE' as const, value: 10, reason: 'x' } }],
    ['own speed', { serviceSpeed: 'EXPRESS' }],
    ['custom item', { customItem: { name: 'X', name2: null, unitPrice: 1 } }],
  ])('a line with its own %s is closed', (_name, over) => {
    expect(isOpenLine(line('a', over))).toBe(false);
  });

  it('line preferences do not close a line', () => {
    expect(isOpenLine(line('a', { servicePrefs: [{ preference_code: 'STARCH', source: 'manual', extra_price: 0.3 }] }))).toBe(true);
  });

  it('merges into the most recently added open line of the product', () => {
    const items = [line('a'), line('b', { productId: 'tie' }), line('c'), line('d', { priceOverride: 1 })];
    expect(resolveCartAddTarget(items, 'shirt')).toEqual({ kind: 'MERGE', lineKey: 'c' });
  });

  it('a new line when the product has no open line, or only measured lines', () => {
    expect(resolveCartAddTarget([line('a', { priceOverride: 1 })], 'shirt')).toEqual({ kind: 'NEW_LINE' });
    expect(resolveCartAddTarget([measured('m', 1, '2.5')], 'cardigan')).toEqual({ kind: 'NEW_LINE' });
    expect(resolveCartAddTarget([], 'shirt')).toEqual({ kind: 'NEW_LINE' });
  });
});

describe('findMatchingMeasuredLines (§4.1)', () => {
  it('matches when every piece already has the entered measure (exact decimals)', () => {
    const items = [measured('m1', 2, '5'), measured('m2', 1, '4')];
    expect(findMatchingMeasuredLines(items, article, entered('2.50')).map((l) => l.lineKey)).toEqual(['m1']);
    expect(findMatchingMeasuredLines(items, article, entered('4.000')).map((l) => l.lineKey)).toEqual(['m2']);
    expect(findMatchingMeasuredLines(items, article, entered('3'))).toEqual([]);
  });

  it('skips closed lines, other categories, other units, AREA lines and bad input', () => {
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5', { priceOverride: 1 })], article, entered('2.5'))).toEqual([]);
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5', { serviceCategoryCode: 'DRY' })], article, entered('2.5'))).toEqual([]);
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5', { uom: KG })], article, entered('2.5'))).toEqual([]);
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5', { uom: SQM })], { ...article, uomCode: 'SQM' }, entered('2.5'))).toEqual([]);
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5')], article, entered(''))).toEqual([]);
    expect(findMatchingMeasuredLines([measured('m', 1, '2.5')], article, entered('abc'))).toEqual([]);
  });

  it('the merged measure is the exact sum', () => {
    expect(measureWithArticle(measured('m', 2, '5'), entered('2.5'))).toEqual(entered('7.5'));
    expect(measureWithArticle(measured('m', 1, '0.1'), entered('0.2'))).toEqual(entered('0.3'));
  });
});

describe('equalMeasureShare (§4.3)', () => {
  it('splits only into exact equal shares at the unit decimals', () => {
    expect(equalMeasureShare(measured('m', 3, '7.5'))).toBe('2.5');
    expect(equalMeasureShare(measured('m', 3, '7', { uom: KG }))).toBeNull();
    expect(equalMeasureShare(measured('m', 1, '2.5'))).toBeNull();
    expect(equalMeasureShare(measured('m', 2, '5', { uom: SQM }))).toBeNull();
    expect(equalMeasureShare(line('a', { quantity: 2 }))).toBeNull();
  });
});

describe('productLineNumber (§5.5)', () => {
  it('numbers lines only when a product has more than one', () => {
    const items = [line('a'), line('b', { productId: 'tie' }), line('c')];
    expect(productLineNumber(items, 'a' as LineKey)).toBe(1);
    expect(productLineNumber(items, 'c' as LineKey)).toBe(2);
    expect(productLineNumber(items, 'b' as LineKey)).toBeNull();
  });
});

describe('reducer: measured merge and split', () => {
  const state = (items: OrderItem[]): NewOrderState => ({ ...initialState, items });

  it('ADD_ITEM with mergedMeasure adds a piece and sets the new line total', () => {
    const tapped = measured('new', 1, '2.5');
    const after = newOrderReducer(state([measured('m', 2, '5')]), {
      type: 'ADD_ITEM', payload: tapped, mergeInto: 'm' as LineKey, mergedMeasure: entered('7.5'),
    });
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({ quantity: 3, measure: entered('7.5') });
    expect(after.items[0].pieces?.map((p) => p.id)).toEqual(['temp-m-1', 'temp-m-2', 'temp-m-3']);
  });

  it('ADD_ITEM without mergeInto always adds a new line', () => {
    const after = newOrderReducer(state([line('a')]), { type: 'ADD_ITEM', payload: line('b') });
    expect(after.items.map((i) => i.lineKey)).toEqual(['a', 'b']);
  });

  it('SPLIT_MEASURED_SHARE moves one share and the last piece to an open line right after the source', () => {
    const source = measured('m', 3, '7.5', { priceOverride: 2, overrideReason: 'Regular', pricePerUnit: 2, serviceSpeed: 'EXPRESS', notes: 'line note' });
    source.pieces![2] = { ...source.pieces![2], notes: 'collar stain' };
    const after = newOrderReducer(state([source, line('t', { productId: 'tie' })]), {
      type: 'SPLIT_MEASURED_SHARE', payload: { lineKey: 'm' as LineKey, newLineKey: 'n' as LineKey, share: '2.5' },
    });
    expect(after.items.map((i) => i.lineKey)).toEqual(['m', 'n', 't']);
    expect(after.items[0]).toMatchObject({ quantity: 2, measure: entered('5'), priceOverride: 2 });
    expect(after.items[0].pieces).toHaveLength(2);
    expect(after.items[1]).toMatchObject({
      quantity: 1, measure: entered('2.5'), priceOverride: null, pricePerUnit: 2.5, serviceSpeed: null, lineDiscount: null, notes: undefined,
    });
    expect(after.items[1].pieces).toEqual([{ id: 'temp-n-1', itemId: 'n', pieceSeq: 1, notes: 'collar stain' }]);
  });

  it('SPLIT_MEASURED_SHARE leaves a one-piece line alone', () => {
    const before = state([measured('m', 1, '2.5')]);
    expect(newOrderReducer(before, { type: 'SPLIT_MEASURED_SHARE', payload: { lineKey: 'm' as LineKey, newLineKey: 'n' as LineKey, share: '2.5' } })).toBe(before);
  });
});
