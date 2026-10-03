import { ORDER_CHANGE_LIMITS, ORDER_CHANGE_RATE_LIMITS } from '@/lib/constants/order-change';
import {
  orderChangeApplyRequestSchema,
  orderChangeHistoryQuerySchema,
  orderChangeIdempotencyKeySchema,
  orderChangeRequestSchema,
} from '@/lib/validations/order-change/order-change.schemas';

const request = {
  expectedEditStateVersion: 1,
  expectedWfStateVersion: 1,
  sourceContext: 'STAFF_EDIT',
  operations: [{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: '11111111-1111-4111-8111-111111111111' }, payload: { quantity: 2 } }],
};

describe('Order Change V1 request schema', () => {
  it('rejects unknown nested fields and duplicate operation sequences', () => {
    expect(orderChangeRequestSchema.safeParse({ ...request, unknown: true }).success).toBe(false);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [...request.operations, { ...request.operations[0] }] }).success).toBe(false);
  });

  it('rejects product replacement and browser-authored money fields on existing lines', () => {
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ ...request.operations[0], payload: { quantity: 2, productId: '22222222-2222-2222-2222-222222222222' } }] }).success).toBe(false);
  });

  it('accepts only the frozen contract shape for a new item', () => {
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: '33333333-3333-4333-8333-333333333333', productId: '44444444-4444-4444-8444-444444444444', quantity: 999 } }] }).success).toBe(true);
  });

  it('allows a preference on a piece created earlier in the same request and requires preference content for a change', () => {
    const localPiecePreference = {
      ...request,
      operations: [{
        seq: 1,
        code: 'ADD_PREFERENCE',
        target: { kind: 'LOCAL_PIECE', clientRef: '33333333-3333-4333-8333-333333333333' },
        payload: {
          clientRef: '44444444-4444-4444-8444-444444444444',
          preferenceId: '55555555-5555-4555-8555-555555555555',
          preferenceCode: 'STARCH',
        },
      }],
    };
    expect(orderChangeRequestSchema.safeParse(localPiecePreference).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: '66666666-6666-4666-8666-666666666666' }, payload: {} }] }).success).toBe(false);
  });

  it('accepts the operation ceiling and rejects graph fanout beyond its finite bounds', () => {
    const quantityOperations = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_OPERATIONS }, (_, index) => ({
      seq: index + 1,
      code: 'CHANGE_ITEM_QUANTITY' as const,
      target: { kind: 'PERSISTED_ITEM' as const, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` },
      payload: { quantity: 2 },
    }));
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: quantityOperations }).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [...quantityOperations, { ...quantityOperations[0], seq: 51 }] }).success).toBe(false);

    const addedItems = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_ADD_ITEM_OPERATIONS + 1 }, (_, index) => ({
      seq: index + 1,
      code: 'ADD_ITEM' as const,
      target: { kind: 'ORDER' as const },
      payload: {
        clientRef: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        productId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        quantity: 1,
      },
    }));
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: addedItems }).success).toBe(false);

    const addedPieces = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_ADD_PIECE_OPERATIONS }, (_, index) => ({
      seq: index + 1,
      code: 'ADD_PIECE' as const,
      target: { kind: 'PERSISTED_ITEM' as const, id: '40000000-0000-4000-8000-000000000001' },
      payload: { clientRef: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` },
    }));
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: addedPieces }).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [...addedPieces, { ...addedPieces[0], seq: 51 }] }).success).toBe(false);

    const addedPreferences = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_ADD_PREFERENCE_OPERATIONS }, (_, index) => ({
      seq: index + 1,
      code: 'ADD_PREFERENCE' as const,
      target: { kind: 'ORDER' as const },
      payload: {
        clientRef: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        preferenceId: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        preferenceCode: `PREF_${index + 1}`,
      },
    }));
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: addedPreferences }).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [...addedPreferences, { ...addedPreferences[0], seq: 51 }] }).success).toBe(false);

    const selectedPieceIds = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_SELECTED_PIECE_IDS + 1 }, (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ ...request.operations[0], payload: { quantity: 2, selectedPieceIds } }] }).success).toBe(false);
  });

  it('enforces existing field boundaries, proof/key bounds, and history pagination', () => {
    expect(orderChangeRequestSchema.safeParse({ ...request, changeReason: 'r'.repeat(ORDER_CHANGE_LIMITS.MAX_CHANGE_REASON_LENGTH) }).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, changeReason: 'r'.repeat(ORDER_CHANGE_LIMITS.MAX_CHANGE_REASON_LENGTH + 1) }).success).toBe(false);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'n'.repeat(ORDER_CHANGE_LIMITS.MAX_ORDER_NOTE_LENGTH + 1) } }] }).success).toBe(false);
    expect(orderChangeRequestSchema.safeParse({ ...request, operations: [{ seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: '66666666-6666-4666-8666-666666666666' }, payload: { preferenceContent: 'p'.repeat(ORDER_CHANGE_LIMITS.MAX_PREFERENCE_CONTENT_LENGTH + 1) } }] }).success).toBe(false);

    const apply = { ...request, reviewProof: 'p'.repeat(ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH), calculationFingerprint: 'f'.repeat(ORDER_CHANGE_LIMITS.MAX_CALCULATION_FINGERPRINT_LENGTH) };
    expect(orderChangeApplyRequestSchema.safeParse(apply).success).toBe(true);
    expect(orderChangeApplyRequestSchema.safeParse({ ...apply, reviewProof: `${apply.reviewProof}x` }).success).toBe(false);
    expect(orderChangeIdempotencyKeySchema.safeParse('k'.repeat(ORDER_CHANGE_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH)).success).toBe(true);
    expect(orderChangeIdempotencyKeySchema.safeParse('k'.repeat(ORDER_CHANGE_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH + 1)).success).toBe(false);
    const gateDecisions = Array.from({ length: ORDER_CHANGE_LIMITS.MAX_GATE_DECISIONS }, (_, index) => ({ seq: index + 1, gateCode: `GATE_${index + 1}` }));
    expect(orderChangeRequestSchema.safeParse({ ...request, gateDecisions }).success).toBe(true);
    expect(orderChangeRequestSchema.safeParse({ ...request, gateDecisions: [...gateDecisions, { seq: 21, gateCode: 'GATE_21' }] }).success).toBe(false);
    expect(orderChangeHistoryQuerySchema.parse({})).toEqual({ limit: ORDER_CHANGE_LIMITS.HISTORY_DEFAULT_PAGE_SIZE });
    expect(orderChangeHistoryQuerySchema.safeParse({ limit: ORDER_CHANGE_LIMITS.HISTORY_MAX_PAGE_SIZE, cursor: 'c'.repeat(ORDER_CHANGE_LIMITS.HISTORY_MAX_CURSOR_LENGTH) }).success).toBe(true);
    expect(orderChangeHistoryQuerySchema.safeParse({ limit: ORDER_CHANGE_LIMITS.HISTORY_MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(orderChangeHistoryQuerySchema.safeParse({ cursor: 'c'.repeat(ORDER_CHANGE_LIMITS.HISTORY_MAX_CURSOR_LENGTH + 1) }).success).toBe(false);
  });

  it('keeps the future Preview/Apply rate policy bounded and distinct', () => {
    expect(ORDER_CHANGE_RATE_LIMITS).toEqual({
      PREVIEW_PER_ACTOR_PER_MINUTE: 30,
      PREVIEW_PER_ORDER_PER_MINUTE: 10,
      APPLY_PER_ACTOR_PER_MINUTE: 10,
      APPLY_PER_ORDER_PER_MINUTE: 5,
    });
  });
});
