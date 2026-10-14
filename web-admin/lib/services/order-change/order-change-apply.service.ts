/**
 * Commits one reviewed Change inside the caller's transaction.
 * Preview, proof, and fingerprint are checked before any write.
 * Pricing, tax, settlement, and workflow status stay with their owners.
 */

import { mapPersistedFinancialOutcome, persistOrderChangeTx, type OrderChangePersistedOperation, type OrderChangeWriteTx } from '@/lib/services/order-change/order-change-mutation.service';
import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';
import { round4 } from '@/lib/services/order-financial-aggregation';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

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
    }
  }
  return data;
}

function persistedOperations(request: ApplyRequest, actorUserId: string): OrderChangePersistedOperation[] {
  return request.operations.map((operation) => ({
    seq: operation.seq,
    code: operation.code,
    targetType: 'ORDER' as const,
    beforeValues: {},
    afterValues: operation.payload,
    auditSummary: null,
  }));
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
  if (input.request.operations.some((operation) => !ORDER_FIELD_CODES.has(operation.code))) {
    return { ok: false, status: 422, code: 'COMMERCIAL_LINE_UNSUPPORTED' };
  }
  if (input.preview.projectedTotal !== input.preview.originalTotal) {
    return { ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' };
  }
  const financialOutcome = mapPersistedFinancialOutcome(input.preview.financial.outcome, null);
  if (!financialOutcome) return { ok: false, status: 422, code: 'COLLECTION_POLICY_UNRESOLVED' };

  const delta = round4(Number(input.preview.projectedTotal) - Number(input.preview.originalTotal)).toFixed(4);
  const fields = orderFields(input.request);
  return input.runInTransaction(async (tx) => {
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
      operations: persistedOperations(input.request, input.actorUserId),
      appliedAt: input.appliedAt,
    });
    if (!persisted.ok) return { ok: false as const, status: 409 as const, code: persisted.code };
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
}
