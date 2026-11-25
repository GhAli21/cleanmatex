/**
 * Free-garment fix (Measured Pricing): a piece-count change on a measured line is held until staff check the total
 * measure. Confirm applies the count (and the measure only if staff changed it); Cancel leaves the count as it was.
 */
import { act, renderHook } from '@testing-library/react';
import { useReducer } from 'react';
import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import type { LineKey, NewOrderState, OrderItem } from '@/src/features/orders/model/new-order-types';

const CARDIGAN = 'line-cardigan' as LineKey;
const SHIRT = 'line-shirt' as LineKey;

let seed: NewOrderState = initialState;
jest.mock('@/src/features/orders/ui/context/new-order-context', () => ({
  useNewOrderContext: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- test double of the context hook
    const [state, dispatch] = useReducer(newOrderReducer, seed);
    return { state, dispatch };
  },
}));
jest.mock('@/src/features/orders/order-change/order-workspace-session', () => ({
  useOrderWorkspaceSessionOptional: () => null,
}));

import { useNewOrderStateWithDispatch } from '@/src/features/orders/hooks/use-new-order-state';

const uom = { code: 'M', dimension: 'LENGTH', qtyDecimals: 3, symbol: 'm', symbol2: null, minBillableQty: null, billingIncrement: null };

function line(over: Partial<OrderItem>): OrderItem {
  return { lineKey: 'line-p' as LineKey, productId: 'p', productName: 'P', productName2: null, quantity: 2, pricePerUnit: 2.5, totalPrice: 12.5, defaultSellPrice: 2.5, ...over };
}

const measured = () => line({ lineKey: CARDIGAN, productId: 'cardigan', uom, measure: { measuredQty: '5', length: '', width: '' }, pieces: [
  { id: 'a', itemId: CARDIGAN, pieceSeq: 1 }, { id: 'b', itemId: CARDIGAN, pieceSeq: 2 },
] });
const counted = () => line({ lineKey: SHIRT, productId: 'shirt', pieces: [] });

function setup(items: OrderItem[]) {
  seed = { ...initialState, items };
  return renderHook(() => useNewOrderStateWithDispatch());
}
const itemOf = (r: ReturnType<typeof setup>, id: string) => r.result.current.state.items.find((i) => i.productId === id)!;

describe('measured line: a piece-count change waits for the measure check', () => {
  it('card +/- (quantity) is held, not applied', () => {
    const r = setup([measured()]);
    let applied = true;
    act(() => { applied = r.result.current.updateItemQuantity(CARDIGAN, 3); });
    expect(applied).toBe(false);
    expect(itemOf(r, 'cardigan').quantity).toBe(2);
    expect(r.result.current.state.measureRecheck).toMatchObject({ lineKey: CARDIGAN, from: 2, to: 3 });
  });

  it('Add piece / remove piece (pieces) is held too', () => {
    const r = setup([measured()]);
    const pieces = [...itemOf(r, 'cardigan').pieces!, { id: 'c', itemId: CARDIGAN, pieceSeq: 3 }];
    act(() => { r.result.current.updateItemPieces(CARDIGAN, pieces); });
    expect(itemOf(r, 'cardigan').quantity).toBe(2);
    expect(r.result.current.state.measureRecheck).toMatchObject({ from: 2, to: 3 });
  });

  it('Cancel leaves count and measure as they were', () => {
    const r = setup([measured()]);
    act(() => { r.result.current.updateItemQuantity(CARDIGAN, 3); });
    act(() => { r.result.current.cancelMeasureRecheck(); });
    expect(r.result.current.state.measureRecheck).toBeNull();
    expect(itemOf(r, 'cardigan')).toMatchObject({ quantity: 2, measure: { measuredQty: '5' } });
  });

  it('Confirm with the same total applies the count and keeps the measure (explicit choice)', () => {
    const r = setup([measured()]);
    act(() => { r.result.current.updateItemQuantity(CARDIGAN, 3); });
    let result: ReturnType<typeof r.result.current.confirmMeasureRecheck> = { status: 'NONE' };
    act(() => { result = r.result.current.confirmMeasureRecheck({ measuredQty: '5.000', length: '', width: '' }); });
    expect(result.status).toBe('APPLIED');
    expect(itemOf(r, 'cardigan')).toMatchObject({ quantity: 3, measure: { measuredQty: '5' } });
    expect(r.result.current.state.measureRecheck).toBeNull();
  });

  it('Confirm with a new total applies the count and the staff-entered measure, never a computed one', () => {
    const r = setup([measured()]);
    act(() => { r.result.current.updateItemQuantity(CARDIGAN, 3); });
    act(() => { r.result.current.confirmMeasureRecheck({ measuredQty: '7.5', length: '', width: '' }); });
    expect(itemOf(r, 'cardigan')).toMatchObject({ quantity: 3, measure: { measuredQty: '7.5' } });
  });

  it('removing the line (quantity 0) is not held', () => {
    const r = setup([measured()]);
    act(() => { r.result.current.updateItemQuantity(CARDIGAN, 0); });
    expect(r.result.current.state.items).toHaveLength(0);
    expect(r.result.current.state.measureRecheck).toBeNull();
  });

  it('a count line changes at once, with no question', () => {
    const r = setup([counted()]);
    let applied = false;
    act(() => { applied = r.result.current.updateItemQuantity(SHIRT, 3); });
    expect(applied).toBe(true);
    expect(itemOf(r, 'shirt').quantity).toBe(3);
    expect(r.result.current.state.measureRecheck).toBeNull();
  });

  it('editing piece details without changing the count is not held', () => {
    const r = setup([measured()]);
    const edited = itemOf(r, 'cardigan').pieces!.map((p) => ({ ...p, notes: 'stain' }));
    let applied = false;
    act(() => { applied = r.result.current.updateItemPieces(CARDIGAN, edited); });
    expect(applied).toBe(true);
    expect(r.result.current.state.measureRecheck).toBeNull();
  });
});
