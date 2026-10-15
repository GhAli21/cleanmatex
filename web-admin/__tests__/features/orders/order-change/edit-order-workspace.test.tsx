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
      express: false,
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
      defaultExpressSellPrice: null,
    };
    if (!kept) throw new Error('line');
    applyVisualDraftToController(controller, loaded, {
      notes: 'original',
      express: false,
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
      express: false,
      customerName: 'Ada',
      customerMobile: '050',
      customerEmail: 'ada@example.com',
    };
    expect(visualHeaderChangeCount(loaded, { ...sameHeader, items: visual.items })).toBe(0);
    expect(visualHeaderChangeCount(loaded, { ...sameHeader, items: [kept, added] })).toBe(2);
  });

  it('tracks preferences and changes that have no policy operation', () => {
    const loaded = baseline();
    const controller = createEditOrderController({ createId: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
    const visual = projectEditVisualOrder(context());
    const kept = visual.items[0];
    const other = visual.items[1];
    if (!kept?.pieces?.[0] || !other) throw new Error('line');
    const preferenceId = '55555555-5555-4555-8555-555555555555';
    applyVisualDraftToController(controller, { ...loaded, readyBy: '2026-10-16T10:00:00.000Z' }, {
      notes: 'original',
      readyBy: '',
      express: false,
      customerName: 'Ada',
      customerMobile: '050',
      customerEmail: 'ada@example.com',
      orderServicePrefs: [{ preference_code: 'HANG', source: 'manual', extra_price: 0, preferenceCfId: preferenceId }],
      items: [
        { ...kept, priceOverride: 9, pieces: [{ ...kept.pieces[0], color: 'BLUE' }] },
        { ...other, servicePrefs: [{ preference_code: 'FOLD', source: 'manual', extra_price: 0 }] },
      ],
    });
    expect(controller.buildOperations().map((operation) => operation.code)).toEqual([
      'ADD_PREFERENCE',
      'CHANGE_UNLISTED',
      'CHANGE_UNLISTED',
      'CHANGE_UNLISTED',
      'CHANGE_UNLISTED',
    ]);
    const unlisted = controller.buildOperations().filter((operation) => operation.code === 'CHANGE_UNLISTED');
    expect(unlisted.map((operation) => operation.payload)).toEqual(expect.arrayContaining([
      { field: 'order.readyBy', value: '' },
      { field: 'item.priceOverride', value: '9.0000' },
      { field: 'piece.color', value: 'BLUE' },
      { field: 'preference.code', value: 'FOLD' },
    ]));
  });

  it('mounts the shared New Order workspace and does not keep a second edit form', () => {
    const page = readFileSync(join(process.cwd(), 'app/dashboard/orders/[id]/edit/page.tsx'), 'utf8');
    const host = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-shared-workspace.tsx'), 'utf8');
    const adapter = readFileSync(join(process.cwd(), 'src/features/orders/order-change/edit-workspace-adapter.ts'), 'utf8');
    const content = readFileSync(join(process.cwd(), 'src/features/orders/ui/new-order-content.tsx'), 'utf8');
    expect(page).toContain('EditSharedWorkspace');
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
