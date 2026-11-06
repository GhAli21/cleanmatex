/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ORDER_CHANGE_LIMITS, type OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { OrderChangeCapabilityBinding } from '@/lib/services/order-change/order-change-capability.service';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { z } from 'zod';
import { calculateCommercialOrder } from '@/lib/commercial';
import type { EditProjection, EditQuote } from '@/lib/services/commercial/commercial-edit.loader';
import type { DiscountChange } from '@/lib/services/commercial/edit-discount-reevaluation';

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
      paymentTypeCode: 'PAY_ON_COLLECTION',
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
    editPolicy: { status: 'MISSING', workflowStatus: 'PROCESSING', editPolicyId: null, policyRevision: null, assignment: { tenantOrgId: '11111111-1111-1111-1111-111111111111', assignmentId: null, profileId: null, profileCode: null, profileVersionId: null, versionNo: null, versionStatus: null, editPolicyId: null, policyCode: null, policyName: null, policyName2: null, lifecycleStatus: null }, rules: [] },
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

/**
 * Stands in for `quoteOrderEdit`: the real calculator, no tax, each line at
 * `unitPrices[line]` or its stored unit price; line extras inside the line,
 * order extras as untaxed charges.
 */
function stubPricer(ctx: OrderChangeContext, unitPrices: Record<string, string> = {}) {
  return async (projection: EditProjection): Promise<EditQuote> => {
    const unitOf = (id: string) => unitPrices[id] ?? ctx.items.find((item) => item.id === id)?.pricePerUnit ?? '0';
    const result = calculateCommercialOrder({
      level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'DOCUMENT_LEVEL', discAllocBasis: 'PROPORTIONAL_NET',
      rounding: { decimalPlaces: 3, mode: 'HALF_UP' },
      lines: projection.lines.map((line) => ({
        lineId: line.id, quantity: line.quantity, priceType: null,
        pricing: {
          listUnitPrice: unitOf(line.id), priceListDiscountPercent: 0, priceListItemId: null, speedUnitPremium: 0, speedLinePremium: 0,
          overrideUnitPrice: line.overrideUnitPrice ?? null, minUnitPrice: null,
          adjustments: line.lineDiscount ? [{ id: `${line.id}:manual`, source: 'MANUAL', calcType: line.lineDiscount.type, value: line.lineDiscount.value }] : [],
          modifiers: projection.preferences.filter((p) => p.level !== 'ORDER' && p.itemId === line.id)
            .map((p) => ({ id: p.id, kind: 'SERVICE', amount: p.amount, placement: 'INCLUDED' as const })),
        },
        tax: { taxCategoryCode: 'STANDARD', exemptReason: null, profiles: [] },
        pieces: line.pieceIds.map((pieceId) => ({ pieceId })),
        readyBy: { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: null, categoryHours: null, extraMinutes: 0 },
      })),
      orderAdjustments: [],
      charges: projection.preferences.filter((p) => p.level === 'ORDER')
        .map((p) => ({ chargeId: `order:SERVICE:${p.id}`, kind: 'SERVICE', amount: p.amount, tax: null })),
      readyBy: { startAt: NOW, orderExtraMinutes: 0, orderOverride: null },
    });
    return { quote: { result, prices: [], orderAdjustments: [] } } as unknown as EditQuote;
  };
}

function preview(input: {
  request: ChangeRequest;
  bindings: readonly OrderChangeCapabilityBinding[];
  context?: OrderChangeContext;
  unitPrices?: Record<string, string>;
  catalog?: Array<{ id: string; code: string; kind: string; category: string; level: 'ORDER' | 'ITEM' | 'PIECE'; extraPrice: string }>;
  proofKey?: { keyId: string; secret: string } | null;
  payments?: Array<{ amount: string; payment_status: string; payment_nature_snapshot: string; payment_method_code: string }>;
  /** Permissions beyond `orders:edit` and `orders:edit_override`. */
  permissions?: readonly string[];
  /** What the pricer reports about the recorded order discounts (D21). */
  discountChanges?: DiscountChange[];
}) {
  const price = stubPricer(input.context ?? context(), input.unitPrices);
  return previewOrderChange({
    now: NOW,
    tenantId: TENANT,
    actorUserId: ACTOR,
    featureEnabled: true,
    canUsePermission: async (permission) => permission === 'orders:edit' || permission === 'orders:edit_override' || (input.permissions ?? []).includes(permission),
    context: input.context ?? context(),
    request: input.request,
    bindings: input.bindings,
    priceEdit: async (projection) => ({ ...await price(projection), discountChanges: input.discountChanges ?? [] }),
    catalog: input.catalog ?? [],
    payments: input.payments ?? [{ amount: '10.0000', payment_status: 'COMPLETED', payment_nature_snapshot: 'REAL_PAYMENT', payment_method_code: 'CASH' }],
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

  it('keeps Review and Apply inside the proof limit for a long item list and payment history', async () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`,
      orderId: ORDER,
      productId: PRODUCT,
      productName: `Item ${index + 1}`,
      productName2: null,
      serviceCategoryCode: null,
      quantity: 1,
      pricePerUnit: '10.0000',
      totalPrice: '10.0000',
      priceOverride: null,
      preferenceCharge: '0.0000',
      packingPreferenceCode: null,
      active: true,
    }));
    const payments = Array.from({ length: 80 }, (_, index) => ({
      amount: '0.0100',
      payment_status: 'COMPLETED',
      payment_nature_snapshot: 'REAL_PAYMENT',
      payment_method_code: 'CASH',
    }));
    const result = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
      context: context({ items }),
      payments,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('READY');
    expect(result.calculationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.reviewProof).toEqual(expect.any(String));
    expect(result.reviewProof!.length).toBeLessThanOrEqual(ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH);
    expect(result.calculationFingerprint!.length).toBeLessThanOrEqual(ORDER_CHANGE_LIMITS.MAX_CALCULATION_FINGERPRINT_LENGTH);
    const payload = JSON.parse(Buffer.from(result.reviewProof!.split('.')[0], 'base64url').toString('utf8')) as { calculationFingerprint: string; settlementSourceFingerprint: string };
    expect(payload.calculationFingerprint).toBe(result.calculationFingerprint);
    expect(payload.settlementSourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('denies a policy denial without a review proof', async () => {
    const result = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER', 'DENY')],
    });
    expect(result).toMatchObject({ ok: true, status: 'DENIED', createsChange: false, reviewProof: null, financial: null });
  });

  it('rejects a review when the loaded policy revision is no longer current', async () => {
    const result = await preview({
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }], {
        expectedPolicy: { editPolicyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', policyRevision: 2 },
      }),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
    });
    expect(result).toMatchObject({ ok: false, status: 409, code: 'POLICY_CHANGED_REVIEW_REQUIRED' });
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

  it('prices an express change and waits for the reason before Apply', async () => {
    const result = await preview({
      request: request(
        [{ seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'EXPRESS' } }],
        { changeReason: undefined },
      ),
      bindings: [{ ...binding('CHANGE_SERVICE_SPEED', 'ORDER'), requiresReason: true }],
      unitPrices: { [ITEM]: '12.0000' },
    });
    expect(result).toMatchObject({
      ok: true,
      status: 'REASON_REQUIRED',
      reviewProof: null,
      calculationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      originalTotal: '10.0000',
      projectedTotal: '12.0000',
      lines: [expect.objectContaining({ id: ITEM, unitPrice: '12.0000', merchandiseAmount: '12.0000' })],
      speedAudit: {
        before: {
          serviceSpeed: 'STANDARD',
          totalAmount: '10.0000',
          taxAmount: '0.0000',
          commercialDelta: '0.0000',
          items: [{ orderItemId: ITEM, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000' }],
        },
        after: {
          serviceSpeed: 'EXPRESS',
          totalAmount: '12.0000',
          taxAmount: '0.0000',
          commercialDelta: '2.0000',
          items: [{ orderItemId: ITEM, quantity: 1, pricePerUnit: '12.0000', totalPrice: '12.0000' }],
        },
      },
      operationAudits: [expect.objectContaining({
        seq: 1,
        before: expect.objectContaining({
          serviceSpeed: 'STANDARD',
          totalAmount: '10.0000',
          items: [expect.objectContaining({ orderItemId: ITEM, pricePerUnit: '10.0000' })],
        }),
        after: expect.objectContaining({
          serviceSpeed: 'EXPRESS',
          totalAmount: '12.0000',
          items: [expect.objectContaining({ orderItemId: ITEM, pricePerUnit: '12.0000' })],
        }),
      })],
    });
  });

  describe('P6-02b: per-line speed', () => {
    const twoLines = (ready: Partial<OrderChangeContext['items'][number]> = {}) => context({
      items: [
        { ...context().items[0], serviceSpeed: 'STANDARD', ...ready },
        { ...context().items[0], id: OTHER, serviceSpeed: 'STANDARD' },
      ],
      financial: { totalAmount: '20.0000', netCollectedAmount: '0.0000', outstandingAmount: '20.0000', overpaidAmount: '0.0000' },
    });
    const lineSpeed = (id: string, serviceSpeed: string, seq = 1) => ({ seq, code: 'CHANGE_SERVICE_SPEED' as const, target: { kind: 'PERSISTED_ITEM' as const, id }, payload: { serviceSpeed } });
    const orderSpeed = (serviceSpeed: string, seq = 1) => ({ seq, code: 'CHANGE_SERVICE_SPEED' as const, target: { kind: 'ORDER' as const }, payload: { serviceSpeed } });

    it('changes one line on its own policy cell and keeps the order speed', async () => {
      const result = await preview({
        context: twoLines(),
        request: request([lineSpeed(OTHER, 'EXPRESS')]),
        bindings: [binding('CHANGE_SERVICE_SPEED', 'ITEM')],
        unitPrices: { [OTHER]: '12.0000' },
      });
      expect(result).toMatchObject({
        ok: true,
        status: 'READY',
        createsChange: true,
        decisions: [expect.objectContaining({ targetType: 'ITEM', decision: 'ALLOW' })],
        projectedTotal: '22.0000',
        speedAudit: {
          before: { serviceSpeed: 'STANDARD', items: [expect.objectContaining({ orderItemId: ITEM, serviceSpeed: 'STANDARD' }), expect.objectContaining({ orderItemId: OTHER, serviceSpeed: 'STANDARD' })] },
          after: { serviceSpeed: 'STANDARD', items: [expect.objectContaining({ orderItemId: ITEM, serviceSpeed: 'STANDARD' }), expect.objectContaining({ orderItemId: OTHER, serviceSpeed: 'EXPRESS', pricePerUnit: '12.0000' })] },
        },
        operationAudits: [expect.objectContaining({ after: expect.objectContaining({ orderItemId: OTHER }) })],
      });
    });

    it('refuses a line speed when only the order speed is allowed', async () => {
      const result = await preview({
        context: twoLines(),
        request: request([lineSpeed(OTHER, 'EXPRESS')]),
        bindings: [binding('CHANGE_SERVICE_SPEED', 'ORDER')],
      });
      expect(result).toMatchObject({ ok: true, status: 'DENIED', decisions: [expect.objectContaining({ reasonCode: 'CAPABILITY_POLICY_BINDING_MISSING' })] });
    });

    it('refuses to move a ready line, by the order speed or by its own', async () => {
      const ready = twoLines({ quantityReady: 1 });
      const viaOrder = await preview({ context: ready, request: request([orderSpeed('EXPRESS')]), bindings: [binding('CHANGE_SERVICE_SPEED', 'ORDER')] });
      expect(viaOrder).toMatchObject({ ok: true, status: 'DENIED', decisions: [expect.objectContaining({ reasonCode: 'LINE_SPEED_LOCKED' })] });
      const viaLine = await preview({ context: ready, request: request([lineSpeed(ITEM, 'EXPRESS')]), bindings: [binding('CHANGE_SERVICE_SPEED', 'ITEM')] });
      expect(viaLine).toMatchObject({ ok: true, status: 'DENIED', decisions: [expect.objectContaining({ reasonCode: 'LINE_SPEED_LOCKED' })] });
    });

    it('lets the order speed move the other lines when the ready line keeps its own speed', async () => {
      const result = await preview({
        context: twoLines({ readyAt: '2026-10-13T08:00:00.000Z' }),
        request: request([orderSpeed('EXPRESS', 1), lineSpeed(ITEM, 'STANDARD', 2)]),
        bindings: [binding('CHANGE_SERVICE_SPEED', 'ORDER'), binding('CHANGE_SERVICE_SPEED', 'ITEM')],
        unitPrices: { [OTHER]: '12.0000' },
      });
      expect(result).toMatchObject({
        ok: true,
        status: 'READY',
        speedAudit: { after: { serviceSpeed: 'EXPRESS', items: [expect.objectContaining({ orderItemId: ITEM, serviceSpeed: 'STANDARD' }), expect.objectContaining({ orderItemId: OTHER, serviceSpeed: 'EXPRESS' })] } },
      });
    });
  });

  describe('P6-02c: line price and line discount', () => {
    const price = (priceOverride: string | null, overrideReason?: string, id = ITEM) => ({
      seq: 1, code: 'CHANGE_ITEM_PRICE' as const, target: { kind: 'PERSISTED_ITEM' as const, id },
      payload: priceOverride === null ? { priceOverride } : { priceOverride, overrideReason },
    });
    const discount = (lineDiscount: { type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: string; reason: string } | null, id = ITEM, seq = 1) => ({
      seq, code: 'CHANGE_DISCOUNT' as const, target: { kind: 'PERSISTED_ITEM' as const, id }, payload: { lineDiscount },
    });

    it('sets a line price on its ITEM cell with pricing:override and audits the price and its reason', async () => {
      const result = await preview({ request: request([price('8', 'Damaged on arrival')]), bindings: [binding('CHANGE_ITEM_PRICE', 'ITEM')], permissions: ['pricing:override'] });
      expect(result).toMatchObject({
        ok: true, status: 'READY', projectedTotal: '8.0000',
        decisions: [expect.objectContaining({ targetType: 'ITEM', decision: 'ALLOW' })],
        operationAudits: [expect.objectContaining({
          before: expect.objectContaining({ orderItemId: ITEM, priceOverride: null, pricePerUnit: '10.0000' }),
          after: expect.objectContaining({ orderItemId: ITEM, priceOverride: '8.0000', overrideReason: 'Damaged on arrival', pricePerUnit: '8.0000' }),
        })],
      });
    });

    it('refuses a line price without pricing:override', async () => {
      const result = await preview({ request: request([price('8', 'Damaged on arrival')]), bindings: [binding('CHANGE_ITEM_PRICE', 'ITEM')] });
      expect(result).toEqual({ ok: false, status: 422, code: 'PRICE_OVERRIDE_NOT_PERMITTED' });
    });

    it('sets a line discount on its ITEM cell with orders:discount and audits what was entered', async () => {
      const result = await preview({
        request: request([discount({ type: 'PERCENTAGE', value: '10', reason: 'Stain' })]),
        bindings: [binding('CHANGE_DISCOUNT', 'ITEM')],
        permissions: ['orders:discount'],
      });
      expect(result).toMatchObject({
        ok: true, status: 'READY', projectedTotal: '9.0000',
        decisions: [expect.objectContaining({ targetType: 'ITEM' })],
        operationAudits: [expect.objectContaining({
          before: expect.objectContaining({ discountType: null, discountValue: null }),
          after: expect.objectContaining({ orderItemId: ITEM, discountType: 'PERCENTAGE', discountValue: '10.0000', discountReason: 'Stain' }),
        })],
      });
      const denied = await preview({ request: request([discount({ type: 'PERCENTAGE', value: '10', reason: 'Stain' })]), bindings: [binding('CHANGE_DISCOUNT', 'ITEM')] });
      expect(denied).toEqual({ ok: false, status: 422, code: 'LINE_DISCOUNT_NOT_PERMITTED' });
    });

    it('treats the stored discount entered again as no change', async () => {
      const stored = context({ items: [{ ...context().items[0], lineDiscount: { type: 'PERCENTAGE', value: '10.0000', reason: 'Stain' } }] });
      const result = await preview({
        context: stored,
        request: request([discount({ type: 'PERCENTAGE', value: '10', reason: 'Stain' })]),
        bindings: [binding('CHANGE_DISCOUNT', 'ITEM')],
        permissions: ['orders:discount'],
      });
      expect(result).toMatchObject({ ok: true, status: 'NO_CHANGE', createsChange: false });
    });

    it('refuses a price or discount on a line the same change removes', async () => {
      const result = await preview({
        request: request([{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: {} }, discount(null, ITEM, 2)]),
        bindings: [binding('REMOVE_ITEM', 'ITEM'), binding('CHANGE_DISCOUNT', 'ITEM')],
        permissions: ['orders:discount'],
      });
      expect(result).toEqual({ ok: false, status: 422, code: 'UPDATE_NOT_ACTIVE', seq: 2 });
    });
  });

  describe('P1B-05: recorded discount re-evaluation', () => {
    const add = { seq: 1, code: 'ADD_ITEM' as const, target: { kind: 'ORDER' as const }, payload: { clientRef: CLIENT, productId: PRODUCT, quantity: 1 } };
    const removed: DiscountChange = {
      key: 'DISCOUNT_RULE:r1', adjustmentId: 'order:d1', sourceType: 'DISCOUNT_RULE', sourceId: 'r1', promotionId: null,
      sourceName: 'Weekday 10%', sourceName2: null, outcome: 'REMOVED', reason: 'MIN_ORDER_NOT_MET', previousAmount: '1.0000', amount: '0.0000',
    };

    it('lists the discount changes and needs an acknowledgement for each removal', async () => {
      const missing = await preview({ request: request([add]), bindings: [binding('ADD_ITEM', 'ORDER')], discountChanges: [removed] });
      expect(missing).toMatchObject({ ok: true, status: 'ACKNOWLEDGEMENT_REQUIRED', reviewProof: null, discountChanges: [removed] });

      const acknowledged = await preview({
        request: request([add], { gateDecisions: [{ seq: 1, gateCode: 'DISCOUNT_REMOVED:DISCOUNT_RULE:r1', acknowledgementChallenge: 'acknowledged' }] }),
        bindings: [binding('ADD_ITEM', 'ORDER')],
        discountChanges: [removed],
      });
      expect(acknowledged).toMatchObject({ ok: true, status: 'READY', reviewProof: expect.any(String) });
    });

    it('needs no acknowledgement for a kept or changed discount', async () => {
      const result = await preview({
        request: request([add]), bindings: [binding('ADD_ITEM', 'ORDER')],
        discountChanges: [{ ...removed, outcome: 'CHANGED', reason: null, amount: '1.5000' }],
      });
      expect(result).toMatchObject({ ok: true, status: 'READY' });
    });

    it('a discount acknowledgement never stands in for a policy warning on the same operation', async () => {
      const result = await preview({
        request: request([add], { gateDecisions: [{ seq: 1, gateCode: 'DISCOUNT_REMOVED:DISCOUNT_RULE:r1', acknowledgementChallenge: 'acknowledged' }] }),
        bindings: [binding('ADD_ITEM', 'ORDER', 'ALLOW_WITH_WARNING')],
      });
      expect(result).toMatchObject({ ok: true, status: 'ACKNOWLEDGEMENT_REQUIRED' });
    });
  });

  describe('P6-02e: price confirmation', () => {
    const add = (confirmedUnitPrice: string) => ({ seq: 1, code: 'ADD_ITEM' as const, target: { kind: 'ORDER' as const }, payload: { clientRef: CLIENT, productId: PRODUCT, quantity: 1, confirmedUnitPrice } });

    it('lists an added line whose price is not the one the cart showed, and records the shown price', async () => {
      const result = await preview({ request: request([add('7.5000')]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '8.0000' } });
      expect(result).toMatchObject({
        ok: true, status: 'READY',
        priceChanges: [{ seq: 1, orderItemId: CLIENT, shownUnitPrice: 7.5, currentUnitPrice: 8 }],
        operationAudits: [expect.objectContaining({ afterValues: expect.objectContaining({ shownUnitPrice: '7.5000', pricePerUnit: '8.0000' }) })],
      });
    });

    it('lists nothing when the shown price still holds', async () => {
      const result = await preview({ request: request([add('8')]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '8.0000' } });
      expect(result).toMatchObject({ ok: true, status: 'READY', priceChanges: [] });
    });

    it('a price that moves after Preview changes the signed snapshot, so Apply refuses the stale proof', async () => {
      const reviewed = await preview({ request: request([add('8')]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '8.0000' } });
      const moved = await preview({ request: request([add('8')]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '9.0000' } });
      if (!reviewed.ok || !moved.ok) throw new Error('preview failed');
      expect(reviewed.reviewBinding?.operationSnapshotDigest).not.toBe(moved.reviewBinding?.operationSnapshotDigest);
    });
  });

  describe('P6-02d: custom lines', () => {
    const custom = { seq: 1, code: 'ADD_ITEM' as const, target: { kind: 'ORDER' as const }, payload: { clientRef: CLIENT, customItem: { name: 'Wedding dress', name2: null, unitPrice: '12.5', serviceCategoryCode: 'DRY_CLEAN' }, quantity: 1 } };

    it('adds a custom line on the ADD_ITEM cell with pricing:override and audits it with no product', async () => {
      const result = await preview({ request: request([custom]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '12.5000' }, permissions: ['pricing:override'] });
      expect(result).toMatchObject({
        ok: true, status: 'READY', projectedTotal: '22.5000',
        operationAudits: [expect.objectContaining({ after: expect.objectContaining({ productId: null, productName: 'Wedding dress', serviceCategoryCode: 'DRY_CLEAN', pricePerUnit: '12.5000' }) })],
      });
    });

    it('refuses a custom line without pricing:override, as on Create', async () => {
      const result = await preview({ request: request([custom]), bindings: [binding('ADD_ITEM', 'ORDER')], unitPrices: { [CLIENT]: '12.5000' } });
      expect(result).toEqual({ ok: false, status: 422, code: 'PRICE_OVERRIDE_NOT_PERMITTED' });
    });
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
    const cases: Array<{ operations: ChangeRequest['operations']; target: OrderChangeCapabilityBinding['targetType']; context?: OrderChangeContext; unitPrices?: Record<string, string>; catalog?: Array<{ id: string; code: string; kind: string; category: string; level: 'ORDER'; extraPrice: string }> }> = [
      { operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: CLIENT, productId: PRODUCT, quantity: 1 } }], target: 'ORDER', unitPrices: { [CLIENT]: '8.0000' } },
      { operations: [{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: {} }], target: 'ITEM' },
      { operations: [{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { quantity: 2 } }], target: 'ITEM' },
      { operations: [{ seq: 1, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { clientRef: CLIENT } }], target: 'ITEM', context: context({ pieces: [{ id: PIECE, orderId: ORDER, orderItemId: ITEM, pieceSeq: 1, pieceStatus: null, pieceStage: null, scanState: null, active: true }] }) },
      { operations: [{ seq: 1, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: PIECE }, payload: {} }], target: 'PIECE', context: context({ pieces: [{ id: PIECE, orderId: ORDER, orderItemId: ITEM, pieceSeq: 1, pieceStatus: null, pieceStage: null, scanState: null, active: true }] }) },
      { operations: [{ seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'ORDER' }, payload: { clientRef: CLIENT, preferenceId: PREFERENCE, preferenceCode: 'STARCH' } }], target: 'ORDER', catalog: [{ id: PREFERENCE, code: 'STARCH', kind: 'service_prefs', category: 'FINISH', level: 'ORDER', extraPrice: '1.0000' }] },
      { operations: [{ seq: 1, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: PREFERENCE_ROW }, payload: { preferenceContent: 'Light' } }], target: 'PREFERENCE', context: context({ preferences: [{ id: PREFERENCE_ROW, orderId: ORDER, level: 'ORDER', orderItemId: null, orderItemPieceId: null, preferenceId: PREFERENCE, preferenceCode: 'STARCH', preferenceKind: 'service_prefs', preferenceCategory: 'FINISH', preferenceContent: 'Heavy', extraPrice: '1.0000', processingConfirmed: false, active: true }] }) },
      { operations: [{ seq: 1, code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: PREFERENCE_ROW }, payload: {} }], target: 'PREFERENCE', context: context({ preferences: [{ id: PREFERENCE_ROW, orderId: ORDER, level: 'ORDER', orderItemId: null, orderItemPieceId: null, preferenceId: PREFERENCE, preferenceCode: 'STARCH', preferenceKind: 'service_prefs', preferenceCategory: 'FINISH', preferenceContent: null, extraPrice: '1.0000', processingConfirmed: false, active: true }] }) },
      { operations: [{ seq: 1, code: 'CHANGE_PRIORITY', target: { kind: 'ORDER' }, payload: { priority: 'HIGH' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'EXPRESS' } }], target: 'ORDER', unitPrices: { [ITEM]: '12.0000' } },
      { operations: [{ seq: 1, code: 'CHANGE_READY_BY', target: { kind: 'ORDER' }, payload: { readyBy: '2026-10-20T10:00:00.000Z' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }], target: 'ORDER' },
      { operations: [{ seq: 1, code: 'CHANGE_CUSTOMER_SNAPSHOT', target: { kind: 'ORDER' }, payload: { customerName: 'Ada Lovelace' } }], target: 'ORDER' },
    ];
    for (const entry of cases) {
      const result = await preview({
        request: request(entry.operations),
        bindings: [binding(entry.operations[0].code, entry.target)],
        context: entry.context,
        unitPrices: entry.unitPrices,
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

  it('P6-01b: a header-only edit is not re-priced; the total stays the stored total (EC-08)', async () => {
    const priceEdit = jest.fn(async () => { throw new Error('a notes edit must not price the order'); });
    const result = await previewOrderChange({
      now: NOW, tenantId: TENANT, actorUserId: ACTOR, featureEnabled: true,
      canUsePermission: async () => true,
      context: context({ financial: { totalAmount: '10.5000', netCollectedAmount: '0.0000', outstandingAmount: '10.5000', overpaidAmount: '0.0000' } }),
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
      priceEdit, catalog: [], payments: [], credits: [], refunds: [], persistedTaxAmount: '0.5000', proofKey: KEY,
    });
    expect(priceEdit).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, status: 'READY', projectedTotal: '10.5000', projectedTax: '0.5000', lines: [] });
  });

  it('Reusable View P3-08 finding: cash change returned and disposed excess are not shown as overpaid', async () => {
    const run = (appliedDispositions?: string[], changeReturned: string | null = '5.0000') => previewOrderChange({
      now: NOW, tenantId: TENANT, actorUserId: ACTOR, featureEnabled: true,
      canUsePermission: async () => true,
      context: context({ financial: { totalAmount: '15.0000', netCollectedAmount: '15.0000', outstandingAmount: '0.0000', overpaidAmount: '0.0000' } }),
      request: request([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }]),
      bindings: [binding('CHANGE_ORDER_NOTES', 'ORDER')],
      priceEdit: async () => { throw new Error('not priced'); },
      catalog: [],
      // Cash tender of 20 on a 15.000 order, 5.000 handed back.
      payments: [{ amount: '20.0000', payment_status: 'COMPLETED', payment_nature_snapshot: 'REAL_PAYMENT', payment_method_code: 'CASH', change_returned_amount: changeReturned }],
      credits: [], refunds: [], appliedDispositions, persistedTaxAmount: '0.0000', proofKey: KEY,
    });
    const settled = await run();
    expect(settled).toMatchObject({ ok: true, financial: { overpaidAmount: '0.0000', unresolvedOverpayment: '0.0000', outstandingAmount: '0.0000' } });
    // No change recorded: the 5.000 excess is overpaid until it is disposed.
    const excess = await run(undefined, null);
    expect(excess).toMatchObject({ ok: true, financial: { overpaidAmount: '5.0000', unresolvedOverpayment: '5.0000' } });
    const disposed = await run(['5.0000'], null);
    expect(disposed).toMatchObject({ ok: true, financial: { overpaidAmount: '5.0000', unresolvedOverpayment: '0.0000' } });
  });

  it('P6-01b: a money edit on an order from before the calculator returns ORDER_NEEDS_RECOMPUTE', async () => {
    const { CommercialEditError } = jest.requireActual('@/lib/services/commercial/commercial-edit.loader');
    const result = await previewOrderChange({
      now: NOW, tenantId: TENANT, actorUserId: ACTOR, featureEnabled: true,
      canUsePermission: async () => true,
      context: context(),
      request: request([{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { quantity: 2 } }]),
      bindings: [binding('CHANGE_ITEM_QUANTITY', 'ITEM')],
      priceEdit: async () => { throw new CommercialEditError('ORDER_NEEDS_RECOMPUTE', 'old order'); },
      catalog: [], payments: [], credits: [], refunds: [], proofKey: KEY,
    });
    expect(result).toEqual({ ok: false, status: 422, code: 'ORDER_NEEDS_RECOMPUTE' });
  });

  it('P6-01b: the review carries the calculated order, and its fingerprint follows the figures', async () => {
    const body = request([{ seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: ITEM }, payload: { quantity: 2 } }]);
    const bindings = [binding('CHANGE_ITEM_QUANTITY', 'ITEM')];
    const atTen = await preview({ request: body, bindings });
    const atEleven = await preview({ request: body, bindings, unitPrices: { [ITEM]: '11.0000' } });
    expect(atTen).toMatchObject({ ok: true, projectedTotal: '20.0000', lines: [expect.objectContaining({ unitPrice: '10.0000' })] });
    if (atTen.ok && atEleven.ok) {
      expect(atTen.commercial?.quote.result.totals.totalAmount.toFixed(4)).toBe('20.0000');
      expect(atEleven.calculationFingerprint).not.toBe(atTen.calculationFingerprint);
    }
  });

  it('does not open a transaction or call a write client', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-preview.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|\$executeRaw|\$transaction|outbox|idempotency|supabase|getPriceForOrderItem/);
    const reads = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-preview-reads.ts'), 'utf8');
    expect(reads).not.toMatch(/\.create\(|\.update\(|\.delete\(|\$executeRaw|outbox|idempotency/);
    expect(reads).toMatch(/tenant_org_id: tenantId/);
  });
});
