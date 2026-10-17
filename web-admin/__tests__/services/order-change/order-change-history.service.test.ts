/**
 * @jest-environment node
 */
import { assembleOrderChangeHistoryDetail, flattenChangeValues } from '@/lib/services/order-change/order-change-history-view';

const header = {
  id: 'change-1',
  changeNo: 4,
  revisionBefore: 3,
  revisionAfter: 4,
  workflowVersionExpected: 9,
  sourceContext: 'order-edit',
  actorName: ' Nora ',
  reason: ' Customer asked ',
  currencyCode: 'AED',
  commercialDelta: '2.5000',
  financialOutcome: 'NONE',
  appliedAt: '2026-10-16T08:00:00.000Z',
  financialBefore: { totalAmount: '10.0000', reviewProof: 'hidden' },
  financialAfter: { totalAmount: '12.5000', taxAmount: '0.5000' },
  metadata: {},
};

describe('order change history view', () => {
  it('joins operations in sequence and keeps removal lineage on the matching change', () => {
    const [change] = assembleOrderChangeHistoryDetail({
      headers: [header, { ...header, id: 'change-2', changeNo: 3, sourceContext: 'legacy-update' }],
      operations: [
        {
          orderChangeId: 'change-1',
          seq: 2,
          code: 'CHANGE_ORDER_NOTES',
          targetType: 'ORDER',
          orderItemId: null,
          orderItemPieceId: null,
          orderPreferenceId: null,
          clientRef: null,
          auditSummary: null,
          beforeValues: {},
          afterValues: { notes: 'updated' },
        },
        {
          orderChangeId: 'change-1',
          seq: 1,
          code: 'REMOVE_ITEM',
          targetType: 'ITEM',
          orderItemId: 'item-1',
          orderItemPieceId: null,
          orderPreferenceId: null,
          clientRef: null,
          auditSummary: 'Removed shirt',
          beforeValues: {},
          afterValues: { quantity: 1 },
        },
      ],
      items: [{
        id: 'item-1',
        deletedOrderChangeId: 'change-1',
        label: 'Shirt',
        label2: 'قميص',
        quantity: '1',
        code: 'BC-1',
        deletedAt: '2026-10-16T08:00:00.000Z',
      }],
      pieces: [{
        id: 'piece-1',
        deletedOrderChangeId: 'change-1',
        orderItemId: 'item-1',
        label: 'BC-1',
        label2: 'Brand',
        quantity: '1',
        code: 'P-1',
        deletedAt: '2026-10-16T08:00:00.000Z',
      }],
      preferences: [{
        id: 'pref-1',
        deletedOrderChangeId: 'change-2',
        label: 'STARCH',
        label2: 'Heavy',
        level: 'ITEM',
        extraPrice: '1.0000',
        deletedAt: '2026-10-15T08:00:00.000Z',
      }],
    });

    expect(change?.legacy).toBe(false);
    expect(change?.actorName).toBe('Nora');
    expect(change?.operations.map((operation) => operation.seq)).toEqual([1, 2]);
    expect(change?.operations[0]?.targetLabel).toBe('Shirt');
    expect(change?.operations[0]?.auditSummary).toBe('Removed shirt');
    expect(change?.financialBefore.map((field) => field.key)).toEqual(['totalAmount']);
    expect(change?.removals.map((row) => row.kind)).toEqual(['ITEM', 'PIECE']);
    expect(change?.removals[1]?.parentLabel).toBe('Shirt');
  });

  it('drops sensitive snapshot keys', () => {
    expect(flattenChangeValues({ totalAmount: '1', idempotencyKey: 'secret', nested: { ok: true } })).toEqual([
      { key: 'totalAmount', value: '1' },
      { key: 'nested', value: '{"ok":true}' },
    ]);
  });
});
