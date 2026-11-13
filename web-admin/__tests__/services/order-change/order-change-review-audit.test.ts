import { buildOrderChangeOperationAudit, buildPreviewOperationAudits, digestOrderChangeOperationAudits } from '@/lib/services/order-change/order-change-review-audit';
import { buildStructuralWritePlan } from '@/lib/services/order-change/order-change-structural-write';
import type { OrderChangeContext } from '@/lib/types/order-change';

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

  it('signs the piece gross Apply stores when a preference extra changes the line', () => {
    const itemRef = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const pieceRef = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const pieceTotals = new Map([[pieceRef, '3.5000']]);
    const operations = [
      { seq: 1, code: 'ADD_ITEM' as const, target: { kind: 'ORDER' as const }, payload: { clientRef: itemRef, productId, quantity: 1 } },
      { seq: 2, code: 'ADD_PIECE' as const, target: { kind: 'LOCAL_ITEM' as const, clientRef: itemRef }, payload: { clientRef: pieceRef } },
    ];
    const orderMoney = { total_amount: '21.8000', total_tax_amount: '0.0000' };
    const context = { orderId, pieces: [], items: [], workflow: { currentStatus: 'processing' } } as unknown as OrderChangeContext;
    const preview = buildPreviewOperationAudits({
      context,
      operations,
      lines: [{ id: itemRef, unitPrice: '3.0000', merchandiseAmount: '3.0000', embeddedExtra: '0.5000' }],
      catalog: [],
      auditFacts: {
        order: orderMoney,
        items: {},
        pieces: {},
        preferences: {},
        products: { [productId]: { product_name: 'Boxer Shorts', product_name2: null, service_category_code: 'DRY' } },
      },
      pieceTotals,
      projectedTotal: orderMoney.total_amount,
      projectedTax: orderMoney.total_tax_amount,
    });
    const plan = buildStructuralWritePlan(operations, [
      { id: itemRef, active: true, unitPrice: '3.0000', merchandiseAmount: '3.0000', embeddedExtra: '0.5000' },
    ], {
      products: new Map([[productId, { id: productId, productName: 'Boxer Shorts', productName2: null, serviceCategoryCode: 'DRY' }]]),
      pieceItemIds: new Map(),
      branchId: null,
      orderNo: '100',
      itemStatus: 'processing',
      nextItemSerial: 1,
      nextPieceSeqByItemId: new Map(),
    }, 'user-1', pieceTotals);
    const stored = plan.pieceInserts[0];
    const applied = buildOrderChangeOperationAudit({
      operation: operations[1],
      orderId,
      before: {},
      after: { id: stored.id, rec_status: 1, ...stored.data },
      orderBefore: orderMoney,
      orderAfter: orderMoney,
    });
    const reviewed = preview.find((row) => row.code === 'ADD_PIECE');
    expect(reviewed?.afterValues.totalPrice).toBe('3.5000');
    expect(applied.afterValues.totalPrice).toBe('3.5000');
    expect(reviewed).toBeDefined();
    expect(digestOrderChangeOperationAudits([applied])).toBe(digestOrderChangeOperationAudits([reviewed!]));
  });

  it('signs the catalog preference id Apply stores', () => {
    const catalogId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const audits = buildPreviewOperationAudits({
      context: { orderId, pieces: [], items: [], workflow: { currentStatus: 'processing' } } as unknown as OrderChangeContext,
      operations: [{
        seq: 1,
        code: 'ADD_PREFERENCE',
        target: { kind: 'LOCAL_ITEM', clientRef: itemId },
        payload: { clientRef: preferenceId, preferenceId: catalogId.toUpperCase(), preferenceCode: 'STARCH' },
      }],
      lines: [],
      catalog: [{ id: catalogId, code: 'STARCH', kind: 'service_prefs', category: '', level: 'ITEM', extraPrice: '0.5000' }],
      auditFacts: { order: money, items: {}, pieces: {}, preferences: {}, products: {} },
      projectedTotal: money.total_amount,
      projectedTax: money.total_tax_amount,
    });
    expect(audits[0]?.afterValues.preferenceId).toBe(catalogId);
  });
});
