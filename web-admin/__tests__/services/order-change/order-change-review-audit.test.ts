import { buildOrderChangeOperationAudit, digestOrderChangeOperationAudits } from '@/lib/services/order-change/order-change-review-audit';

const orderId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const preferenceId = '44444444-4444-4444-8444-444444444444';
const money = { total_amount: '29.67', total_tax_amount: '1.4129' };
const item = { id: itemId, product_id: preferenceId, product_name: 'Shirt', product_name2: 'قميص', quantity: 1, price_per_unit: '20', total_price: '20', service_pref_charge: '0', price_override: null };

describe('the shared reviewed and stored operation contract', () => {
  it('records no before row for an add and includes the parent, identity, and fixed precision money', () => {
    const audit = buildOrderChangeOperationAudit({
      operation: { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: itemId, productId: preferenceId, quantity: 1 } },
      orderId, before: {}, after: item, orderBefore: {}, orderAfter: money,
      targetLabel: 'Shirt', targetLabel2: 'قميص',
    });
    expect(audit.beforeValues).toEqual({});
    expect(audit.afterValues).toEqual({
      orderId, orderItemId: itemId, clientRef: itemId, productId: preferenceId,
      productName: 'Shirt', productName2: 'قميص', quantity: 1,
      pricePerUnit: '20.0000', totalPrice: '20.0000', priceOverride: null, overrideReason: null,
      serviceCategoryCode: null, totalAmount: '29.6700', taxAmount: '1.4129',
    });
    expect(audit).toMatchObject({ effect: 'add', targetLabel: 'Shirt', targetLabel2: 'قميص' });
    expect(audit.changedKeys).not.toContain('orderItemId');
  });

  it('reports changed business fields and changed commercial totals without exposing identity as a changed key', () => {
    const audit = buildOrderChangeOperationAudit({
      operation: { seq: 2, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { quantity: 2 } },
      orderId, before: item, after: { ...item, quantity: 2, total_price: '40' },
      orderBefore: money, orderAfter: { ...money, total_amount: '49.67' },
    });
    expect(audit.changedKeys).toEqual(['quantity', 'totalPrice', 'totalAmount']);
    expect(audit.beforeValues.pricePerUnit).toBe('20.0000');
    expect(audit.afterValues.pricePerUnit).toBe('20.0000');
  });

  it('keeps packing as its stored preference kind and preserves the full business snapshot on removal', () => {
    const preference = { id: preferenceId, prefs_level: 'ITEM', order_item_id: itemId, preference_code: 'FOLD', preference_sys_kind: 'packing_prefs', preference_content: '', extra_price: '2.5' };
    const added = buildOrderChangeOperationAudit({
      operation: { seq: 3, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: { clientRef: preferenceId, preferenceId, preferenceCode: 'FOLD' } },
      orderId, before: {}, after: preference, orderBefore: money, orderAfter: money,
    });
    expect(added).toMatchObject({ effect: 'add', preferenceKind: 'packing_prefs', beforeValues: {}, afterValues: { preferenceKind: 'packing_prefs', extraPrice: '2.5000', preferenceContent: '' } });
    const removed = buildOrderChangeOperationAudit({
      operation: { seq: 4, code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: preferenceId }, payload: {} },
      orderId, before: preference, after: { ...preference, rec_status: 0 }, orderBefore: money, orderAfter: money,
    });
    expect(removed.effect).toBe('remove');
    expect(removed.afterValues).toEqual({ ...removed.beforeValues, recStatus: 0 });
    expect(removed.afterValues.preferenceCode).toBe('FOLD');
  });

  it('binds every stored value while leaving labels and property insertion order out of the digest', () => {
    const first = { seq: 1, code: 'CHANGE_ORDER_NOTES', beforeValues: { orderId, notes: 'Before' }, afterValues: { orderId, notes: 'After' } };
    const same = { ...first, beforeValues: { notes: 'Before', orderId }, afterValues: { notes: 'After', orderId } };
    expect(digestOrderChangeOperationAudits([same])).toBe(digestOrderChangeOperationAudits([first]));
    expect(digestOrderChangeOperationAudits([{ ...first, afterValues: { orderId, notes: 'Different' } }])).not.toBe(digestOrderChangeOperationAudits([first]));
  });

  it('normalizes timestamps and omits commercial amounts from a documentary change', () => {
    const audit = buildOrderChangeOperationAudit({
      operation: { seq: 1, code: 'CHANGE_READY_BY', target: { kind: 'ORDER' }, payload: { readyBy: null } },
      orderId, before: { ready_by: '2026-10-23T12:00:00+04:00' }, after: { ready_by: null }, orderBefore: money, orderAfter: money,
    });
    expect(audit.beforeValues).toEqual({ orderId, readyBy: '2026-10-23T08:00:00.000Z' });
    expect(audit.afterValues).toEqual({ orderId, readyBy: null });
  });

  it('preserves the full DECIMAL(19,4) value instead of rounding through a JavaScript number', () => {
    const audit = buildOrderChangeOperationAudit({
      operation: { seq: 1, code: 'CHANGE_PRIORITY', target: { kind: 'ORDER' }, payload: { priority: 'URGENT' } },
      orderId, before: { priority: 'NORMAL' }, after: { priority: 'URGENT' },
      orderBefore: { total_amount: '999999999999999.1234', total_tax_amount: '0.0001' },
      orderAfter: { total_amount: '999999999999999.1234', total_tax_amount: '0.0001' },
    });
    expect(audit.beforeValues.totalAmount).toBe('999999999999999.1234');
    expect(audit.afterValues.taxAmount).toBe('0.0001');
  });
});
