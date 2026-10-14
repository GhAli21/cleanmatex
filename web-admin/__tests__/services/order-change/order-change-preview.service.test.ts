/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { OrderChangeCapabilityBinding } from '@/lib/services/order-change/order-change-capability.service';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { z } from 'zod';

type ChangeRequest = z.infer<typeof orderChangeRequestSchema>;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const ITEM = '55555555-5555-4555-8555-555555555555';
const OTHER = '56565656-5656-4565-8565-565656565656';
const PIECE = '66666666-6666-4666-8666-666666666666';
const PRODUCT = '88888888-8888-4888-8888-888888888888';
const CLIENT = '99999999-9999-4999-8999-999999999999';
const PREFERENCE = '77777777-7777-4777-8777-777777777777';
const PREFERENCE_ROW = '78787878-7878-4787-8787-787878787878';
const NOW = new Date('2026-10-14T12:00:00.000Z');
const KEY = { keyId: 'preview-test', secret: 'preview-test-secret' };

function context(overrides: Partial<OrderChangeContext> = {}): OrderChangeContext {
  return {
    orderId: ORDER,
    orderNo: '1001',
    committedAt: '2026-10-01T10:00:00.000Z',
    editStateVersion: 3,
    wfStateVersion: 5,
    workflow: { currentStatus: 'PROCESSING', profileId: null, profileVersionId: '44444444-4444-4444-8444-444444444444' },
    editAccess: { status: 'OPEN', reasonCode: null, reasonText: null, blockedUntil: null },
    permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
    configuration: { featureEnabled: false, newItemPricePolicy: null, existingDiscountPolicy: null, reasonPolicy: null, deferredReason: 'deferred' },
    order: {
      customer: { id: null },
      customerSnapshot: { name: 'Ada', mobile: null, email: null },
      branchId: null,
      currencyCode: 'OMR',
      priority: 'NORMAL',
      serviceSpeed: 'STANDARD',
      readyBy: null,
      notes: 'Keep',
      customerNotes: null,
    },
    items: [{
      id: ITEM, orderId: ORDER, productId: PRODUCT, productName: 'Shirt', productName2: null,
      serviceCategoryCode: null, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000',
      priceOverride: null, preferenceCharge: '0.0000', packingPreferenceCode: null, active: true,
    }],
    pieces: [],
    preferences: [],
    financial: { totalAmount: '10.0000', netCollectedAmount: '0.0000', outstandingAmount: '10.0000', overpaidAmount: '0.0000' },
    capabilitySummary: { status: 'DEFERRED', reasonCode: 'CAPABILITY_POLICY_PENDING' },
    ...overrides,
  };
}

function binding(operationCode: OrderChangeOperationCode, targetType: OrderChangeCapabilityBinding['targetType'], decision: OrderChangeCapabilityBinding['decision'] = 'ALLOW'): OrderChangeCapabilityBinding {
  return {
    editPolicyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    profileVersionId: '44444444-4444-4444-8444-444444444444',
    policyRevision: 3,
    workflowStatus: 'PROCESSING',
    operationCode,
    targetType,
    decision,
    reasonCode: decision === 'DENY' ? 'CAPABILITY_POLICY_NOT_ENABLED' : decision === 'ALLOW_WITH_WARNING' ? 'CAPABILITY_POLICY_WARNING' : 'CAPABILITY_POLICY_ALLOWED',
    messageKey: 'orderChange.policy.allowed',
  };
}

function request(operations: ChangeRequest['operations'], extra: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'staff_web',
    changeReason: 'Customer asked for a correction.',
    operations,
    ...extra,
  };
}

function preview(input: {
  request: ChangeRequest;
  bindings: readonly OrderChangeCapabilityBinding[];
  context?: OrderChangeContext;
  quotes?: Record<string, { basePrice: string; finalPrice: string; discountPercent: string }>;
  catalog?: Array<{ id: string; code: string; kind: string; category: string; level: 'ORDER' | 'ITEM' | 'PIECE'; extraPrice: string }>;
  proofKey?: { keyId: string; secret: string } | null;
}) {
  return previewOrderChange({
    now: NOW,
    tenantId: TENANT,
    actorUserId: ACTOR,
    featureEnabled: true,
    canUsePermission: async (permission) => permission === 'orders:edit' || permission === 'orders:edit_override',
    context: input.context ?? context(),
    request: input.request,
    bindings: input.bindings,
    quotesByTargetId: input.quotes ?? {},
    catalog: input.catalog ?? [],
    taxMode: 'TAX_EXCLUSIVE',
    taxRatePercent: '0.0000',
    currencyDecimalPlaces: 3,
    payments: [{ amount: '10.0000', payment_status: 'COMPLETED', payment_nature_snapshot: 'REAL_PAYMENT', payment_method_code: 'CASH' }],
    credits: [],
    refunds: [],
    proofKey: input.proofKey === undefined ? KEY : input.proofKey,
  });
}

describe('previewOrderChange', () => {
  it('returns a stable ready preview for a real note change and does not trust the deferred flag', async () => {
    const body = request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]);
    const first = await preview({ request: body, bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')] });
    const second = await preview({ request: body, bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')] });
    expect(first).toMatchObject({ ok: true, status: 'READY', createsChange: true, projectedTotal: '10.0000', reviewProof: expect.any(String) });
    if (first.ok && second.ok) {
      expect(second.calculationFingerprint).toBe(first.calculationFingerprint);
      expect(second.reviewProof).toBe(first.reviewProof);
      expect(first.projectedItemIds).toEqual([ITEM]);
      expect(first.financial?.settlementMutated).toBe(false);
    }
  });

  it('denies a policy denial without a review proof', async () => {
    const result = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER', 'DENY')],
    });
    expect(result).toMatchObject({ ok: true, status: 'DENIED', createsChange: false, reviewProof: null, financial: null });
  });

  it('reports edit and workflow version conflicts together', async () => {
    const result = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }], {
        expectedEditStateVersion: 9,
        expectedWfStateVersion: 9,
      }),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
    });
    expect(result).toMatchObject({ ok: false, status: 409, code: 'VERSION_CONFLICT', conflicts: ['EDIT_VERSION_CONFLICT', 'WORKFLOW_VERSION_CONFLICT'] });
  });

  it('rejects an unknown persisted item', async () => {
    const result = await preview({
      request: request([{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: OTHER }, payload: {} }]),
      bindings: [binding('REMOVE_ITEM', 'ITEM')],
    });
    expect(result).toMatchObject({ ok: false, status: 422, code: 'UNKNOWN_ITEM', seq: 1 });
  });

  it('withholds the proof until a warning is acknowledged', async () => {
    const operation = { seq: 1, code: 'CHANGE_ORDER_NOTES' as const, target: { kind: 'ORDER' as const }, payload: { notes: 'Updated' } };
    const missing = await preview({ request: request([operation]), bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER', 'ALLOW_WITH_WARNING')] });
    const acknowledged = await preview({
      request: request([operation], { gateDecisions: [{ seq: 1, gateCode: 'CAPABILITY_POLICY_WARNING', acknowledgementChallenge: 'ack' }] }),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER', 'ALLOW_WITH_WARNING')],
    });
    expect(missing).toMatchObject({ ok: true, status: 'ACKNOWLEDGEMENT_REQUIRED', reviewProof: null });
    expect(acknowledged).toMatchObject({ ok: true, status: 'READY', reviewProof: expect.any(String) });
  });

  it('accepts every frozen operation when its own facts are supplied', async () => {
    const cases: Array<{ operations: ChangeRequest['operations']; target: OrderChangeCapabilityBinding['targetType']; context?: OrderChangeContext; quotes?: Record<string, { basePrice: string; finalPrice: string; discountPercent: string }>; catalog?: Array<{ id: string; code: string; kind: string; category: string; level: 'ORDER'; extraPrice: string }> }> = [
      { operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: CLIENT, productId: PRODUCT, quantity: 1 } }], target: 'ORDER', quotes: { [CLIENT]: { basePrice: '8.0000', finalPrice: '8.0000', discountPercent: '0.0000' } } },
      { operations: [{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: {} }], target: 'ITEM' },
      { operations: [{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { quantity: 2 } }], target: 'ITEM' },
      { operations: [{ seq: 1, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { clientRef: CLIENT } }], target: 'ITEM', context: context({ pieces: [{ id: PIECE, orderId: ORDER, orderItemId: ITEM, pieceSeq: 1, pieceStatus: null, pieceStage: null, scanState: null, active: true }] }) },
      { operations: [{ seq: 1, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: PIECE }, payload: {} }], target: 'PIECE', context: context({ pieces: [{ id: PIECE, orderId: ORDER, orderItemId: ITEM, pieceSeq: 1, pieceStatus: null, pieceStage: null, scanState: null, active: true }] }) },
      { operations: [{ seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'ORDER' }, payload: { clientRef: CLIENT, preferenceId: PREFERENCE, preferenceCode: 'STARCH' } }], target: 'ORDER', catalog: [{ id: PREFERENCE, code: 'STARCH', kind: 'service_prefs', category: 'FINISH', level: 'ORDER', extraPrice: '1.0000' }] },
      { operations: [{ seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: PREFERENCE_ROW }, payload: { preferenceContent: 'Light' } }], target: 'PREFERENCE', context: context({ preferences: [{ id: PREFERENCE_ROW, orderId: ORDER, level: 'ORDER', orderItemId: null, orderItemPieceId: null, preferenceId: PREFERENCE, preferenceCode: 'STARCH', preferenceKind: 'service_prefs', preferenceCategory: 'FINISH', preferenceContent: 'Heavy', extraPrice: '1.0000', processingConfirmed: false, active: true }] }) },
      { operations: [{ seq: 1, code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: PREFERENCE_ROW }, payload: {} }], target: 'PREFERENCE', context: context({ preferences: [{ id: PREFERENCE_ROW, orderId: ORDER, level: 'ORDER', orderItemId: null, orderItemPieceId: null, preferenceId: PREFERENCE, preferenceCode: 'STARCH', preferenceKind: 'service_prefs', preferenceCategory: 'FINISH', preferenceContent: null, extraPrice: '1.0000', processingConfirmed: false, active: true }] }) },
      { operations: [{ seq: 1, code: 'CHANGE_PRIORITY', target: { kind: 'ORDER' }, payload: { priority: 'HIGH' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'EXPRESS' } }], target: 'ORDER', quotes: { [ITEM]: { basePrice: '12.0000', finalPrice: '12.0000', discountPercent: '0.0000' } } },
      { operations: [{ seq: 1, code: 'CHANGE_READY_BY', target: { kind: 'ORDER' }, payload: { readyBy: '2026-10-20T10:00:00.000Z' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_CUSTOMER_SNAPSHOT', target: { kind: 'ORDER' }, payload: { customerName: 'Ada Lovelace' } }], target: 'ORDER' },
    ];
    for (const entry of cases) {
      const result = await preview({
        request: request(entry.operations),
        bindings: [binding(entry.operations[0].code, entry.target)],
        context: entry.context,
        quotes: entry.quotes,
        catalog: entry.catalog,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.decisions.map((decision) => decision.operationCode)).toEqual([entry.operations[0].code]);
    }
  });

  it('treats an identical note as no change and keeps the sibling item id', async () => {
    const unchanged = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Keep' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
    });
    const removed = await preview({
      request: request([{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: {} }]),
      bindings: [binding('REMOVE_ITEM', 'ITEM')],
      context: context({
        items: [
          { id: ITEM, orderId: ORDER, productId: PRODUCT, productName: 'Shirt', productName2: null, serviceCategoryCode: null, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000', priceOverride: null, preferenceCharge: '0.0000', packingPreferenceCode: null, active: true },
          { id: OTHER, orderId: ORDER, productId: PRODUCT, productName: 'Trouser', productName2: null, serviceCategoryCode: null, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000', priceOverride: null, preferenceCharge: '0.0000', packingPreferenceCode: null, active: true },
        ],
      }),
    });
    expect(unchanged).toMatchObject({ ok: true, status: 'NO_CHANGE', createsChange: false, reviewProof: null });
    expect(removed).toMatchObject({ ok: true, projectedItemIds: [OTHER] });
  });

  it('does not open a transaction or call a write client', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-preview.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|\$executeRaw|\$transaction|outbox|idempotency|supabase|getPriceForOrderItem/);
    const reads = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-preview-reads.ts'), 'utf8');
    expect(reads).not.toMatch(/\.create\(|\.update\(|\.delete\(|\$executeRaw|outbox|idempotency/);
    expect(reads).toMatch(/tenant_org_id: tenantId/);
  });
});
