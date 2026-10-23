/**
 * P1-01 characterization: the New Order cart money (client side). Create
 * stores the cart's line prices (PF-02, see create-line-write W01), so the
 * cart rules are part of today's Create money.
 *
 * `KNOWN DEFECT` cases pin today's behaviour on purpose.
 */

import { act, renderHook } from '@testing-library/react';
import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import type { NewOrderAction, NewOrderState, OrderItem, PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';

/** In-memory store standing in for the New Order context. */
const store: { state: NewOrderState } = { state: initialState };
const dispatch = (action: NewOrderAction) => {
  store.state = newOrderReducer(store.state, action);
};

jest.mock('@/src/features/orders/hooks/use-new-order-state', () => ({
  useNewOrderStateWithDispatch: () => ({
    state: store.state,
    updateItemPieces: (productId: string, pieces: PreSubmissionPiece[]) =>
      dispatch({ type: 'UPDATE_ITEM_PIECES', payload: { productId, pieces } } as NewOrderAction),
    updateItemServicePrefs: (productId: string, servicePrefs: OrderItem['servicePrefs'], servicePrefCharge: number) =>
      dispatch({ type: 'UPDATE_ITEM_SERVICE_PREFS', payload: { productId, servicePrefs, servicePrefCharge } } as NewOrderAction),
    adjustItemPackingCharge: (productId: string, packingPrefCharge: number) =>
      dispatch({ type: 'ADJUST_ITEM_PACKING_PREF_CHARGE', payload: { productId, packingPrefCharge } } as NewOrderAction),
  }),
}));

import { useNewOrderPiecePreferences } from '@/src/features/orders/hooks/use-new-order-piece-preferences';

function line(over: Partial<OrderItem> = {}): OrderItem {
  return {
    productId: 'shirt',
    productName: 'Shirt',
    productName2: null,
    quantity: 2,
    pricePerUnit: 1.5,
    totalPrice: 3,
    defaultSellPrice: 1.5,
    defaultExpressSellPrice: 2.5,
    pieces: [
      { id: 'pc-1', itemId: 'shirt', pieceSeq: 1 },
      { id: 'pc-2', itemId: 'shirt', pieceSeq: 2 },
    ],
    ...over,
  };
}

const item = () => store.state.items[0];

beforeEach(() => {
  store.state = initialState;
  dispatch({ type: 'ADD_ITEM', payload: line() } as NewOrderAction);
});

describe('P1-01 golden — cart line money', () => {
  it('C01 line total = qty × unit + service prefs + packing (prefs once per line, not × qty)', () => {
    dispatch({
      type: 'UPDATE_ITEM_SERVICE_PREFS',
      payload: { productId: 'shirt', servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.3 }], servicePrefCharge: 0.3 },
    } as NewOrderAction);
    expect([item().servicePrefCharge, item().totalPrice]).toEqual([0.3, 3.3]);
  });

  it('C02 express reprices every line to its express price, or keeps the normal price when there is none', () => {
    dispatch({ type: 'ADD_ITEM', payload: line({ productId: 'tie', defaultSellPrice: 1, defaultExpressSellPrice: null, pricePerUnit: 1, totalPrice: 1, quantity: 1, pieces: [] }) } as NewOrderAction);
    dispatch({ type: 'SET_EXPRESS', payload: true } as NewOrderAction);
    expect(store.state.items.map((i) => [i.productId, i.pricePerUnit, i.totalPrice])).toEqual([
      ['shirt', 2.5, 5],
      ['tie', 1, 1],
    ]);
    dispatch({ type: 'SET_EXPRESS', payload: false } as NewOrderAction);
    expect(store.state.items.map((i) => i.pricePerUnit)).toEqual([1.5, 1]);
  });

  it('C03 KNOWN DEFECT (PF-21): clearing a price override keeps the overridden unit price', () => {
    dispatch({
      type: 'UPDATE_ITEM_PRICE_OVERRIDE',
      payload: { productId: 'shirt', priceOverride: 1, overrideReason: 'Goodwill gesture', overrideBy: 'u1' },
    } as NewOrderAction);
    expect([item().pricePerUnit, item().totalPrice]).toEqual([1, 2]);

    dispatch({
      type: 'UPDATE_ITEM_PRICE_OVERRIDE',
      payload: { productId: 'shirt', priceOverride: null, overrideReason: null, overrideBy: null },
    } as NewOrderAction);
    // The catalog price 1.5 is not restored; the server prices 1.5, so submit fails with AMOUNT_MISMATCH.
    expect([item().priceOverride, item().pricePerUnit, item().totalPrice]).toEqual([null, 1, 2]);
  });

  it('C04 KNOWN DEFECT (PF-12): a piece preference REPLACES the item-preference charge instead of adding to it', () => {
    dispatch({
      type: 'UPDATE_ITEM_SERVICE_PREFS',
      payload: { productId: 'shirt', servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.3 }], servicePrefCharge: 0.3 },
    } as NewOrderAction);

    const { result, rerender } = renderHook(() => useNewOrderPiecePreferences([]));
    act(() => {
      result.current.addPreference('pc-1', { preference_code: 'PERFUME', preference_sys_kind: 'service_prefs', extra_price: 0.25 });
    });
    rerender();

    // The STARCH row (0.3) stays on the item but is no longer charged.
    expect(item().servicePrefs).toEqual([{ preference_code: 'STARCH', extra_price: 0.3 }]);
    expect([item().servicePrefCharge, item().totalPrice]).toEqual([0.25, 3.25]);
  });

  it('C05 KNOWN DEFECT (PF-12, other direction): an item preference change drops the piece-preference charge', () => {
    const { result, rerender } = renderHook(() => useNewOrderPiecePreferences([]));
    act(() => {
      result.current.addPreference('pc-1', { preference_code: 'PERFUME', preference_sys_kind: 'service_prefs', extra_price: 0.25 });
    });
    rerender();
    expect(item().servicePrefCharge).toBe(0.25);

    // Item-level preference panels compute the charge from item prefs only.
    dispatch({
      type: 'UPDATE_ITEM_SERVICE_PREFS',
      payload: { productId: 'shirt', servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.3 }], servicePrefCharge: 0.3 },
    } as NewOrderAction);
    expect(item().pieces?.[0].servicePrefs).toEqual([
      expect.objectContaining({ preference_code: 'PERFUME', extra_price: 0.25 }),
    ]);
    expect([item().servicePrefCharge, item().totalPrice]).toEqual([0.3, 3.3]);
  });

  it('C06 a piece packing preference adds its catalog price to the line packing charge', () => {
    const { result, rerender } = renderHook(() =>
      useNewOrderPiecePreferences([{ code: 'BOX', default_extra_price: 0.5 } as never]),
    );
    act(() => {
      result.current.addPreference('pc-2', { preference_code: 'BOX', preference_sys_kind: 'packing_prefs' });
    });
    rerender();
    expect([item().pieces?.[1].packingPrefCode, item().packingPrefCharge, item().totalPrice]).toEqual(['BOX', 0.5, 3.5]);
  });
});
