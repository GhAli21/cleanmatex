/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEditOrderController } from '@features/orders/order-change/edit-order-controller';
import { applyVisualDraftToController, projectEditVisualOrder, visualHeaderChangeCount } from '@features/orders/order-change/edit-workspace-adapter';
import { mapChangeContextToEditBaseline } from '@features/orders/order-change/edit-order-view-model';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { EditOrderBaseline } from '@features/orders/order-change/edit-order-view-model';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '66666666-6666-4666-8666-666666666666';
const PIECE_A = '33333333-3333-4333-8333-333333333333';

function context(): OrderChangeContext {
  return {
    orderId: ORDER_ID,
    orderNo: '1001',
    committedAt: '2026-10-14T00:00:00.000Z',
    editStateVersion: 2,
    wfStateVersion: 3,
    workflow: { currentStatus: 'READY', profileId: null, profileVersionId: null },
    editAccess: { status: 'OPEN', reasonCode: null, reasonText: null, blockedUntil: null },
    permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
    configuration: {
      featureEnabled: false,
      newItemPricePolicy: null,
      existingDiscountPolicy: null,
      reasonPolicy: null,
      deferredReason: 'deferred',
    },
    order: {
      customer: { id: 'customer-1' },
      customerSnapshot: { name: 'Ada', mobile: '050', email: 'ada@example.com' },
      branchId: 'branch-1',
      currencyCode: 'AED',
      paymentTypeCode: 'PAY_ON_COLLECTION',
      priority: 'normal',
      serviceSpeed: 'STANDARD',
      readyBy: null,
      notes: 'original',
      customerNotes: null,
    },
    items: [
      item(ITEM_A, 1),
      item(ITEM_B, 2),
    ],
    pieces: [{
      id: PIECE_A,
      orderId: ORDER_ID,
      orderItemId: ITEM_A,
      pieceSeq: 1,
      pieceStatus: null,
      pieceStage: null,
      scanState: null,
      serviceSpeed: null,
      lineDiscount: null,
      active: true,
    }],
    preferences: [],
    financial: {
      totalAmount: '10.0000',
      netCollectedAmount: '10.0000',
      outstandingAmount: '0.0000',
      overpaidAmount: '0.0000',
    },
    capabilitySummary: { status: 'DEFERRED', reasonCode: 'CAPABILITY_POLICY_PENDING' },
    editPolicy: { status: 'MISSING', workflowStatus: 'READY', editPolicyId: null, policyRevision: null, assignment: { tenantOrgId: '11111111-1111-1111-1111-111111111111', assignmentId: null, profileId: null, profileCode: null, profileVersionId: null, versionNo: null, versionStatus: null, editPolicyId: null, policyCode: null, policyName: null, policyName2: null, lifecycleStatus: null }, rules: [] },
  };
}

function item(id: string, quantity: number): OrderChangeContext['items'][number] {
  return {
    id,
    moneyBasis: null,
    orderId: ORDER_ID,
    productId: PRODUCT,
    productName: 'Shirt',
    productName2: null,
    serviceCategoryCode: null,
    quantity,
    pricePerUnit: '5.0000',
    totalPrice: '5.0000',
    priceOverride: null,
    preferenceCharge: '0.0000',
    packingPreferenceCode: null,
    active: true,
  };
}

function baseline(): EditOrderBaseline {
  const mapped = mapChangeContextToEditBaseline(context());
  if (!mapped.ok) throw new Error('baseline');
  return mapped.baseline;
}

describe('shared edit workspace adapter', () => {
  it('keeps same-product lines and the persisted piece id', () => {
    const mapped = mapChangeContextToEditBaseline(context());
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.baseline.lines.map((line) => line.identity.kind === 'persisted' ? line.identity.id : '')).toEqual([ITEM_A, ITEM_B]);
    expect(mapped.baseline.lines[0]?.pieces[0]?.identity).toEqual({ kind: 'persisted', id: PIECE_A });
    const visual = projectEditVisualOrder({
      ...context(),
      preferences: [{
        id: '44444444-4444-4444-8444-444444444444',
        orderId: ORDER_ID,
        level: 'PIECE',
        orderItemId: ITEM_A,
        orderItemPieceId: PIECE_A,
        preferenceId: '55555555-5555-4555-8555-555555555555',
        preferenceCode: 'STARCH',
        preferenceKind: null,
        preferenceCategory: null,
        preferenceContent: null,
        extraPrice: '1.0000',
        processingConfirmed: false,
        active: true,
      }],
    });
    expect(visual.items.map((item) => item.persistedItemId)).toEqual([ITEM_A, ITEM_B]);
    expect(visual.items[0]?.pieces?.[0]?.id).toBe(PIECE_A);
    expect(visual.items[0]?.pieces?.[0]?.persistedId).toBe(PIECE_A);
    expect(visual.items[0]?.pieces?.[0]?.servicePrefs?.[0]?.persistedId).toBe('44444444-4444-4444-8444-444444444444');
    expect(mapChangeContextToEditBaseline({ ...context(), items: [] }).ok).toBe(true);
  });

  it('copies a header change into the Edit controller and leaves an unchanged draft empty', () => {
    const loaded = baseline();
    const controller = createEditOrderController();
    const unchanged = {
      notes: 'original',
      serviceSpeed: 'STANDARD',
      customerName: 'Ada',
      customerMobile: '050',
      customerEmail: 'ada@example.com',
    };
    expect(visualHeaderChangeCount(loaded, unchanged)).toBe(0);
    applyVisualDraftToController(controller, loaded, unchanged);
    expect(controller.operationCount()).toBe(0);
    applyVisualDraftToController(controller, loaded, { ...unchanged, notes: 'updated' });
    expect(controller.buildOperations().map((operation) => operation.code)).toEqual(['CHANGE_ORDER_NOTES']);
  });

  it('copies added, removed, and quantity-changed lines into the review', () => {
    const loaded = baseline();
    const controller = createEditOrderController({ createId: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    const visual = projectEditVisualOrder(context());
    const kept = visual.items[0];
    const added = {
      productId: '77777777-7777-4777-8777-777777777777',
      productName: 'New',
      productName2: null,
      quantity: 1,
      pricePerUnit: 3,
      totalPrice: 3,
      defaultSellPrice: 3,
    };
    if (!kept) throw new Error('line');
    applyVisualDraftToController(controller, loaded, {
      notes: 'original',
      serviceSpeed: 'STANDARD',
      customerName: 'Ada',
      customerMobile: '050',
      customerEmail: 'ada@example.com',
      items: [{ ...kept, quantity: 2, pieces: [...(kept.pieces ?? []), { id: 'temp-new', itemId: kept.productId, pieceSeq: 2 }] }, added],
    });
    expect(controller.buildOperations().map((operation) => operation.code)).toEqual([
      'CHANGE_ITEM_QUANTITY',
      'ADD_PIECE',
      'REMOVE_ITEM',
      'ADD_ITEM',
    ]);
    const sameHeader = {
      notes: 'original',
      serviceSpeed: 'STANDARD',
      customerName: 'Ada',
      customerMobile: '050',
      customerEmail: 'ada@example.com',
    };
    expect(visualHeaderChangeCount(loaded, { ...sameHeader, items: visual.items })).toBe(0);
    expect(visualHeaderChangeCount(loaded, { ...sameHeader, items: [kept, added] })).toBe(2);
  });

  it('P6-02b: shows a line\'s own speed and turns cart speed choices into Edit operations', () => {
    const withSpeeds = { ...context(), items: [{ ...item(ITEM_A, 1), serviceSpeed: 'STANDARD' }, { ...item(ITEM_B, 2), serviceSpeed: 'EXPRESS' }] };
    const mapped = mapChangeContextToEditBaseline(withSpeeds);
    if (!mapped.ok) throw new Error('baseline');
    const visual = projectEditVisualOrder(withSpeeds);
    // A line at the order speed follows it (null); a line with its own speed shows it.
    expect(visual.items.map((line) => line.serviceSpeed)).toEqual([null, 'EXPRESS']);
    const header = { notes: 'original', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com' };
    expect(visualHeaderChangeCount(mapped.baseline, { ...header, items: visual.items })).toBe(0);

    // Line B goes back to the order speed; line A gets its own EXPRESS.
    const [lineA, lineB] = visual.items;
    if (!lineA || !lineB) throw new Error('lines');
    const items = [{ ...lineA, serviceSpeed: 'EXPRESS' }, { ...lineB, serviceSpeed: null }];
    const controller = createEditOrderController();
    applyVisualDraftToController(controller, mapped.baseline, { ...header, items });
    expect(controller.buildOperations()).toEqual([
      { seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'PERSISTED_ITEM', id: ITEM_A }, payload: { serviceSpeed: 'EXPRESS' } },
      { seq: 2, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'PERSISTED_ITEM', id: ITEM_B }, payload: { serviceSpeed: 'STANDARD' } },
    ]);
    expect(visualHeaderChangeCount(mapped.baseline, { ...header, items })).toBe(2);
  });

  it('uses canonical operations for ready-by clearing and a line price (P6-02c)', () => {
    const loaded = baseline();
    const controller = createEditOrderController({ createId: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
    const visual = projectEditVisualOrder(context());
    const preferenceId = '55555555-5555-4555-8555-555555555555';
    applyVisualDraftToController(controller, { ...loaded, readyBy: '2026-10-16T10:00:00.000Z' }, {
      notes: 'original', readyBy: '', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com',
      orderServicePrefs: [{ preference_code: 'HANG', source: 'manual', extra_price: 0, preferenceCfId: preferenceId }],
      items: visual.items.map((item, index) => index === 0 ? { ...item, priceOverride: 9, overrideReason: 'Damaged on arrival' } : item),
    });
    const operations = controller.buildOperations();
    expect(operations.map((operation) => operation.code)).toEqual(['CHANGE_READY_BY', 'CHANGE_ITEM_PRICE', 'ADD_PREFERENCE']);
    expect(operations[0].payload).toEqual({ readyBy: null });
    expect(operations[1]).toMatchObject({ target: { kind: 'PERSISTED_ITEM', id: visual.items[0].persistedItemId }, payload: { priceOverride: '9.0000', overrideReason: 'Damaged on arrival' } });
    expect(operations.some((operation) => operation.code === 'CHANGE_UNLISTED')).toBe(false);
  });

  it('P6-02e: a new catalog line sends the price the cart showed; an overridden line does not', () => {
    const mapped = mapChangeContextToEditBaseline(context());
    if (!mapped.ok) throw new Error('baseline');
    const visual = projectEditVisualOrder(context());
    const line = { productId: PRODUCT, productName: 'Shirt', productName2: null, quantity: 1, pricePerUnit: 2.5, totalPrice: 2.5, defaultSellPrice: 2.5, };
    let next = 0;
    const ids = ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
    const controller = createEditOrderController({ createId: () => ids[next++] });
    applyVisualDraftToController(controller, mapped.baseline, {
      notes: 'original', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com',
      items: [...visual.items, line, { ...line, priceOverride: 2, overrideReason: 'Regular' }],
    });
    const adds = controller.buildOperations().filter((operation) => operation.code === 'ADD_ITEM');
    expect(adds.map((operation) => operation.payload)).toEqual([
      expect.objectContaining({ productId: PRODUCT, confirmedUnitPrice: '2.5000' }),
      expect.not.objectContaining({ confirmedUnitPrice: expect.anything() }),
    ]);
  });

  it('P6-02d: edits an order with a stored custom line and sends a new custom line by name and price', () => {
    const withCustom = { ...context(), items: [item(ITEM_A, 1), { ...item(ITEM_B, 1), productId: null, productName: 'Wedding dress' }] };
    const mapped = mapChangeContextToEditBaseline(withCustom);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    const visual = projectEditVisualOrder(withCustom);
    expect(visual.items[1]).toMatchObject({ persistedItemId: ITEM_B, productId: `custom:${ITEM_B}`, customItem: { name: 'Wedding dress', unitPrice: 5 } });
    // The stored custom line, untouched, sends nothing.
    const idle = createEditOrderController();
    applyVisualDraftToController(idle, mapped.baseline, { notes: 'original', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com', items: visual.items });
    expect(idle.buildOperations()).toEqual([]);
    const controller = createEditOrderController({ createId: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
    applyVisualDraftToController(controller, mapped.baseline, {
      notes: 'original', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com',
      items: [...visual.items, {
        productId: 'custom:new', customItem: { name: 'Curtain', name2: null, unitPrice: 7.25 }, productName: 'Curtain', productName2: null,
        quantity: 1, pricePerUnit: 7.25, totalPrice: 7.25, defaultSellPrice: 7.25, serviceCategoryCode: 'LAUNDRY',
      }],
    });
    expect(controller.buildOperations()).toEqual([{
      seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' },
      payload: { clientRef: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', customItem: { name: 'Curtain', name2: null, unitPrice: '7.2500', serviceCategoryCode: 'LAUNDRY' }, quantity: 1 },
    }]);
  });

  it('blocks known preference fields without catalog identity instead of using residual permission', async () => {
    const loaded = baseline();
    const fetchImpl = jest.fn();
    const controller = createEditOrderController({ fetchImpl });
    const visual = projectEditVisualOrder(context());
    applyVisualDraftToController(controller, loaded, {
      notes: 'original', serviceSpeed: 'STANDARD', customerName: 'Ada', customerMobile: '050', customerEmail: 'ada@example.com',
      items: visual.items.map((item, index) => index === 0 ? { ...item, pieces: item.pieces?.map((piece) => ({ ...piece, color: 'BLUE' })) } : item),
    });
    expect(controller.operationCount()).toBe(1);
    expect(controller.buildOperations()).toEqual([]);
    await expect(controller.preview(ORDER_ID)).resolves.toMatchObject({ ok: false, status: 422, body: { error: { code: 'OPERATION_NOT_AVAILABLE', field: 'piece.color' } } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('mounts the shared New Order workspace and does not keep a second edit form', () => {
    const page = readFileSync(join(process.cwd(), 'app/dashboard/orders/[id]/edit/page.tsx'), 'utf8');
    const gate = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-order-page-gate.tsx'), 'utf8');
    const host = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-shared-workspace.tsx'), 'utf8');
    const adapter = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-workspace-adapter.ts'), 'utf8');
    const content = readFileSync(join(process.cwd(), 'src/features/orders/ui/new-order-content.tsx'), 'utf8');
    expect(page).toContain('EditOrderPageGate');
    expect(gate).toContain('EditSharedWorkspace');
    expect(page).not.toContain('EditOrderWorkspace');
    expect(host).toContain('NewOrderContent');
    expect(host).toContain('NewOrderModals');
    expect(adapter).toContain('id: piece.id');
    expect(adapter).toContain('persistedId: preference.id');
    expect(host).not.toContain('temp-');
    expect(adapter).not.toContain('temp-');
    expect(host).not.toContain('saveOrderUpdate');
    expect(host).not.toContain('/update');
    expect(content).not.toContain('handleSaveEditOrder');
    expect(content).toContain('useOrderWorkspaceSessionOptional');
  });
});
