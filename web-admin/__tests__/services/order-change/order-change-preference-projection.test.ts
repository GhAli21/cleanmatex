import { projectOrderChangePreferences } from '@/lib/services/order-change/order-change-preference-projection';

const itemId = '11111111-1111-4111-8111-111111111111';
const pieceId = 'aaaaaaaa-1111-4111-8111-111111111111';
const otherPieceId = 'bbbbbbbb-2222-4222-8222-222222222222';
const packingId = 'cccccccc-3333-4333-8333-333333333333';
const conditionId = 'dddddddd-4444-4444-8444-444444444444';
const noteId = 'eeeeeeee-5555-4555-8555-555555555555';
const rowId = 'ffffffff-6666-4666-8666-666666666666';
const localRef = '99999999-9999-4999-8999-999999999999';

const catalog = [
  { id: packingId, code: 'HANGER', kind: 'PACKING', category: 'PACKING', level: 'ORDER' as const, extraPrice: '3.0000' },
  { id: conditionId, code: 'STAIN', kind: 'CONDITION', category: 'CONDITION', level: 'ITEM' as const, extraPrice: '2.5000' },
  { id: noteId, code: 'CUFF_NOTE', kind: 'SERVICE_NOTE', category: 'NOTE', level: 'PIECE' as const, extraPrice: '1.2500' },
];

const baseline = {
  items: [{ id: itemId, productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 1, pieceTracked: true, active: true }],
  pieces: [{ id: pieceId, itemId, active: true, operationallyProtected: false }],
};

describe('projectOrderChangePreferences', () => {
  it('adds one preference at each level and counts ORDER separately from the line', () => {
    const projected = projectOrderChangePreferences({
      baseline,
      preferences: [],
      catalog,
      operations: [
        { seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'ORDER' }, payload: { clientRef: '10000000-0000-4000-8000-000000000001', preferenceId: packingId, preferenceCode: 'HANGER', preferenceContent: 'Wooden' } },
        { seq: 2, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { clientRef: '10000000-0000-4000-8000-000000000002', preferenceId: conditionId, preferenceCode: 'STAIN' } },
        { seq: 3, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_PIECE', id: pieceId }, payload: { clientRef: '10000000-0000-4000-8000-000000000003', preferenceId: noteId, preferenceCode: 'CUFF_NOTE', preferenceContent: 'Loose thread' } },
      ],
    });

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.preferences.map((row) => row.preferenceKind).sort()).toEqual(['CONDITION', 'PACKING', 'SERVICE_NOTE']);
    expect(projected.charges.orderAddend).toBe('3.0000');
    expect(projected.charges.lineEmbeddedByItemId).toEqual({ [itemId]: '3.7500' });
    expect(projected.createsChange).toBe(true);
  });

  it('keeps the persisted id when content changes and preserves an untouched row', () => {
    const untouched = {
      id: '88888888-8888-4888-8888-888888888888',
      level: 'ORDER' as const,
      orderItemId: null,
      orderItemPieceId: null,
      preferenceId: packingId,
      preferenceCode: 'HANGER',
      preferenceKind: 'PACKING',
      preferenceCategory: 'PACKING',
      preferenceContent: 'Keep',
      extraPrice: '3.0000',
      processingConfirmed: true,
      active: true,
    };
    const projected = projectOrderChangePreferences({
      baseline,
      preferences: [
        untouched,
        {
          id: rowId,
          level: 'ITEM',
          orderItemId: itemId,
          orderItemPieceId: null,
          preferenceId: conditionId,
          preferenceCode: 'STAIN',
          preferenceKind: 'CONDITION',
          preferenceCategory: 'CONDITION',
          preferenceContent: 'Old',
          extraPrice: '2.5000',
          processingConfirmed: true,
          active: true,
        },
      ],
      catalog,
      operations: [
        { seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: rowId }, payload: { preferenceContent: 'Noted' } },
      ],
    });

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.preferences.find((row) => row.id === rowId)).toMatchObject({ preferenceContent: 'Noted', preferenceKind: 'CONDITION', processingConfirmed: true });
    expect(projected.preferences.find((row) => row.id === untouched.id)).toEqual(untouched);
    expect(projected.charges.orderAddend).toBe('3.0000');
    expect(projected.charges.lineEmbeddedByItemId[itemId]).toBe('2.5000');
  });

  it('rejects a catalog code mismatch, a kind swap, and a child edit after parent removal', () => {
    expect(projectOrderChangePreferences({
      baseline,
      preferences: [],
      catalog,
      operations: [
        { seq: 4, code: 'ADD_PREFERENCE', target: { kind: 'ORDER' }, payload: { clientRef: localRef, preferenceId: packingId, preferenceCode: 'BOX' } },
      ],
    })).toMatchObject({ ok: false, issue: { code: 'PREFERENCE_SOURCE_MISMATCH', seq: 4 } });

    expect(projectOrderChangePreferences({
      baseline,
      preferences: [{
        id: rowId, level: 'ITEM', orderItemId: itemId, orderItemPieceId: null, preferenceId: conditionId, preferenceCode: 'STAIN', preferenceKind: 'CONDITION', preferenceCategory: 'CONDITION', preferenceContent: null, extraPrice: '2.5000', processingConfirmed: false, active: true,
      }],
      catalog,
      operations: [
        { seq: 2, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: rowId }, payload: { preferenceId: noteId, preferenceContent: 'Swap' } },
      ],
    })).toMatchObject({ ok: false, issue: { code: 'PREFERENCE_KIND_REPLACEMENT', seq: 2 } });

    expect(projectOrderChangePreferences({
      baseline,
      preferences: [{
        id: rowId, level: 'PIECE', orderItemId: itemId, orderItemPieceId: pieceId, preferenceId: noteId, preferenceCode: 'CUFF_NOTE', preferenceKind: 'SERVICE_NOTE', preferenceCategory: 'NOTE', preferenceContent: null, extraPrice: '1.2500', processingConfirmed: false, active: true,
      }],
      catalog,
      structuralOperations: [{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: itemId } }],
      operations: [
        { seq: 2, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: rowId }, payload: { preferenceContent: 'After removal' } },
      ],
    })).toMatchObject({ ok: false, issue: { code: 'PARENT_CHILD_CONFLICT', seq: 2 } });
  });

  it('replaces a kind by remove plus add and does not count a removed extra twice', () => {
    const projected = projectOrderChangePreferences({
      baseline,
      preferences: [{
        id: rowId, level: 'ITEM', orderItemId: itemId, orderItemPieceId: null, preferenceId: conditionId, preferenceCode: 'STAIN', preferenceKind: 'CONDITION', preferenceCategory: 'CONDITION', preferenceContent: null, extraPrice: '2.5000', processingConfirmed: false, active: true,
      }],
      catalog: [
        ...catalog,
        { id: 'abababab-abab-4aba-8aba-abababababab', code: 'FOLD', kind: 'PACKING', category: 'PACKING', level: 'ITEM' as const, extraPrice: '0.5000' },
      ],
      operations: [
        { seq: 1, code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: rowId } },
        { seq: 2, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { clientRef: localRef, preferenceId: 'abababab-abab-4aba-8aba-abababababab', preferenceCode: 'FOLD' } },
      ],
    });

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.preferences.find((row) => row.id === rowId)).toMatchObject({ active: false });
    expect(projected.preferences.find((row) => row.id === localRef)).toMatchObject({ preferenceKind: 'PACKING', active: true });
    expect(projected.charges.lineEmbeddedByItemId).toEqual({ [itemId]: '0.5000' });
    expect(projected.charges.orderAddend).toBe('0.0000');
  });

  it('cancels a local preference added and removed in the same batch', () => {
    const projected = projectOrderChangePreferences({
      baseline,
      preferences: [],
      catalog,
      operations: [
        { seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'ORDER' }, payload: { clientRef: localRef, preferenceId: packingId, preferenceCode: 'HANGER' } },
        { seq: 2, code: 'REMOVE_PREFERENCE', target: { kind: 'LOCAL_PREFERENCE', clientRef: localRef } },
      ],
    });

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.createsChange).toBe(false);
    expect(projected.preferences).toEqual([]);
    expect(projected.charges.orderAddend).toBe('0.0000');
  });

  it('rejects a piece preference aimed at a piece outside the order', () => {
    expect(projectOrderChangePreferences({
      baseline,
      preferences: [],
      catalog,
      operations: [
        { seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_PIECE', id: otherPieceId }, payload: { clientRef: localRef, preferenceId: noteId, preferenceCode: 'CUFF_NOTE' } },
      ],
    })).toMatchObject({ ok: false, issue: { code: 'PARENT_CHILD_CONFLICT', seq: 1 } });
  });

  it('leaves an unchanged preference batch without a change', () => {
    const row = {
      id: rowId, level: 'ORDER' as const, orderItemId: null, orderItemPieceId: null, preferenceId: packingId, preferenceCode: 'HANGER', preferenceKind: 'PACKING', preferenceCategory: 'PACKING', preferenceContent: 'Same', extraPrice: '3.0000', processingConfirmed: true, active: true,
    };
    const projected = projectOrderChangePreferences({
      baseline,
      preferences: [row],
      catalog,
      operations: [
        { seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: rowId }, payload: { preferenceContent: 'Same' } },
      ],
    });

    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.createsChange).toBe(false);
    expect(projected.preferences).toEqual([row]);
  });
});
