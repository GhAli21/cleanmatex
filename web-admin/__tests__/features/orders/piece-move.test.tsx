/**
 * Cart Line Grouping P3 (docs/features/Order_Cart_Line_Grouping/DESIGN.md §5): moving a piece between
 * lines of one product: the move itself, unique piece ids, when it is refused, and the row menu.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { nextPieceId } from '@/src/features/orders/model/cart-line-key';
import { pieceMoveTargets } from '@/src/features/orders/model/cart-line-grouping';
import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import type { LineKey, NewOrderState, OrderItem } from '@/src/features/orders/model/new-order-types';

let seed: NewOrderState = initialState;
let editSession: { editPolicy: object } | null = null;
let blockedCodes: string[] = [];

jest.mock('@/src/features/orders/ui/context/new-order-context', () => ({
  useNewOrderContext: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- test double of the context hook
    const [state, dispatch] = useReducer(newOrderReducer, seed);
    return { state, dispatch };
  },
}));
jest.mock('@/src/features/orders/order-change/order-workspace-session', () => ({
  useOrderWorkspaceSessionOptional: () => editSession,
}));
jest.mock('@/src/features/orders/order-change/edit-control-capability', () => ({
  resolveEditControlCapability: (_policy: object, code: string) => ({ interactive: !blockedCodes.includes(code) }),
  resolveEditControlGroup: (_policy: object, codes: string[]) => ({ interactive: !codes.some((code) => blockedCodes.includes(code)) }),
}));
jest.mock('@/src/features/orders/hooks/use-preference-catalog', () => ({ usePreferenceCatalog: () => ({ packingPrefs: [] }) }));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values?.number != null ? `${key}:${values.number}` : key),
  useLocale: () => 'en',
}));
jest.mock('@ui/feedback', () => ({ cmxMessage: { success: jest.fn(), warning: jest.fn() } }));
// The primitives barrel reaches a server action through the money field; keep it out of jsdom.
jest.mock('@/lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({ decimalPlaces: 3 }) }));

import { useNewOrderStateWithDispatch } from '@/src/features/orders/hooks/use-new-order-state';
import { PieceMoveMenu } from '@/src/features/orders/ui/piece-move-menu';

const key = (value: string) => value as LineKey;
const starch = { preference_code: 'STARCH', source: 'manual', extra_price: 0.5, persistedId: 'pref-1' };

function line(id: string, quantity: number, over: Partial<OrderItem> = {}): OrderItem {
  return {
    lineKey: key(id), productId: 'shirt', productName: 'Shirt', productName2: null, quantity,
    pricePerUnit: 2, totalPrice: 2 * quantity, defaultSellPrice: 2,
    pieces: Array.from({ length: quantity }, (_, i) => ({ id: `temp-${id}-${i + 1}`, itemId: key(id), pieceSeq: i + 1 })),
    ...over,
  };
}
const cart = (items: OrderItem[], over: Partial<NewOrderState> = {}): NewOrderState => ({ ...initialState, items, ...over });
const move = (state: NewOrderState, from: string, pieceId?: string, to?: string) =>
  newOrderReducer(state, { type: 'MOVE_PIECE', payload: { lineKey: key(from), pieceId, toLineKey: to ? key(to) : undefined, newLineKey: key('n') } });

beforeEach(() => { editSession = null; blockedCodes = []; seed = initialState; });

describe('MOVE_PIECE', () => {
  it('starts an open line right after the source and carries the piece and the line preferences', () => {
    const source = line('a', 2, { priceOverride: 1, pricePerUnit: 1, serviceSpeed: 'EXPRESS', notes: 'line note', servicePrefs: [starch] });
    source.pieces![0] = { ...source.pieces![0], notes: 'collar stain', servicePrefs: [{ ...starch, extra_price: 0.25 }] };
    const after = move(cart([source, line('t', 1, { productId: 'tie' })], { selectedPieceId: 'temp-a-1' }), 'a', 'temp-a-1');

    expect(after.items.map((i) => i.lineKey)).toEqual(['a', 'n', 't']);
    expect(after.items[0]).toMatchObject({ quantity: 1, priceOverride: 1, serviceSpeed: 'EXPRESS', servicePrefCharge: 0.5, totalPrice: 1.5 });
    expect(after.items[0].pieces).toEqual([expect.objectContaining({ id: 'temp-a-2', pieceSeq: 1 })]);
    expect(after.items[1]).toMatchObject({
      quantity: 1, priceOverride: null, pricePerUnit: 2, serviceSpeed: null, notes: undefined, servicePrefCharge: 0.75, totalPrice: 2.75,
    });
    expect(after.items[1].pieces![0]).toMatchObject({ id: 'temp-n-1', itemId: 'n', pieceSeq: 1, notes: 'collar stain' });
    // A copied preference is a new row: with the saved id, Order Edit would not send it.
    expect(after.items[1].servicePrefs![0].persistedId).toBeUndefined();
    expect(after.items[1].pieces![0].servicePrefs![0].persistedId).toBeUndefined();
    expect(after.selectedPieceId).toBe('temp-n-1');
  });

  it('moves onto an existing line and removes an emptied source', () => {
    const after = move(cart([line('a', 1), line('b', 2, { priceOverride: 5 })]), 'a', 'temp-a-1', 'b');
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({ lineKey: 'b', quantity: 3, priceOverride: 5 });
    expect(after.items[0].pieces!.map((p) => p.pieceSeq)).toEqual([1, 2, 3]);
    expect(new Set(after.items[0].pieces!.map((p) => p.id)).size).toBe(3);
  });

  it('never repeats a piece id after renumbering', () => {
    const afterMove = move(cart([line('a', 3), line('b', 1)]), 'a', 'temp-a-1', 'b');
    const added = newOrderReducer(afterMove, { type: 'UPDATE_ITEM_QUANTITY', payload: { lineKey: key('a'), quantity: 3 } });
    const ids = added.items[0].pieces!.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(nextPieceId('a', [{ id: 'temp-a-2' }, { id: 'temp-a-3' }], 2)).toBe('temp-a-4');
  });

  it('moves a line without stored pieces by quantity', () => {
    const after = move(cart([line('a', 3, { pieces: undefined })]), 'a');
    expect(after.items.map((i) => [i.quantity, i.pieces])).toEqual([[2, undefined], [1, undefined]]);
  });

  it.each([
    ['another product', () => move(cart([line('a', 2), line('b', 1, { productId: 'tie' })]), 'a', undefined, 'b')],
    ['a measured target', () => move(cart([line('a', 2), line('b', 1, { uom: { code: 'M' } as OrderItem['uom'] })]), 'a', undefined, 'b')],
    ['a custom line', () => move(cart([line('a', 2, { customItem: { name: 'X', name2: null, unitPrice: 1 } })]), 'a')],
    ['the only piece to a new line', () => move(cart([line('a', 1)]), 'a')],
    ['an unknown piece', () => move(cart([line('a', 2)]), 'a', 'temp-a-9')],
  ])('refuses %s', (_name, run) => {
    expect(run().items.map((i) => i.lineKey)).not.toContain('n');
    expect(run().items.reduce((sum, i) => sum + (i.productId === 'shirt' ? i.quantity : 0), 0)).toBeGreaterThan(0);
  });

  it('lists only movable lines of the same product as targets', () => {
    const items = [line('a', 2), line('b', 1), line('c', 1, { productId: 'tie' }), line('d', 1, { uom: { code: 'M' } as OrderItem['uom'] })];
    expect(pieceMoveTargets(items, key('a')).map((i) => i.lineKey)).toEqual(['b']);
  });
});

describe('movePiece in the state hook', () => {
  const setup = (items: OrderItem[]) => {
    seed = cart(items);
    return renderHook(() => useNewOrderStateWithDispatch());
  };

  it('reports the receiving line and the piece\'s new id', () => {
    const r = setup([line('a', 2)]);
    let result: ReturnType<typeof r.result.current.movePiece> = { status: 'BLOCKED' };
    act(() => { result = r.result.current.movePiece(key('a'), { pieceId: 'temp-a-2' }); });
    const created = r.result.current.state.items[1];
    expect(result).toEqual({ status: 'OK', lineKey: created.lineKey, lineNumber: 2, pieceId: created.pieces![0].id });
  });

  it('keeps a saved piece on its line (Order Edit)', () => {
    editSession = { editPolicy: {} };
    const saved = line('a', 2);
    saved.pieces![1] = { ...saved.pieces![1], persistedId: 'db-piece' };
    const r = setup([saved]);
    expect(r.result.current.pieceMoveBlock(key('a'), 'temp-a-2')).toBe('SAVED_PIECE');
    expect(r.result.current.pieceMoveBlock(key('a'), 'temp-a-1')).toBeNull();
  });

  it('needs ADD_ITEM only for a new line', () => {
    editSession = { editPolicy: {} };
    blockedCodes = ['ADD_ITEM'];
    const r = setup([line('a', 2), line('b', 1)]);
    expect(r.result.current.pieceMoveBlock(key('a'))).toBe('BLOCKED');
    expect(r.result.current.pieceMoveBlock(key('a'), undefined, key('b'))).toBeNull();
  });
});

describe('PieceMoveMenu', () => {
  it('names the price rules a move leaves behind and takes on', () => {
    seed = cart([line('a', 2, { priceOverride: 1 }), line('b', 1, { serviceSpeed: 'EXPRESS' })]);
    render(<PieceMoveMenu lineKey={key('a')} pieceId="temp-a-1" pieceNumber={1} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'moveToNewLineleavesPrice:1',
      'moveToLine:2leavesPrice:1takesSpeed:2',
    ]);
  });

  it('renders nothing for a single piece with no other line', () => {
    seed = cart([line('a', 1)]);
    const { container } = render(<PieceMoveMenu lineKey={key('a')} pieceId="temp-a-1" />);
    expect(container.innerHTML).toBe('');
  });
});
