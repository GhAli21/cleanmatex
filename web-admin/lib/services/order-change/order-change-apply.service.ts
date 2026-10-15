/**
 * Commits one reviewed Change inside the caller's transaction.
 * Preview, proof, and fingerprint are checked before any write.
 * Pricing, tax, settlement, and workflow status stay with their owners.
 */

import {
  assertCommercialSnapshot,
  buildCommercialWritePlan,
  loadCommercialWriteFacts,
  OrderChangeApplyRejected,
  preferenceParentIsLocal,
  PREFERENCE_OPERATION_CODES,
  writePreferenceCharges,
  type CommercialWriteFacts,
  type CommercialWritePlan,
} from '@/lib/services/order-change/order-change-commercial-write';
import {
  buildStructuralWritePlan,
  loadStructuralWriteFacts,
  STRUCTURAL_OPERATION_CODES,
  type StructuralWritePlan,
} from '@/lib/services/order-change/order-change-structural-write';
import { mapPersistedFinancialOutcome, persistOrderChangeTx, type OrderChangePersistedOperation, type OrderChangeWriteTx } from '@/lib/services/order-change/order-change-mutation.service';
import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';
import { round4 } from '@/lib/services/order-financial-aggregation';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

const EMPTY_COMMERCIAL_FACTS: CommercialWriteFacts = {
  pieceItemIds: new Map(),
  catalogById: new Map(),
  nextPrefsNo: 0,
  branchId: null,
  orderLevelPreferenceIds: new Set(),
};

type ApplyRequest = z.infer<typeof orderChangeApplyRequestSchema>;

const ORDER_FIELD_CODES = new Set([
  'CHANGE_ORDER_NOTES',
  'CHANGE_PRIORITY',
  'CHANGE_SERVICE_SPEED',
  'CHANGE_READY_BY',
  'CHANGE_CUSTOMER_SNAPSHOT',
]);

export interface OrderChangeApplyTx extends OrderChangeWriteTx {
  org_orders_mst: OrderChangeWriteTx['org_orders_mst'] & {
    updateMany(args: {
      where: { id: string; tenant_org_id: string; edit_state_version: number };
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
}

export interface ApplyOrderChangeInput {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string | null;
  currencyCode: string | null;
  idempotencyKey: string;
  request: ApplyRequest;
  preview: OrderChangePreviewSuccess;
  appliedAt: Date;
  runInTransaction<T>(fn: (tx: OrderChangeApplyTx) => Promise<T>): Promise<T>;
}

export type ApplyOrderChangeResult =
  | {
    ok: true;
    replayed: boolean;
    orderChangeId: string;
    changeNo: number;
    editStateVersionAfter: number;
    requestHash: string;
  }
  | { ok: false; status: 409 | 422; code: string };

function orderFields(request: ApplyRequest): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const operation of request.operations) {
    if (operation.code === 'CHANGE_ORDER_NOTES') {
      if (operation.payload.notes !== undefined) data.internal_notes = operation.payload.notes;
      if (operation.payload.customerNotes !== undefined) data.customer_notes = operation.payload.customerNotes;
    } else if (operation.code === 'CHANGE_PRIORITY') {
      data.priority = operation.payload.priority;
    } else if (operation.code === 'CHANGE_SERVICE_SPEED') {
      data.service_speed = operation.payload.serviceSpeed;
    } else if (operation.code === 'CHANGE_READY_BY') {
      data.ready_by = new Date(operation.payload.readyBy);
    } else if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
      if (operation.payload.customerName !== undefined) data.customer_name = operation.payload.customerName;
      if (operation.payload.customerMobile !== undefined) data.customer_mobile_number = operation.payload.customerMobile;
      if (operation.payload.customerEmail !== undefined) data.customer_email = operation.payload.customerEmail;
    } else if (operation.code === 'CHANGE_UNLISTED' && operation.payload.field === 'order.readyBy' && operation.target.kind === 'ORDER' && operation.payload.value === '') {
      data.ready_by = null;
    }
  }
  return data;
}

function persistedOperations(
  request: ApplyRequest,
  auditBySeq: CommercialWritePlan['auditBySeq'],
): OrderChangePersistedOperation[] {
  return request.operations.map((operation) => {
    const audit = auditBySeq.get(operation.seq);
    return {
      seq: operation.seq,
      code: operation.code,
      targetType: audit?.targetType ?? 'ORDER',
      orderItemId: audit?.orderItemId ?? null,
      orderItemPieceId: audit?.orderItemPieceId ?? null,
      orderPreferenceId: audit?.orderPreferenceId ?? null,
      clientRef: audit?.clientRef ?? null,
      beforeValues: {},
      afterValues: operation.code === 'CHANGE_UNLISTED'
        ? {
            field: operation.payload.field,
            value: operation.payload.value,
            targetKind: operation.target.kind,
            ...('id' in operation.target && operation.target.id ? { targetId: operation.target.id } : {}),
            ...('clientRef' in operation.target && operation.target.clientRef ? { clientRef: operation.target.clientRef } : {}),
          }
        : operation.payload,
      auditSummary: null,
    };
  });
}

/**
 * Apply a preview that is ready, current, and free of a commercial line rewrite.
 * A thrown error inside the transaction rolls every Change write back.
 */
export async function applyOrderChange(input: ApplyOrderChangeInput): Promise<ApplyOrderChangeResult> {
  if (input.preview.status !== 'READY' || !input.preview.createsChange || !input.preview.reviewProof || !input.preview.calculationFingerprint || !input.preview.financial || !input.preview.projectedTotal) {
    return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
  }
  if (input.preview.calculationFingerprint !== input.request.calculationFingerprint || input.preview.reviewProof !== input.request.reviewProof) {
    return { ok: false, status: 409, code: 'REVIEW_CHANGED' };
  }
  if (!input.currencyCode) return { ok: false, status: 422, code: 'CURRENCY_UNRESOLVED' };
  const hasPreference = input.request.operations.some((operation) => PREFERENCE_OPERATION_CODES.has(operation.code));
  const hasStructural = input.request.operations.some((operation) => STRUCTURAL_OPERATION_CODES.has(operation.code));
  if (input.request.operations.some((operation) => (
    !ORDER_FIELD_CODES.has(operation.code)
    && operation.code !== 'CHANGE_UNLISTED'
    && !PREFERENCE_OPERATION_CODES.has(operation.code)
    && !STRUCTURAL_OPERATION_CODES.has(operation.code)
  ))) {
    return { ok: false, status: 422, code: 'COMMERCIAL_LINE_UNSUPPORTED' };
  }
  if (!hasPreference && !hasStructural && input.preview.projectedTotal !== input.preview.originalTotal) {
    return { ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' };
  }
  if (preferenceParentIsLocal(input.request.operations)) {
    return { ok: false, status: 422, code: 'PREFERENCE_PARENT_NOT_PERSISTED' };
  }
  if (hasStructural && input.request.operations.some((operation) => (
    operation.code === 'ADD_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY'
  )) && (input.preview.lines ?? []).length === 0) {
    return { ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' };
  }
  const financialOutcome = mapPersistedFinancialOutcome(input.preview.financial.outcome, null);
  if (!financialOutcome) return { ok: false, status: 422, code: 'COLLECTION_POLICY_UNRESOLVED' };

  const delta = round4(Number(input.preview.projectedTotal) - Number(input.preview.originalTotal)).toFixed(4);
  const fields = orderFields(input.request);
  try {
    return await input.runInTransaction(async (tx) => {
    const facts = hasPreference
      ? await loadCommercialWriteFacts(tx, input.tenantId, input.orderId, input.request.operations)
      : EMPTY_COMMERCIAL_FACTS;
    const plan = buildCommercialWritePlan(input.request.operations, input.actorUserId, facts);
    const structuralFacts = hasStructural
      ? await loadStructuralWriteFacts(tx, input.tenantId, input.orderId, input.request.operations)
      : null;
    const structural = structuralFacts
      ? buildStructuralWritePlan(input.request.operations, input.preview.lines ?? [], structuralFacts, input.actorUserId)
      : null;
    const auditBySeq = new Map([...plan.auditBySeq, ...(structural?.auditBySeq ?? [])]);
    const persisted = await persistOrderChangeTx(tx, {
      tenantId: input.tenantId,
      orderId: input.orderId,
      expectedEditStateVersion: input.request.expectedEditStateVersion,
      expectedWfStateVersion: input.request.expectedWfStateVersion,
      sourceContext: input.request.sourceContext,
      actorUserId: input.actorUserId,
      actorName: input.actorName ?? null,
      changeReason: input.request.changeReason ?? null,
      currencyCode: input.currencyCode as string,
      financialBefore: { totalAmount: input.preview.originalTotal },
      financialAfter: {
        totalAmount: input.preview.projectedTotal,
        taxAmount: input.preview.projectedTax,
      },
      commercialDelta: delta,
      financialOutcome,
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      applyResponse: { status: 'APPLIED' },
      operations: persistedOperations(input.request, auditBySeq),
      preferenceInserts: plan.preferenceInserts.length > 0 ? plan.preferenceInserts : undefined,
      preferenceUpdates: plan.preferenceUpdates.length > 0 ? plan.preferenceUpdates : undefined,
      removePreferenceIds: plan.removePreferenceIds.length > 0 ? plan.removePreferenceIds : undefined,
      itemInserts: structural && structural.itemInserts.length > 0 ? structural.itemInserts : undefined,
      pieceInserts: structural && structural.pieceInserts.length > 0 ? structural.pieceInserts : undefined,
      itemUpdates: mergedRows(plan.itemUpdates, structural?.itemUpdates ?? []),
      pieceUpdates: plan.pieceUpdates.length > 0 ? plan.pieceUpdates : undefined,
      removeItemIds: structural && structural.removeItemIds.length > 0 ? structural.removeItemIds : undefined,
      removePieceIds: structural && structural.removePieceIds.length > 0 ? structural.removePieceIds : undefined,
      appliedAt: input.appliedAt,
    });
    if (!persisted.ok) return { ok: false as const, status: 409 as const, code: persisted.code };
    if (!persisted.replayed) {
      await writePreferenceCharges(tx, {
        tenantId: input.tenantId,
        orderId: input.orderId,
        actorUserId: input.actorUserId,
        currencyCode: input.currencyCode as string,
        appliedAt: input.appliedAt,
        plan,
      });
      if (commercialMoneyChanged(plan) || structuralMoneyChanged(structural)) {
        await assertCommercialSnapshot(tx, {
          tenantId: input.tenantId,
          orderId: input.orderId,
          projectedTotal: input.preview.projectedTotal,
        });
      }
    }
    if (!persisted.replayed && Object.keys(fields).length > 0) {
      const updated = await tx.org_orders_mst.updateMany({
        where: {
          id: input.orderId,
          tenant_org_id: input.tenantId,
          edit_state_version: persisted.editStateVersionAfter,
        },
        data: fields,
      });
      if (updated.count !== 1) throw new Error('ORDER_FIELD_UPDATE_LOST');
    }
    return {
      ok: true as const,
      replayed: persisted.replayed,
      orderChangeId: persisted.orderChangeId,
      changeNo: persisted.changeNo,
      editStateVersionAfter: persisted.editStateVersionAfter,
      requestHash: persisted.requestHash,
    };
    });
  } catch (error) {
    if (error instanceof OrderChangeApplyRejected) return { ok: false, status: error.status, code: error.code };
    throw error;
  }
}

function mergedRows(
  first: CommercialWritePlan['itemUpdates'],
  second: StructuralWritePlan['itemUpdates'],
): CommercialWritePlan['itemUpdates'] | undefined {
  const byId = new Map<string, Record<string, unknown>>();
  const ids: string[] = [];
  for (const row of [...first, ...second]) {
    if (!byId.has(row.id)) ids.push(row.id);
    byId.set(row.id, { ...(byId.get(row.id) ?? {}), ...row.data });
  }
  if (ids.length === 0) return undefined;
  return ids.map((id) => ({ id, data: byId.get(id) ?? {} }));
}

function structuralMoneyChanged(plan: StructuralWritePlan | null): boolean {
  if (!plan) return false;
  return plan.itemInserts.length > 0
    || plan.pieceInserts.length > 0
    || plan.itemUpdates.length > 0
    || plan.removeItemIds.length > 0
    || plan.removePieceIds.length > 0;
}

function commercialMoneyChanged(plan: CommercialWritePlan): boolean {
  return plan.preferenceInserts.length > 0
    || plan.preferenceUpdates.length > 0
    || plan.removePreferenceIds.length > 0
    || plan.orderCharges.length > 0
    || plan.voidChargeSourceIds.length > 0
    || plan.itemUpdates.some((row) => Object.prototype.hasOwnProperty.call(row.data, 'price_override'));
}
