import { readFileSync } from 'fs';
import { join } from 'path';

import { issueOrderChangeReviewProof, type OrderChangeReviewProofBinding } from '@/lib/services/order-change/order-change-capability.service';
import { applyOrderChange, type ApplyOrderChangeInput, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { persistOrderChangeTx, OrderChangeMutationError } from '@/lib/services/order-change/order-change-mutation.service';
import type { OrderChangeFinancialResult } from '@/lib/services/order-change/order-change-financial-result.service';
import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';

jest.mock('@/lib/services/order-change/order-change-mutation.service', () => {
  const actual = jest.requireActual('@/lib/services/order-change/order-change-mutation.service');
  return { ...actual, persistOrderChangeTx: jest.fn() };
});

const persistMock = persistOrderChangeTx as jest.MockedFunction<typeof persistOrderChangeTx>;

const financial: OrderChangeFinancialResult = {
  outcome: 'SETTLED',
  outstandingAmount: '0.0000',
  overpaidAmount: '0.0000',
  unresolvedOverpayment: '0.0000',
  effectivePayments: '10.0000',
  effectiveCredits: '0.0000',
  fiscalObligation: '10.0000',
  settlementMutated: false,
  warnings: [],
};

function preview(overrides: Partial<OrderChangePreviewSuccess> = {}): OrderChangePreviewSuccess {
  return {
    ok: true,
    status: 'READY',
    createsChange: true,
    decisions: [],
    calculationFingerprint: 'fingerprint-1',
    reviewProof: 'proof-1',
    financial,
    originalTotal: '10.0000',
    projectedTotal: '10.0000',
    projectedTax: '0.0000',
    displayTotal: '10.000',
    projectedItemIds: [],
    followUp: [],
    ...overrides,
  };
}

function request(): ApplyOrderChangeInput['request'] {
  return {
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'order-edit',
    reviewProof: 'proof-1',
    calculationFingerprint: 'fingerprint-1',
    operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Leave at desk' } }],
  };
}

function harness(overrides: Partial<ApplyOrderChangeInput> = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = { org_orders_mst: { updateMany } } as unknown as OrderChangeApplyTx & { $queryRaw?: unknown };
  let opened = false;
  let committed = false;
  const input: ApplyOrderChangeInput = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    orderId: '22222222-2222-4222-8222-222222222222',
    actorUserId: '33333333-3333-4333-8333-333333333333',
    currencyCode: 'OMR',
    paymentTypeCode: 'PAY_ON_COLLECTION',
    idempotencyKey: 'key-1',
    request: request(),
    preview: preview(),
    appliedAt: new Date('2026-10-14T12:00:00.000Z'),
    runInTransaction: async (fn) => {
      opened = true;
      try {
        const result = await fn(tx);
        committed = true;
        return result;
      } catch (error) {
        committed = false;
        throw error;
      }
    },
    ...overrides,
  };
  return { input, updateMany, tx, opened: () => opened, committed: () => committed };
}

describe('applyOrderChange', () => {
  beforeEach(() => {
    persistMock.mockReset();
    persistMock.mockResolvedValue({
      ok: true,
      replayed: false,
      orderChangeId: 'change-1',
      changeNo: 2,
      editStateVersionAfter: 4,
      requestHash: 'hash-1',
      clientRefs: {},
      retiredPieceIds: [],
      retiredPreferenceIds: [],
      applyResponse: { status: 'APPLIED' },
    });
  });

  it('commits one Change and the order note inside the same transaction', async () => {
    const { input, updateMany, committed } = harness();
    const result = await applyOrderChange(input);
    expect(result).toMatchObject({ ok: true, replayed: false, orderChangeId: 'change-1', editStateVersionAfter: 4 });
    expect(committed()).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: input.orderId,
        tenant_org_id: input.tenantId,
        edit_state_version: 4,
      },
      data: {
        internal_notes: 'Leave at desk',
        updated_by: input.actorUserId,
        updated_at: input.appliedAt,
      },
    });
    const persisted = persistMock.mock.calls[0][1];
    expect(persisted.financialOutcome).toBe('NONE');
    expect(persisted.commercialDelta).toBe('0.0000');
    expect(persisted.itemInserts).toBeUndefined();
  });

  it('accepts the original review proof when Apply mints a later expiry', async () => {
    const key = { keyId: 'local-order-change-review-v1', secret: 'test-secret-test-secret-test-secret' };
    const reviewedAt = new Date('2026-10-16T12:00:00.000Z');
    const appliedAt = new Date('2026-10-16T12:00:30.000Z');
    const base = request();
    const binding: OrderChangeReviewProofBinding = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      orderId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '33333333-3333-4333-8333-333333333333',
      expectedEditStateVersion: base.expectedEditStateVersion,
      expectedWfStateVersion: base.expectedWfStateVersion,
      sourceContext: base.sourceContext,
      canonicalIntent: base.operations,
      changeReason: null,
      gateDecisions: [],
      policyIdentity: {
        editPolicyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        profileVersionId: '44444444-4444-4444-8444-444444444444',
        policyRevision: 5,
      },
      policyFacts: [],
      calculationFingerprint: 'fingerprint-1',
      settlementSourceFingerprint: 'PAID:10.0000',
    };
    const presented = issueOrderChangeReviewProof({ key, binding, now: reviewedAt });
    const fresh = issueOrderChangeReviewProof({ key, binding, now: appliedAt });
    expect(presented).not.toBe(fresh);
    const { input, committed } = harness({
      appliedAt,
      proofKey: key,
      request: { ...base, reviewProof: presented },
      preview: preview({ reviewProof: fresh, reviewBinding: binding }),
    });
    await expect(applyOrderChange(input)).resolves.toMatchObject({ ok: true, replayed: false });
    expect(committed()).toBe(true);
  });

  it('rejects a review proof after five minutes even when the rest of the review still matches', async () => {
    const key = { keyId: 'local-order-change-review-v1', secret: 'test-secret-test-secret-test-secret' };
    const reviewedAt = new Date('2026-10-16T12:00:00.000Z');
    const appliedAt = new Date('2026-10-16T12:05:01.000Z');
    const base = request();
    const binding: OrderChangeReviewProofBinding = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      orderId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '33333333-3333-4333-8333-333333333333',
      expectedEditStateVersion: base.expectedEditStateVersion,
      expectedWfStateVersion: base.expectedWfStateVersion,
      sourceContext: base.sourceContext,
      canonicalIntent: base.operations,
      changeReason: null,
      gateDecisions: [],
      policyIdentity: {
        editPolicyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        profileVersionId: '44444444-4444-4444-8444-444444444444',
        policyRevision: 5,
      },
      policyFacts: [],
      calculationFingerprint: 'fingerprint-1',
      settlementSourceFingerprint: 'PAID:10.0000',
    };
    const { input, opened } = harness({
      appliedAt,
      proofKey: key,
      request: { ...base, reviewProof: issueOrderChangeReviewProof({ key, binding, now: reviewedAt }) },
      preview: preview({ reviewBinding: binding }),
    });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 409, code: 'REVIEW_CHANGED' });
    expect(opened()).toBe(false);
  });

  it('does not write when the review proof no longer matches the current preview', async () => {
    const { input, opened } = harness({
      request: { ...request(), reviewProof: 'stale-proof' },
    });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 409, code: 'REVIEW_CHANGED' });
    expect(opened()).toBe(false);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('allows a change whose code is not in the policy and records it', async () => {
    const { input, updateMany, committed } = harness({
      request: {
        ...request(),
        operations: [{ seq: 1, code: 'CHANGE_UNLISTED', target: { kind: 'ORDER' }, payload: { field: 'order.readyBy', value: '' } }],
      },
    });
    const result = await applyOrderChange(input);
    expect(result.ok).toBe(true);
    expect(committed()).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ready_by: null, updated_by: input.actorUserId }),
    }));
    const persisted = persistMock.mock.calls[0][1];
    expect(persisted.operations).toEqual([expect.objectContaining({
      code: 'CHANGE_UNLISTED',
      targetType: 'ORDER',
      afterValues: expect.objectContaining({ ready_by: null }),
    })]);
  });

  it('saves a catalog preference and a tracked piece field without recreating the order', async () => {
    const preferenceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const pieceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const query = jest.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ');
      if (text.includes('org_service_preference_cf')) {
        return [{ id: preferenceId, preference_code: 'FOLD', extra_price: '0.0000', preference_sys_kind: 'service_prefs' }];
      }
      if (text.includes('org_order_item_pieces_dtl')) {
        return [{ id: pieceId, order_item_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }];
      }
      if (text.includes('MAX(prefs_no)')) return [{ max_no: 4 }];
      if (text.includes('branch_id')) return [{ branch_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }];
      return [];
    });
    const { input, tx, committed } = harness({
      request: {
        ...request(),
        operations: [
          {
            seq: 1,
            code: 'ADD_PREFERENCE',
            target: { kind: 'PERSISTED_PIECE', id: pieceId },
            payload: { clientRef: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', preferenceId, preferenceCode: 'FOLD' },
          },
          {
            seq: 2,
            code: 'CHANGE_UNLISTED',
            target: { kind: 'PERSISTED_PIECE', id: pieceId },
            payload: { field: 'piece.color', value: 'BLUE' },
          },
        ],
      },
    });
    tx.$queryRaw = query;
    const result = await applyOrderChange(input);
    expect(result.ok).toBe(true);
    expect(committed()).toBe(true);
    const persisted = persistMock.mock.calls[0][1];
    expect(persisted.preferenceInserts).toEqual([expect.objectContaining({
      data: expect.objectContaining({
        prefs_level: 'PIECE',
        preference_code: 'FOLD',
        preference_id: preferenceId,
        extra_price: '0.0000',
        prefs_source: 'ORDER_EDIT',
        order_item_piece_id: pieceId,
        order_item_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    })]);
    expect(persisted.pieceUpdates).toEqual([expect.objectContaining({
      id: pieceId,
      data: expect.objectContaining({ color: 'BLUE' }),
    })]);
    expect(persisted.operations[0]).toEqual(expect.objectContaining({
      code: 'ADD_PREFERENCE',
      targetType: 'PREFERENCE',
      orderPreferenceId: persisted.preferenceInserts?.[0].id,
    }));
  });

  it('saves a reviewed item without recreating the order', async () => {
    const clientRef = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const productId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { input, tx, committed } = harness({
      request: {
        ...request(),
        operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef, productId, quantity: 1 } }],
      },
      preview: preview({
        projectedTotal: '12.0000',
        lines: [{ id: clientRef, active: true, unitPrice: '2.0000', merchandiseAmount: '2.0000' }],
      }),
    });
    tx.$queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ');
      if (text.includes('org_orders_mst')) {
        return [{ order_no: '100', branch_id: null, current_status: 'processing', item_count: 2 }];
      }
      if (text.includes('org_product_data_mst')) {
        return [{ id: productId, product_name: 'Shirt', product_name2: 'قميص', service_category_code: 'laundry' }];
      }
      return [];
    });
    const result = await applyOrderChange(input);
    expect(result.ok).toBe(true);
    expect(committed()).toBe(true);
    const persisted = persistMock.mock.calls[0][1];
    expect(persisted.itemInserts).toEqual([expect.objectContaining({
      id: clientRef,
      data: expect.objectContaining({
        product_id: productId,
        product_name: 'Shirt',
        quantity: 1,
        price_per_unit: '2.0000',
        total_price: '2.0000',
        order_item_srno: '100-3',
      }),
    })]);
    expect(persisted.operations[0]).toEqual(expect.objectContaining({
      code: 'ADD_ITEM',
      targetType: 'ITEM',
      orderItemId: clientRef,
      beforeValues: {},
    }));
  });

  it('stores the real stored values before every decision that already has a row', async () => {
    const orderFacts = harness({
      request: {
        ...request(),
        operations: [
          { seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } },
          { seq: 2, code: 'CHANGE_PRIORITY', target: { kind: 'ORDER' }, payload: { priority: 'HIGH' } },
          { seq: 3, code: 'CHANGE_READY_BY', target: { kind: 'ORDER' }, payload: { readyBy: '2026-10-20T10:00:00.000Z' } },
          { seq: 4, code: 'CHANGE_CUSTOMER_SNAPSHOT', target: { kind: 'ORDER' }, payload: { customerName: 'New Name' } },
        ],
      },
    });
    orderFacts.tx.$queryRaw = jest.fn().mockResolvedValue([{
      priority: 'NORMAL',
      service_speed: 'STANDARD',
      ready_by: new Date('2026-10-18T10:00:00.000Z'),
      internal_notes: 'Keep',
      customer_notes: null,
      customer_name: 'Ada',
      customer_mobile_number: '0500000000',
      customer_email: null,
      total_amount: '10.0000',
      total_tax_amount: '1.5000',
    }]);
    await expect(applyOrderChange(orderFacts.input)).resolves.toMatchObject({ ok: true });
    const orderOps = persistMock.mock.calls.at(-1)?.[1].operations ?? [];
    const storedOrder = {
      priority: 'NORMAL',
      service_speed: 'STANDARD',
      ready_by: '2026-10-18T10:00:00.000Z',
      internal_notes: 'Keep',
      customer_notes: null,
      customer_name: 'Ada',
      customer_mobile_number: '0500000000',
      customer_email: null,
      total_amount: '10.0000',
      total_tax_amount: '1.5000',
    };
    expect(orderOps.map((operation) => operation.beforeValues)).toEqual([
      storedOrder,
      storedOrder,
      storedOrder,
      storedOrder,
    ]);
    expect(orderOps.map((operation) => operation.afterValues)).toEqual([
      { ...storedOrder, internal_notes: 'Updated' },
      { ...storedOrder, priority: 'HIGH' },
      { ...storedOrder, ready_by: '2026-10-20T10:00:00.000Z' },
      { ...storedOrder, customer_name: 'New Name' },
    ]);

    const itemId = '55555555-5555-4555-8555-555555555555';
    const pieceId = '66666666-6666-4666-8666-666666666666';
    const preferenceId = '77777777-7777-4777-8777-777777777777';
    const targets = harness({
      request: {
        ...request(),
        operations: [
          { seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: itemId }, payload: {} },
          { seq: 2, code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: pieceId }, payload: {} },
          { seq: 3, code: 'CHANGE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: preferenceId }, payload: { preferenceContent: 'Light' } },
        ],
      },
    });
    targets.tx.$queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ');
      if (text.includes('product_name')) {
        return [{
          id: itemId, product_id: '88888888-8888-4888-8888-888888888888', product_name: 'Shirt', product_name2: null,
          quantity: 3, price_per_unit: '10.0000', total_price: '30.0000', price_override: null, service_pref_charge: '0.0000',
          notes: null, stain_notes: null, damage_notes: null, packing_pref_code: null, has_stain: false, has_damage: false,
        }];
      }
      if (text.includes('color')) {
        return [{
          id: pieceId, order_item_id: itemId, piece_seq: 2, color: 'Blue', brand: null, notes: null,
          packing_pref_code: null, has_stain: false, has_damage: true, quantity: 1,
          price_per_unit: '10.0000', total_price: '10.0000', piece_status: 'processing', piece_stage: null, scan_state: 'expected',
        }];
      }
      if (text.includes('preference_content')) {
        return [{
          id: preferenceId, prefs_level: 'ITEM', order_item_id: itemId, order_item_piece_id: null,
          preference_id: '99999999-9999-4999-8999-999999999999', preference_code: 'STARCH',
          preference_content: 'Heavy', extra_price: '1.0000', preference_sys_kind: 'service_prefs',
        }];
      }
      if (text.includes('org_orders_mst')) return [{ order_no: '100', branch_id: null, current_status: 'processing', item_count: 1 }];
      if (text.includes('order_item_id')) return [{ order_item_id: itemId }];
      if (text.includes('MAX(prefs_no)')) return [{ max_no: 1 }];
      if (text.includes('branch_id')) return [{ branch_id: null }];
      return [];
    });
    await expect(applyOrderChange(targets.input)).resolves.toMatchObject({ ok: true });
    const targetOps = persistMock.mock.calls.at(-1)?.[1].operations ?? [];
    expect(targetOps[0].beforeValues).toEqual(expect.objectContaining({
      id: itemId, product_name: 'Shirt', quantity: 3, price_per_unit: '10.0000', total_price: '30.0000',
    }));
    expect(targetOps[0].afterValues).toEqual(expect.objectContaining({ id: itemId, product_name: 'Shirt', rec_status: 0 }));
    expect(targetOps[1].beforeValues).toEqual(expect.objectContaining({
      id: pieceId, order_item_id: itemId, piece_seq: 2, color: 'Blue', has_damage: true,
    }));
    expect(targetOps[1].afterValues).toEqual(expect.objectContaining({ id: pieceId, rec_status: 0 }));
    expect(targetOps[2].beforeValues).toEqual(expect.objectContaining({
      id: preferenceId,
      prefs_level: 'ITEM',
      preference_code: 'STARCH',
      preference_content: 'Heavy',
      preference_sys_kind: 'service_prefs',
      extra_price: '1.0000',
    }));
    expect(targetOps[2].afterValues).toEqual(expect.objectContaining({
      id: preferenceId,
      preference_code: 'STARCH',
      preference_sys_kind: 'service_prefs',
      preference_content: 'Light',
    }));
  });

  it('does not write a commercial line or a changed total', async () => {
    const line = harness({
      request: {
        ...request(),
        operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quantity: 1 } }],
      },
    });
    await expect(applyOrderChange(line.input)).resolves.toEqual({ ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' });
    expect(line.opened()).toBe(false);

    const priced = harness({ preview: preview({ projectedTotal: '12.0000' }) });
    await expect(applyOrderChange(priced.input)).resolves.toEqual({ ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' });
    expect(priced.opened()).toBe(false);
  });

  it('reprices each item once and stores the real speed values on the one operation', async () => {
    const itemId = '55555555-5555-4555-8555-555555555555';
    const speedAudit = {
      before: {
        serviceSpeed: 'STANDARD',
        totalAmount: '10.0000',
        taxAmount: '1.5000',
        commercialDelta: '0.0000',
        items: [{ orderItemId: itemId, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000' }],
      },
      after: {
        serviceSpeed: 'EXPRESS',
        totalAmount: '12.0000',
        taxAmount: '1.8000',
        commercialDelta: '2.0000',
        items: [{ orderItemId: itemId, quantity: 1, pricePerUnit: '12.0000', totalPrice: '12.0000' }],
      },
    };
    const { input, committed, tx, updateMany } = harness({
      request: {
        ...request(),
        changeReason: 'Customer asked for express.',
        operations: [{ seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'EXPRESS' } }],
      },
      preview: preview({
        projectedTotal: '12.0000',
        projectedTax: '1.8000',
        speedAudit,
        lines: [{ id: itemId, active: true, unitPrice: '12.0000', merchandiseAmount: '12.0000' }],
      }),
    });
    const executeRaw = jest.fn().mockResolvedValue(1);
    (tx as { $executeRaw: jest.Mock }).$executeRaw = executeRaw;
    await expect(applyOrderChange(input)).resolves.toMatchObject({ ok: true });
    expect(committed()).toBe(true);
    expect(persistMock.mock.calls[0][1].changeReason).toBe('Customer asked for express.');
    expect(persistMock.mock.calls[0][1].operations).toEqual([expect.objectContaining({
      code: 'CHANGE_SERVICE_SPEED',
      targetType: 'ORDER',
      orderItemId: null,
      beforeValues: {
        service_speed: 'STANDARD',
        total_amount: '10.0000',
        total_tax_amount: '1.5000',
        commercial_delta: '0.0000',
        items: [{ id: itemId, quantity: 1, price_per_unit: '10.0000', total_price: '10.0000' }],
      },
      afterValues: {
        service_speed: 'EXPRESS',
        total_amount: '12.0000',
        total_tax_amount: '1.8000',
        commercial_delta: '2.0000',
        express_charge_amount: '0.0000',
        items: [{ id: itemId, quantity: 1, price_per_unit: '12.0000', total_price: '12.0000' }],
      },
    })]);
    expect(persistMock.mock.calls[0][1].itemUpdates).toEqual([expect.objectContaining({
      id: itemId,
      data: expect.objectContaining({ price_per_unit: '12.0000', total_price: '12.0000' }),
    })]);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ service_speed: 'EXPRESS' }),
    }));
    const chargeWrites = executeRaw.mock.calls.map((call) => String(call[0]));
    expect(chargeWrites.some((sql) => sql.includes('is_voided = true'))).toBe(true);
    expect(chargeWrites.some((sql) => sql.includes('INSERT INTO org_order_charges_dtl'))).toBe(false);
  });

  it('keeps an unchanged outstanding balance on the existing settlement type', async () => {
    const collected = harness({
      preview: preview({
        originalTotal: '29.67',
        projectedTotal: '29.6700',
        financial: { ...financial, outcome: 'OUTSTANDING', outstandingAmount: '18.0000' },
      }),
    });
    await expect(applyOrderChange(collected.input)).resolves.toMatchObject({ ok: true });
    expect(persistMock.mock.calls[0][1].financialOutcome).toBe('OUTSTANDING_REQUIRED');
    expect(collected.committed()).toBe(true);

    const invoiced = harness({
      paymentTypeCode: 'CREDIT_INVOICE',
      preview: preview({
        financial: { ...financial, outcome: 'OUTSTANDING', outstandingAmount: '18.0000' },
      }),
    });
    await expect(applyOrderChange(invoiced.input)).resolves.toMatchObject({ ok: true });
    expect(persistMock.mock.calls[1][1].financialOutcome).toBe('OUTSTANDING_OPTIONAL');
  });

  it('does not guess collection when the settlement type is missing', async () => {
    const { input, opened } = harness({
      paymentTypeCode: null,
      preview: preview({ financial: { ...financial, outcome: 'OUTSTANDING', outstandingAmount: '10.0000' } }),
    });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 422, code: 'COLLECTION_POLICY_UNRESOLVED' });
    expect(opened()).toBe(false);
  });

  it('returns a replay without writing the order fields again', async () => {
    persistMock.mockResolvedValueOnce({
      ok: true,
      replayed: true,
      orderChangeId: 'change-1',
      changeNo: 2,
      editStateVersionAfter: 4,
      requestHash: 'hash-1',
      clientRefs: {},
      retiredPieceIds: [],
      retiredPreferenceIds: [],
      applyResponse: { status: 'APPLIED' },
    });
    const { input, updateMany } = harness();
    await expect(applyOrderChange(input)).resolves.toMatchObject({ ok: true, replayed: true });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns a conflict when the version update is lost and rolls the write back', async () => {
    const { input, committed } = harness();
    persistMock.mockRejectedValueOnce(new OrderChangeMutationError('VERSION_CONFLICT'));
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 409, code: 'VERSION_CONFLICT' });
    expect(committed()).toBe(false);
  });

  it('does not commit a note when the order row update misses the new revision', async () => {
    const { input, updateMany, committed } = harness();
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 409, code: 'ORDER_FIELD_UPDATE_LOST' });
    expect(committed()).toBe(false);
  });

  it('refuses a denied financial result and a piece whose parent has no reviewed price', async () => {
    const denied = harness({
      preview: preview({ financial: { ...financial, outcome: 'DENIED' } }),
    });
    await expect(applyOrderChange(denied.input)).resolves.toEqual({ ok: false, status: 422, code: 'REVIEW_NOT_READY' });
    expect(denied.opened()).toBe(false);

    const piece = harness({
      request: {
        ...request(),
        operations: [{
          seq: 1,
          code: 'ADD_PIECE',
          target: { kind: 'PERSISTED_ITEM', id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
          payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        }],
      },
    });
    await expect(applyOrderChange(piece.input)).resolves.toEqual({ ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' });
    expect(piece.opened()).toBe(false);
  });

  it('keeps pricing and payment clients out of the apply module', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-apply.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|supabase|server-only|pricingService|order-financial-write|ar-invoice|tax-document/);
  });
});
