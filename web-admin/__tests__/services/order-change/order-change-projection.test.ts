import { projectOrderChangeStructure } from '@/lib/services/order-change/order-change-projection';

const productA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const productB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const itemId = '11111111-1111-4111-8111-111111111111';
const secondItemId = '22222222-2222-4222-8222-222222222222';
const pieceA = 'aaaaaaaa-1111-4111-8111-111111111111';
const pieceB = 'bbbbbbbb-2222-4222-8222-222222222222';
const pieceC = 'cccccccc-3333-4333-8333-333333333333';
const localItem = 'dddddddd-4444-4444-8444-444444444444';
const localItemTwo = 'eeeeeeee-5555-4555-8555-555555555555';
const localPiece = 'ffffffff-6666-4666-8666-666666666666';

describe('projectOrderChangeStructure', () => {
  it('keeps duplicate product lines and duplicate sequence numbers on distinct identities', () => {
    const projected = projectOrderChangeStructure(
      {
        items: [{ id: itemId, productId: productA, quantity: 1, pieceTracked: false, active: true }],
        pieces: [],
      },
      [
        { seq: 2, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItem, productId: productA, quantity: 1 } },
        { seq: 2, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItemTwo, productId: productA, quantity: 2 } },
      ],
    );

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.items.filter((item) => item.productId === productA && item.active)).toHaveLength(3);
    expect(projected.items.map((item) => item.id)).toEqual([itemId, localItem, localItemTwo].sort());
    expect(projected.createsChange).toBe(true);
  });

  it('materializes a new tracked item once when pieces match the declared quantity', () => {
    const projected = projectOrderChangeStructure(
      { items: [], pieces: [] },
      [
        { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItem, productId: productB, quantity: 3 } },
        { seq: 2, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: localItem }, payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' } },
        { seq: 3, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: localItem }, payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002' } },
        { seq: 4, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: localItem }, payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003' } },
      ],
    );

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.items[0]).toMatchObject({ id: localItem, quantity: 3, pieceTracked: true });
    expect(projected.pieces).toHaveLength(3);
  });

  it('cancels a local item that is added and removed in the same batch', () => {
    const projected = projectOrderChangeStructure(
      { items: [{ id: itemId, productId: productA, quantity: 1, pieceTracked: false, active: true }], pieces: [] },
      [
        { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItem, productId: productB, quantity: 1 } },
        { seq: 2, code: 'REMOVE_ITEM', target: { kind: 'LOCAL_ITEM', clientRef: localItem } },
      ],
    );

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.createsChange).toBe(false);
    expect(projected.items.map((item) => item.id)).toEqual([itemId]);
    expect(projected.effects).toEqual([]);
  });

  it('rejects a zero or negative quantity without changing the baseline', () => {
    const baseline = { items: [{ id: itemId, productId: productA, quantity: 2, pieceTracked: false, active: true }], pieces: [] };
    expect(projectOrderChangeStructure(baseline, [
      { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { quantity: 0 } },
    ]).ok).toBe(false);
    expect(projectOrderChangeStructure(baseline, [
      { seq: 4, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItem, productId: productA, quantity: -1 } },
    ])).toMatchObject({ ok: false, issue: { code: 'QUANTITY_INVALID', seq: 4 } });
  });

  it('requires the concrete eligible pieces for a tracked reduction and removes each piece once', () => {
    const baseline = {
      items: [{ id: itemId, productId: productA, quantity: 3, pieceTracked: true, active: true }],
      pieces: [pieceA, pieceB, pieceC].map((id) => ({ id, itemId, active: true, operationallyProtected: false })),
    };
    const projected = projectOrderChangeStructure(baseline, [
      { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { quantity: 1, selectedPieceIds: [pieceA, pieceB] } },
      { seq: 2, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: pieceA } },
    ]);

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.items[0]).toMatchObject({ id: itemId, quantity: 1, active: true });
    expect(projected.pieces.filter((piece) => piece.active).map((piece) => piece.id)).toEqual([pieceC]);
    expect(projected.pieces.map((piece) => piece.id).sort()).toEqual([pieceA, pieceB, pieceC].sort());
  });

  it('rejects a protected operational piece and a child change after parent removal', () => {
    const baseline = {
      items: [
        { id: itemId, productId: productA, quantity: 1, pieceTracked: true, active: true },
        { id: secondItemId, productId: productB, quantity: 1, pieceTracked: true, active: true },
      ],
      pieces: [
        { id: pieceA, itemId, active: true, operationallyProtected: true },
        { id: pieceB, itemId: secondItemId, active: true, operationallyProtected: false },
      ],
    };

    expect(projectOrderChangeStructure(baseline, [
      { seq: 3, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: pieceA } },
    ])).toMatchObject({ ok: false, issue: { code: 'PIECE_OPERATIONALLY_PROTECTED', seq: 3 } });

    expect(projectOrderChangeStructure(baseline, [
      { seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: secondItemId } },
      { seq: 2, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: pieceB } },
    ])).toMatchObject({ ok: false, issue: { code: 'PARENT_CHILD_CONFLICT', seq: 2 } });
  });

  it('propagates parent removal without dropping the persisted piece identity', () => {
    const projected = projectOrderChangeStructure(
      {
        items: [{ id: itemId, productId: productA, quantity: 1, pieceTracked: true, active: true }],
        pieces: [{ id: pieceA, itemId, active: true, operationallyProtected: false }],
      },
      [{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: itemId } }],
    );

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.items[0]).toMatchObject({ id: itemId, active: false });
    expect(projected.pieces[0]).toMatchObject({ id: pieceA, active: false });
    expect(projected.createsChange).toBe(true);
  });

  it('rejects an unresolved local parent and a piece added before its item exists', () => {
    expect(projectOrderChangeStructure({ items: [], pieces: [] }, [
      { seq: 1, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: localItem }, payload: { clientRef: localPiece } },
      { seq: 2, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: localItem, productId: productA, quantity: 1 } },
    ])).toMatchObject({ ok: false, issue: { code: 'UNRESOLVED_LOCAL_REF', seq: 1 } });
  });
});
