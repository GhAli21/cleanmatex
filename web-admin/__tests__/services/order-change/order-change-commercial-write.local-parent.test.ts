import { buildCommercialWritePlan, preferenceParentIsLocal } from '@/lib/services/order-change/order-change-commercial-write';

type Ops = Parameters<typeof buildCommercialWritePlan>[0];

const NEW_ITEM = '11111111-1111-4111-8111-111111111111';
const NEW_PIECE = '22222222-2222-4222-8222-222222222222';
const PREF_A = '33333333-3333-4333-8333-333333333333';
const PREF_B = '44444444-4444-4444-8444-444444444444';
const CATALOG = '55555555-5555-4555-8555-555555555555';

const facts = {
  pieceItemIds: new Map<string, string>(),
  catalogById: new Map([[CATALOG, { id: CATALOG, preferenceCode: 'STARCH', extraPrice: '0.5000', preferenceSysKind: 'SERVICE', preferenceCategory: null }]]),
  nextPrefsNo: 0,
  branchId: null,
};

const pref = (seq: number, clientRef: string, target: Record<string, string>) => ({
  seq, code: 'ADD_PREFERENCE', target, payload: { clientRef, preferenceId: CATALOG, preferenceCode: 'STARCH' },
});

const ops = [
  { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: NEW_ITEM } },
  { seq: 2, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: NEW_ITEM }, payload: { clientRef: NEW_PIECE } },
  pref(3, PREF_A, { kind: 'LOCAL_ITEM', clientRef: NEW_ITEM }),
  pref(4, PREF_B, { kind: 'LOCAL_PIECE', clientRef: NEW_PIECE }),
] as unknown as Ops;

describe('preferences on rows added in the same Change', () => {
  it('attaches them to the new item and piece ids', () => {
    expect(preferenceParentIsLocal(ops)).toBe(false);
    const plan = buildCommercialWritePlan(ops, 'actor', facts);
    expect(plan.preferenceInserts[0].data).toMatchObject({ prefs_level: 'ITEM', order_item_id: NEW_ITEM });
    expect(plan.preferenceInserts[0].data).not.toHaveProperty('order_item_piece_id');
    expect(plan.preferenceInserts[1].data).toMatchObject({ prefs_level: 'PIECE', order_item_id: NEW_ITEM, order_item_piece_id: NEW_PIECE });
  });

  it('still rejects a local parent the Change does not add', () => {
    expect(preferenceParentIsLocal([pref(1, PREF_A, { kind: 'LOCAL_ITEM', clientRef: NEW_ITEM })] as unknown as Ops)).toBe(true);
  });
});
