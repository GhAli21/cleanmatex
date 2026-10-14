/**
 * @jest-environment node
 */
import { mapOrderChangeHistory } from '@/lib/services/order-change/order-change-history.service';
import { readEditReview } from '@features/orders/order-change/edit-review-view';

describe('edit review and history', () => {
  it('shows the preview totals and keeps a non-edit origin labelled as legacy', () => {
    const review = readEditReview({
      ok: true,
      data: {
        status: 'READY',
        originalTotal: '10.0000',
        projectedTotal: '10.0000',
        financial: { outcome: 'SETTLED' },
        decisions: [{ seq: 1, decision: 'ALLOW_WITH_WARNING', reasonCode: 'WARN', operationCode: 'CHANGE_ORDER_NOTES', requiresAcknowledgement: true }],
      },
    }, [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'updated' } }], '10.0000');
    expect(review.status).toBe('READY');
    expect(review.operations[0]?.target).toBe('ORDER');
    expect(review.warnings[0]?.requiresAcknowledgement).toBe(true);
    const history = mapOrderChangeHistory([
      {
        id: 'change-1',
        change_no: 2,
        edit_state_version_after: 3,
        source_context: 'legacy-update',
        change_reason: null,
        financial_outcome: 'NONE',
        applied_at: new Date('2026-10-15T00:00:00.000Z'),
      },
    ], []);
    expect(history[0]?.legacy).toBe(true);
    expect(history[0]?.revision).toBe(3);
  });
});
