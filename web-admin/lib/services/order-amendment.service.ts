import 'server-only';

/**
 * B12 — Order Amendment and Financial Delta.
 *
 * Deliberately thin: does not duplicate settlement logic. Computes the
 * signed delta produced by a governed order edit, gates the edit behind a
 * reason + `orders:post_settlement_edit` + idempotency, and records which
 * real settlement artifact (a payment or an overpayment disposition) later
 * resolved that delta. The actual money movement stays inside the existing,
 * already-tested `OrderCollectPaymentModal` (positive delta) and
 * `executeOverpaymentDispositionTx` (negative delta) — see B12's own doc,
 * Design decisions #2.
 */

import { prisma } from '@/lib/db/prisma';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  findIdempotencyHash,
  hashPayload,
  stakeIdempotencyHash,
  storeIdempotencyHash,
} from '@/lib/utils/idempotency';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { issueCorrectionTaxDocumentTx } from '@/lib/services/tax-document-issuance.service';

export const ORDER_AMENDMENT_IDEMPOTENCY_RESOURCE_TYPE = 'order_amendment';

export type PaymentAdjustmentType = 'CHARGE' | 'REFUND';

export interface SettlementLineage {
  paymentId?: string;
  dispositionIds?: string[];
}

export interface AmendmentDeltaResult {
  previousTotal: number;
  newTotal: number;
  /** Signed: positive = total increased (charge), negative = total decreased (refund-shaped). */
  deltaAmount: number;
  /** True when this edit must go through the reason + idempotency + settlement gate. */
  isGoverned: boolean;
}

/**
 * Pure calculation — no I/O. A delta is governed only when the flag is on,
 * the order already has real money collected against it, and the delta is
 * outside rounding tolerance. A fully-unpaid order's total simply changes
 * (nothing to collect or resolve yet); a rounding-only edit doesn't force a
 * cashier interaction.
 * @param params
 * @param params.previousTotal
 * @param params.newTotal
 * @param params.totalPaidAmount
 * @param params.governedFlagEnabled
 */
export function computeAmendmentDelta(params: {
  previousTotal: number;
  newTotal: number;
  totalPaidAmount: number;
  governedFlagEnabled: boolean;
}): AmendmentDeltaResult {
  const deltaAmount = round4(params.newTotal - params.previousTotal);
  const hasPriorPayments = params.totalPaidAmount > SETTLEMENT_MONEY_EPSILON;
  const beyondTolerance = Math.abs(deltaAmount) > SETTLEMENT_MONEY_EPSILON;
  return {
    previousTotal: params.previousTotal,
    newTotal: params.newTotal,
    deltaAmount,
    isGoverned: params.governedFlagEnabled && hasPriorPayments && beyondTolerance,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Typed governance failures — the API route maps these to specific error
 * codes rather than a generic 500, matching every other financial gate in
 * this codebase (see order-submit-orchestrator's throw('AMOUNT_MISMATCH')
 * pattern).
 */
export class AmendmentGovernanceError extends Error {
  code: 'EDIT_REASON_REQUIRED' | 'PERMISSION_DENIED' | 'IDEMPOTENCY_KEY_REQUIRED' | 'IDEMPOTENCY_CONFLICT';

  constructor(code: AmendmentGovernanceError['code'], message: string) {
    super(message);
    this.name = 'AmendmentGovernanceError';
    this.code = code;
  }
}

/**
 * Throws when a governed edit is missing its required reason or the actor
 * lacks `orders:post_settlement_edit`. Call before touching the DB.
 * @param params
 * @param params.tenantId
 * @param params.userId
 * @param params.editReason
 */
export async function assertGovernedAmendmentAllowed(params: {
  tenantId: string;
  userId: string;
  editReason?: string | null;
}): Promise<void> {
  if (!params.editReason || !params.editReason.trim()) {
    throw new AmendmentGovernanceError(
      'EDIT_REASON_REQUIRED',
      'A reason is required to edit an order that already has payments recorded.',
    );
  }
  const allowed = await hasPermissionServer('orders:post_settlement_edit', {
    userId: params.userId,
    tenantId: params.tenantId,
  }).catch(() => false);
  if (!allowed) {
    throw new AmendmentGovernanceError(
      'PERMISSION_DENIED',
      'orders:post_settlement_edit is required to edit an order after settlement.',
    );
  }
}

/**
 * Stakes a D010-shaped idempotency key for a governed amendment.
 * `resourceId` on the returned record is the `org_order_edit_history.id`
 * from a PRIOR successful call with the same key + payload — when present,
 * the caller should return the cached result instead of redoing the edit.
 * @param tenantId
 * @param orderId
 * @param idempotencyKey
 * @param payload
 */
export async function stakeAmendmentIdempotency(
  tenantId: string,
  orderId: string,
  idempotencyKey: string | undefined | null,
  payload: unknown,
): Promise<{ payloadHash: string; editHistoryId: string | null }> {
  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new AmendmentGovernanceError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'An idempotency key is required to edit an order that already has payments recorded.',
    );
  }
  const payloadHash = hashPayload({ orderId, ...(payload as Record<string, unknown>) });
  const staked = await stakeIdempotencyHash(
    tenantId,
    idempotencyKey,
    ORDER_AMENDMENT_IDEMPOTENCY_RESOURCE_TYPE,
    payloadHash,
  );
  if (staked.conflict) {
    throw new AmendmentGovernanceError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used for a different edit payload.',
    );
  }
  // staked is guaranteed { conflict: false; resourceId: string | null } past the
  // throw above; asserted explicitly since some TS versions don't narrow a
  // discriminated union returned from an awaited call as tightly as a local one.
  const notConflicted = staked as { conflict: false; resourceId: string | null };
  return { payloadHash, editHistoryId: notConflicted.resourceId };
}

/**
 * Marks a staked idempotency key complete once the edit-history row exists —
 * a later replay with the same key returns this id instead of re-editing.
 * @param tenantId
 * @param idempotencyKey
 * @param payloadHash
 * @param editHistoryId
 */
export async function completeAmendmentIdempotency(
  tenantId: string,
  idempotencyKey: string,
  payloadHash: string,
  editHistoryId: string,
): Promise<void> {
  await storeIdempotencyHash(
    tenantId,
    idempotencyKey,
    ORDER_AMENDMENT_IDEMPOTENCY_RESOURCE_TYPE,
    payloadHash,
    editHistoryId,
  );
}

/**
 * Looks up a previously-completed amendment by idempotency key, for replay.
 * @param tenantId
 * @param idempotencyKey
 */
export async function findCompletedAmendment(
  tenantId: string,
  idempotencyKey: string,
): Promise<{ editHistoryId: string } | null> {
  const found = await findIdempotencyHash(tenantId, idempotencyKey, ORDER_AMENDMENT_IDEMPOTENCY_RESOURCE_TYPE);
  if (!found?.resourceId) return null;
  return { editHistoryId: found.resourceId };
}

/**
 * Records the real settlement artifact that resolved a governed amendment's
 * delta — called once the cashier completes `OrderCollectPaymentModal`
 * (positive delta) or the overpayment-resolution flow (negative delta).
 * Idempotent: re-recording the same edit-history row is a no-op once
 * `payment_adjusted` is already true (the row is immutable once settled).
 * @param params
 * @param params.tenantId
 * @param params.editHistoryId
 * @param params.orderId
 * @param params.paymentAdjustmentType
 * @param params.paymentAdjustmentAmount
 * @param params.settlementLineage
 */
export async function recordAmendmentSettlement(params: {
  tenantId: string;
  editHistoryId: string;
  orderId: string;
  paymentAdjustmentType: PaymentAdjustmentType;
  paymentAdjustmentAmount: number;
  settlementLineage: SettlementLineage;
  issuedBy?: string;
}): Promise<{ alreadySettled: boolean }> {
  const existing = await prisma.org_order_edit_history.findFirst({
    where: {
      id: params.editHistoryId,
      tenant_org_id: params.tenantId,
      order_id: params.orderId,
    },
    select: { payment_adjusted: true },
  });
  if (!existing) {
    throw new Error('Edit history row not found for this order.');
  }
  if (existing.payment_adjusted) {
    return { alreadySettled: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.org_order_edit_history.update({
      where: { id: params.editHistoryId },
      data: {
        payment_adjusted: true,
        payment_adjustment_amount: Math.abs(params.paymentAdjustmentAmount),
        payment_adjustment_type: params.paymentAdjustmentType,
        settlement_lineage: params.settlementLineage as unknown as object,
      },
    });

    // B14 — companion fiscal CREDIT_NOTE/DEBIT_NOTE, only if this order
    // already has an ISSUED tax document (no-op otherwise — registration-
    // driven, dormant for every tenant today). Atomic with the settlement
    // record: CHARGE = customer owes more (DEBIT_NOTE), REFUND = customer
    // owed back (CREDIT_NOTE) — same sign convention as decideCorrectionDocumentType.
    await issueCorrectionTaxDocumentTx(tx, {
      tenantId: params.tenantId,
      orderId: params.orderId,
      netDelta:
        params.paymentAdjustmentType === 'REFUND'
          ? -Math.abs(params.paymentAdjustmentAmount)
          : Math.abs(params.paymentAdjustmentAmount),
      triggerEvent: 'ON_AMENDMENT',
      issuedBy: params.issuedBy ?? 'system',
    });
  });

  return { alreadySettled: false };
}
