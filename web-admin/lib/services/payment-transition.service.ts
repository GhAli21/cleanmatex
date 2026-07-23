import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  FALLBACK_CLASSIFICATIONS,
  OUTBOX_EVENT_TYPES,
  PAYMENT_NATURE,
  PAYMENT_TRANSITION_TARGET_STATUS,
  SETTLEMENT_TYPE_CODES,
  type FallbackClassification,
  type PaymentTransitionAction,
} from '@/lib/constants/order-financial';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { emitEventTx } from './outbox.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { hashPayload } from '@/lib/utils/idempotency';
import { logger } from '@/lib/utils/logger';

/** Prisma transaction client shared with the rest of the settlement services. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const PAYMENT_TRANSITION_IDEMPOTENCY_RESOURCE = 'payment_transition';

/** Source statuses this service is allowed to transition out of (D001 subset). */
const TRANSITIONABLE_SOURCE_STATUSES = new Set(['PENDING', 'PROCESSING']);

const FALLBACK_CLASSIFICATION_VALUES = new Set<string>(Object.values(FALLBACK_CLASSIFICATIONS));

/**
 * B30 — Pending-Payment Back-office Lifecycle.
 *
 * Input for {@link transitionPaymentTx}. One entry point for all three
 * back-office transitions (D001 canonical graph subset):
 *   VERIFY      — PENDING/PROCESSING -> COMPLETED (bank/gateway confirmed)
 *   CANCEL      — PENDING/PROCESSING -> CANCELLED (mandatory reason + D009 fallback)
 *   FAIL_BOUNCE — PENDING/PROCESSING -> FAILED    (mandatory reason + D009 fallback)
 */
export interface TransitionPaymentParams {
  orderId: string;
  paymentId: string;
  tenantId: string;
  actorId: string;
  action: PaymentTransitionAction;
  /** Mandatory for CANCEL/FAIL_BOUNCE; ignored for VERIFY. */
  reason?: string;
  /** Mandatory for CANCEL/FAIL_BOUNCE (D009); ignored for VERIFY. */
  fallbackClassification?: FallbackClassification;
  /**
   * D010: required on every money path. The route rejects a missing key
   * with 400 before this service is ever called.
   */
  idempotencyKey: string;
}

export interface TransitionPaymentResult {
  paymentId: string;
  action: PaymentTransitionAction;
  previousStatus: string;
  newStatus: string;
  transitionedAt: string;
  orderPaymentStatus: string;
  outstanding: number;
  /** True when this call performed the flip; false on idempotent replays/no-ops. */
  flipped: boolean;
  fallbackClassification: FallbackClassification | null;
  /** True when this transition reclassified org_orders_mst.payment_type_code (D009). */
  reclassifiedPaymentType: boolean;
  /** True when this VERIFY created the B32 deferred cash-drawer movement. */
  deferredCashMovementCreated: boolean;
}

interface LockedPaymentRow {
  id: string;
  order_id: string;
  payment_status: string;
  payment_nature_snapshot: string;
  payment_method_code: string;
  amount: string;
  currency_code: string | null;
  cash_drawer_session_id: string | null;
  tendered_amount: string | null;
  change_returned_amount: string | null;
  fin_voucher_id: string | null;
  fin_voucher_trx_line_id: string | null;
}

/**
 * B30 — transition a PENDING/PROCESSING REAL_PAYMENT leg per the D001
 * canonical graph subset (VERIFY/CANCEL/FAIL_BOUNCE), with D009 governed
 * fallback classification on CANCEL/FAIL_BOUNCE and D010 idempotency.
 *
 * Invariants:
 *  1. Composite tenant filter on every query; row locked FOR UPDATE.
 *  2. Only REAL_PAYMENT legs; only from PENDING/PROCESSING (COMPLETED legs
 *     need B10 reversal, not this service — D001 terminal-state boundary).
 *  3. Idempotent: replaying the same (tenant, idempotencyKey) with the same
 *     payload returns the original result; a changed payload throws
 *     IDEMPOTENCY_CONFLICT (D010). A retry that lands after the row already
 *     reached the target status is a no-op (flipped:false) regardless of key.
 *  4. CANCEL/FAIL_BOUNCE require a non-empty `reason` and a valid
 *     `fallbackClassification` from the D009 set — a failed pending payment
 *     must never leave the balance unclassified.
 *  5. D009 fallback reclassification of `org_orders_mst.payment_type_code`
 *     only fires for PAY_ON_COLLECTION/AR_CREDIT_INVOICE classifications
 *     (the only two that map onto an existing settlement-type code); the
 *     other three classifications (RETRY_TENDER, MANUAL_REVIEW,
 *     CANCEL_ORDER_OR_REVERSE_SERVICE) are recorded for the worklist but do
 *     not auto-mutate the order's settlement routing — those describe an
 *     operator action still to be taken, not a settled reclassification.
 *  6. B32: VERIFY additionally creates the deferred cash-drawer movement for
 *     a CASH + drawer-required leg that started PENDING/PROCESSING (so the
 *     wiring handler's status gate skipped it at posting time).
 *  7. Header recalc + outbox emission after every real flip.
 *
 * @param params transition payload scoped to one tenant/order/payment row
 * @returns transition result with the refreshed order payment snapshot
 *
 * @throws Error('PAYMENT_NOT_FOUND')
 * @throws Error('NOT_REAL_PAYMENT_LEG')
 * @throws Error('TRANSITION_REASON_REQUIRED')
 * @throws Error('FALLBACK_CLASSIFICATION_REQUIRED')
 * @throws Error('INVALID_FALLBACK_CLASSIFICATION')
 * @throws Error('ILLEGAL_TRANSITION')
 * @throws Error('PAYMENT_TRANSITION_RACE_DETECTED')
 * @throws Error('IDEMPOTENCY_CONFLICT')
 */
export async function transitionPaymentTx(
  params: TransitionPaymentParams,
): Promise<TransitionPaymentResult> {
  const { orderId, paymentId, tenantId, actorId, action, reason, fallbackClassification, idempotencyKey } = params;

  const requiresReason = action !== 'VERIFY';
  if (requiresReason) {
    if (!reason || !reason.trim()) {
      throw new Error('TRANSITION_REASON_REQUIRED');
    }
    if (!fallbackClassification) {
      throw new Error('FALLBACK_CLASSIFICATION_REQUIRED');
    }
    if (!FALLBACK_CLASSIFICATION_VALUES.has(fallbackClassification)) {
      throw new Error('INVALID_FALLBACK_CLASSIFICATION');
    }
  }

  const targetStatus = PAYMENT_TRANSITION_TARGET_STATUS[action];

  return prisma.$transaction(async (tx) => {
    // ── 0. Idempotency conflict check + replay short-circuit (D010) ─────────
    const requestHash = hashPayload({
      orderId,
      paymentId,
      action,
      reason: reason ?? null,
      fallbackClassification: fallbackClassification ?? null,
    });
    const existingIdempotency = await tx.org_idempotency_keys.findFirst({
      where: {
        tenant_org_id: tenantId,
        key: idempotencyKey,
        resource_type: PAYMENT_TRANSITION_IDEMPOTENCY_RESOURCE,
      },
      select: { response_cache: true },
    });
    if (existingIdempotency?.response_cache) {
      const cache = existingIdempotency.response_cache as {
        payload_hash?: string;
        result?: TransitionPaymentResult;
      };
      if (cache.payload_hash && cache.payload_hash !== requestHash) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      if (cache.result) {
        return cache.result;
      }
    }

    // ── 1. Lock the payment row with composite tenant filter ────────────────
    const rows = await tx.$queryRaw<LockedPaymentRow[]>`
      SELECT id, order_id, payment_status, payment_nature_snapshot, payment_method_code,
             amount::text AS amount, currency_code, cash_drawer_session_id,
             tendered_amount::text AS tendered_amount, change_returned_amount::text AS change_returned_amount,
             fin_voucher_id, fin_voucher_trx_line_id
      FROM public.org_order_payments_dtl
      WHERE id = ${paymentId}::uuid
        AND order_id = ${orderId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new Error('PAYMENT_NOT_FOUND');
    }
    if (row.payment_nature_snapshot !== PAYMENT_NATURE.REAL_PAYMENT) {
      throw new Error('NOT_REAL_PAYMENT_LEG');
    }

    const storeAndReturn = async (result: TransitionPaymentResult) => {
      const now = new Date();
      await tx.org_idempotency_keys.upsert({
        where: {
          tenant_org_id_key_resource_type: {
            tenant_org_id: tenantId,
            key: idempotencyKey,
            resource_type: PAYMENT_TRANSITION_IDEMPOTENCY_RESOURCE,
          },
        },
        create: {
          tenant_org_id: tenantId,
          key: idempotencyKey,
          resource_type: PAYMENT_TRANSITION_IDEMPOTENCY_RESOURCE,
          resource_id: paymentId,
          response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
          created_at: now,
          expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        update: {
          response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
        },
      });
      return result;
    };

    // ── 2. Idempotent no-op when already at the target status ───────────────
    if (row.payment_status === targetStatus) {
      const order = await tx.org_orders_mst.findFirstOrThrow({
        where: { id: orderId, tenant_org_id: tenantId },
        select: { payment_status: true, outstanding_amount: true },
      });
      return storeAndReturn({
        paymentId,
        action,
        previousStatus: targetStatus,
        newStatus: targetStatus,
        transitionedAt: new Date().toISOString(),
        orderPaymentStatus: order.payment_status ?? 'UNKNOWN',
        outstanding: Number(order.outstanding_amount ?? 0),
        flipped: false,
        fallbackClassification: fallbackClassification ?? null,
        reclassifiedPaymentType: false,
        deferredCashMovementCreated: false,
      });
    }

    // ── 3. Legality — D001 subset: only PENDING/PROCESSING may transition ───
    if (!TRANSITIONABLE_SOURCE_STATUSES.has(row.payment_status)) {
      throw new Error('ILLEGAL_TRANSITION');
    }

    // ── 4. Flip the row + write dedicated actor-audit columns ───────────────
    const now = new Date();
    const auditColumns =
      action === 'VERIFY'
        ? { verified_by: actorId, verified_at: now }
        : action === 'CANCEL'
          ? { cancelled_by: actorId, cancelled_at: now }
          : { failed_by: actorId, failed_at: now };

    const updated = await tx.org_order_payments_dtl.updateMany({
      where: {
        id: paymentId,
        order_id: orderId,
        tenant_org_id: tenantId,
        payment_status: row.payment_status,
      },
      data: {
        payment_status: targetStatus,
        ...(targetStatus === 'COMPLETED' ? { paid_at: now } : {}),
        transition_reason: requiresReason ? (reason as string).trim() : null,
        fallback_classification: requiresReason ? (fallbackClassification as FallbackClassification) : null,
        ...auditColumns,
        updated_at: now,
        updated_by: actorId,
      },
    });
    if (updated.count !== 1) {
      // Concurrent transition already flipped the row between the SELECT
      // FOR UPDATE and the UPDATE — benign idempotent race, ask caller to retry.
      throw new Error('PAYMENT_TRANSITION_RACE_DETECTED');
    }

    // ── 5. Side effects per action ───────────────────────────────────────────
    let reclassifiedPaymentType = false;
    let deferredCashMovementCreated = false;

    if (action === 'VERIFY') {
      deferredCashMovementCreated = await maybeCreateDeferredCashMovementTx(tx, tenantId, row, actorId);
    } else {
      // CANCEL / FAIL_BOUNCE — D009 fallback classification effects.
      reclassifiedPaymentType = await maybeReclassifyPaymentTypeTx(
        tx,
        tenantId,
        orderId,
        fallbackClassification as FallbackClassification,
      );
      await warnIfOrphanMovementExistsTx(tx, tenantId, paymentId, orderId);
    }

    // ── 6. Recalculate the order header snapshot from fact rows ─────────────
    const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

    // ── 7. Emit the outbox event for this transition ────────────────────────
    const eventType =
      action === 'VERIFY'
        ? OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED
        : action === 'CANCEL'
          ? OUTBOX_EVENT_TYPES.PAYMENT_CANCELLED
          : OUTBOX_EVENT_TYPES.PAYMENT_FAILED;

    await emitEventTx(tx, tenantId, eventType, 'order_payment', paymentId, {
      orderId,
      paymentId,
      actorId,
      actor_id: actorId,
      previousStatus: row.payment_status,
      newStatus: targetStatus,
      reason: reason ?? null,
      fallbackClassification: fallbackClassification ?? null,
      transitionedAt: now.toISOString(),
    });

    return storeAndReturn({
      paymentId,
      action,
      previousStatus: row.payment_status,
      newStatus: targetStatus,
      transitionedAt: now.toISOString(),
      orderPaymentStatus: snapshot.paymentStatus,
      outstanding: snapshot.outstandingAmount,
      flipped: true,
      fallbackClassification: fallbackClassification ?? null,
      reclassifiedPaymentType,
      deferredCashMovementCreated,
    });
  });
}

/**
 * B32 — a CASH + drawer-required leg that started PENDING/PROCESSING (D9
 * override) never got its CASH_SALE movement created at wiring time, because
 * `cashDrawerWiringHandler.canHandle` now gates on the effective resolved
 * status being COMPLETED. When such a leg is VERIFIED here, create the
 * deferred movement so the drawer's expected cash reflects the money that
 * has now actually cleared.
 *
 * Mirrors `cashDrawerWiringHandler.wire()`'s row shape exactly (CASH_SALE +
 * conditional CASH_OUT change row). Idempotency: guarded by an existing-row
 * check on `order_payment_id` (this payment can only be verified once — the
 * row lock in the caller already serializes concurrent transitions on it).
 *
 * @returns true when a movement was created, false when there was nothing to do
 */
async function maybeCreateDeferredCashMovementTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  payment: LockedPaymentRow,
  actorId: string,
): Promise<boolean> {
  if (payment.payment_method_code?.toUpperCase() !== PAYMENT_METHODS.CASH) return false;
  if (!payment.cash_drawer_session_id) return false;

  const existing = await tx.org_cash_drawer_movements_dtl.findFirst({
    where: { tenant_org_id: tenantId, order_payment_id: payment.id, movement_type: 'CASH_SALE' },
    select: { id: true },
  });
  if (existing) return false;

  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: payment.cash_drawer_session_id, tenant_org_id: tenantId, status: 'OPEN' },
    select: { id: true, cash_drawer_id: true, branch_id: true, currency_code: true },
  });
  if (!session) {
    // No silent money mutation: do not guess which (possibly closed/foreign)
    // drawer to credit. Surface loudly for manual reconciliation instead.
    logger.warn('B32 deferred cash-drawer movement skipped — session not OPEN', {
      paymentId: payment.id,
      orderId: payment.order_id,
      cashDrawerSessionId: payment.cash_drawer_session_id,
    });
    return false;
  }

  const now = new Date();
  const created = await tx.org_cash_drawer_movements_dtl.create({
    data: {
      tenant_org_id: tenantId,
      branch_id: session.branch_id,
      cash_drawer_id: session.cash_drawer_id,
      cash_drawer_session_id: payment.cash_drawer_session_id,
      movement_type: 'CASH_SALE',
      direction: 'IN',
      amount: payment.amount,
      currency_code: payment.currency_code ?? session.currency_code,
      order_id: payment.order_id,
      order_payment_id: payment.id,
      fin_voucher_id: payment.fin_voucher_id ?? null,
      fin_voucher_trx_line_id: payment.fin_voucher_trx_line_id ?? null,
      performed_by: actorId,
      performed_at: now,
      is_active: true,
      rec_status: 1,
      created_by: actorId,
    },
    select: { id: true },
  });

  const changeReturned = payment.change_returned_amount != null ? Number(payment.change_returned_amount) : 0;
  if (changeReturned > 0.001) {
    await tx.org_cash_drawer_movements_dtl.create({
      data: {
        tenant_org_id: tenantId,
        branch_id: session.branch_id,
        cash_drawer_id: session.cash_drawer_id,
        cash_drawer_session_id: payment.cash_drawer_session_id,
        movement_type: 'CASH_OUT',
        direction: 'OUT',
        amount: changeReturned,
        currency_code: payment.currency_code ?? session.currency_code,
        order_id: payment.order_id,
        order_payment_id: payment.id,
        fin_voucher_id: payment.fin_voucher_id ?? null,
        performed_by: actorId,
        performed_at: now,
        is_active: true,
        rec_status: 1,
        created_by: actorId,
      },
    });
  }

  if (payment.fin_voucher_trx_line_id) {
    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: payment.fin_voucher_trx_line_id, tenant_org_id: tenantId },
      data: { cash_drawer_mvt_id: created.id, updated_at: now, updated_by: actorId },
    });
  }

  return true;
}

/**
 * D009 — reclassify `org_orders_mst.payment_type_code` when the operator's
 * fallback classification maps onto an existing settlement-type code.
 *
 * Only PAY_ON_COLLECTION and AR_CREDIT_INVOICE do: they describe how the
 * customer's now-unfunded balance will actually be settled, which is exactly
 * what `payment_type_code` drives everywhere else (snapshot bucket routing,
 * reconciliation, AR invoicing). RETRY_TENDER, MANUAL_REVIEW, and
 * CANCEL_ORDER_OR_REVERSE_SERVICE describe an operator action still to be
 * taken, not a settled reclassification — auto-mutating payment_type_code
 * for those would be exactly the kind of silent money-path mutation
 * CLAUDE.md CRITICAL RULE #15 forbids.
 */
async function maybeReclassifyPaymentTypeTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
  classification: FallbackClassification,
): Promise<boolean> {
  let newCode: string | null = null;
  if (classification === FALLBACK_CLASSIFICATIONS.PAY_ON_COLLECTION) {
    newCode = SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  } else if (classification === FALLBACK_CLASSIFICATIONS.AR_CREDIT_INVOICE) {
    newCode = SETTLEMENT_TYPE_CODES.CREDIT_INVOICE;
  }
  if (!newCode) return false;

  const order = await tx.org_orders_mst.findFirst({
    where: { id: orderId, tenant_org_id: tenantId },
    select: { payment_type_code: true },
  });
  if (!order || order.payment_type_code === newCode) return false;

  await tx.org_orders_mst.update({
    where: { id: orderId },
    data: { payment_type_code: newCode, updated_at: new Date() },
  });
  return true;
}

/**
 * Defense-in-depth trip-wire for the B32 invariant: a leg reaching this
 * service's CANCEL/FAIL_BOUNCE path is always sourced from PENDING/PROCESSING,
 * and `cashDrawerWiringHandler.canHandle` (post-B32) only ever creates a
 * movement for an effective-COMPLETED leg — so an existing movement here
 * should be structurally unreachable. If one is ever found, this does NOT
 * auto-reverse it (no silent money mutation); it logs loudly so it surfaces
 * in ops monitoring and the CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT
 * reconciliation check.
 */
async function warnIfOrphanMovementExistsTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  paymentId: string,
  orderId: string,
): Promise<void> {
  const existing = await tx.org_cash_drawer_movements_dtl.findFirst({
    where: { tenant_org_id: tenantId, order_payment_id: paymentId, movement_type: 'CASH_SALE' },
    select: { id: true },
  });
  if (existing) {
    logger.warn(
      'B30 CANCEL/FAIL_BOUNCE found an existing cash-drawer movement on a PENDING/PROCESSING leg — structurally unexpected post-B32; flagged for manual reconciliation, no automatic reversal performed',
      { paymentId, orderId, movementId: existing.id },
    );
  }
}
