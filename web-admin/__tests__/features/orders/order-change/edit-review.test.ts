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

  it('P1B-11: lists only the discounts the edit changed or removed', () => {
    const change = (outcome: string) => ({ key: `DISCOUNT_RULE:${outcome}`, adjustmentId: 'order:d1', sourceType: 'DISCOUNT_RULE', sourceId: outcome,
      promotionId: null, sourceName: 'Weekday', sourceName2: null, outcome, reason: outcome === 'REMOVED' ? 'MIN_ORDER_NOT_MET' : null,
      previousAmount: '1.0000', amount: '0.0000' });
    const review = readEditReview({ data: { status: 'ACKNOWLEDGEMENT_REQUIRED', discountChanges: [change('KEPT'), change('CHANGED'), change('REMOVED')] } }, [], '10.0000');
    expect(review.discountChanges.map((c) => c.outcome)).toEqual(['CHANGED', 'REMOVED']);
    expect(readEditReview({ data: { status: 'READY' } }, [], '10.0000').discountChanges).toEqual([]);
  });

  it('P6-02e: shows the price the cart showed only on a line whose price changed', () => {
    const audit = (seq: number) => ({ seq, before: {}, after: {}, beforeValues: {}, afterValues: { shownUnitPrice: '7.5000', pricePerUnit: '8.0000' }, effect: 'add' as const });
    const review = readEditReview({ data: { status: 'READY', operationAudits: [audit(1), audit(2)], priceChanges: [{ seq: 2 }] } }, [
      { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: 'a', productId: 'p', quantity: 1 } },
      { seq: 2, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: 'b', productId: 'p', quantity: 1 } },
    ], '10.0000');
    expect(review.priceChangedSeqs).toEqual([2]);
    expect(review.operations[0].after).toEqual({ pricePerUnit: '8.0000' });
    expect(review.operations[1].after).toEqual({ shownUnitPrice: '7.5000', pricePerUnit: '8.0000' });
  });

  it('uses canonical snapshots and display labels without exposing target ids as fallbacks', () => {
    const review = readEditReview({ data: {
      status: 'READY',
      operationAudits: [{
        seq: 1, before: { quantity: 99 }, after: { quantity: 99 },
        beforeValues: { orderId: 'hidden-order', orderItemId: 'hidden-item', quantity: 1 },
        afterValues: { orderId: 'hidden-order', orderItemId: 'hidden-item', quantity: 2 },
        targetLabel: 'Shirt', targetLabel2: 'قميص', effect: 'change', changedKeys: ['quantity'],
      }],
    } }, [{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: 'hidden-item' }, payload: { quantity: 2 } }], '10.0000', { currencyCode: 'OMR', timezone: 'Asia/Muscat' });
    expect(review.operations[0]).toMatchObject({ target: 'PERSISTED_ITEM', targetLabel: 'Shirt', targetLabel2: 'قميص', before: { quantity: 1 }, after: { quantity: 2 }, changedKeys: ['quantity'] });
    expect(review).toMatchObject({ currencyCode: 'OMR', timezone: 'Asia/Muscat' });
  });
});
