import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  FALLBACK_CLASSIFICATIONS,
  OUTBOX_EVENT_TYPES,
  PAYMENT_NATURE,
  PAYMENT_TRANSITION_ACTIONS_REQUIRING_FALLBACK,
  PAYMENT_TRANSITION_ACTIONS_REQUIRING_REASON,
  PAYMENT_TRANSITION_SOURCE_STATUSES,
  PAYMENT_TRANSITION_TARGET_STATUS,
  SETTLEMENT_TYPE_CODES,
  type FallbackClassification,
  type PaymentTransitionAction,
} from '@/lib/constants/order-financial';
import type { PaymentMethodCode } from '@/lib/constants/payment';
import { CASH_EFFECTS, CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';
import { recognizeCashLineTx, abandonPendingCashLineTx } from './cash-drawer-ledger/cash-drawer-ledger-gate';
import { reverseVoucherLinesInTx } from './voucher-line-reversal.service';
import { emitEventTx } from './outbox.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { hashPayload } from '@/lib/utils/idempotency';
import { logger } from '@/lib/utils/logger';
import { ErpLiteAutoPostService } from './erp-lite-auto-post.service';
import { safeDispatchAutoPost } from './erp-lite-auto-post.util';

/** Prisma transaction client shared with the rest of the settlement services. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const PAYMENT_TRANSITION_IDEMPOTENCY_RESOURCE = 'payment_transition';

const REASON_REQUIRED_ACTIONS = new Set<PaymentTransitionAction>(PAYMENT_TRANSITION_ACTIONS_REQUIRING_REASON);
const FALLBACK_REQUIRED_ACTIONS = new Set<PaymentTransitionAction>(PAYMENT_TRANSITION_ACTIONS_REQUIRING_FALLBACK);

const FALLBACK_CLASSIFICATION_VALUES = new Set<string>(Object.values(FALLBACK_CLASSIFICATIONS));

/**
 * B30/B10/B08 — Pending-Payment Back-office Lifecycle + Payment Reversal and
 * Void + Gateway Lifecycle Integration.
 *
 * Input for {@link transitionPaymentTx}. One entry point for all seven
 * back-office/webhook transitions (D001 canonical graph subset):
 *   VERIFY      — PENDING/PROCESSING -> COMPLETED (bank/gateway confirmed)
 *   CANCEL      — PENDING/PROCESSING -> CANCELLED (mandatory reason + D009 fallback)
 *   FAIL_BOUNCE — PENDING/PROCESSING -> FAILED    (mandatory reason + D009 fallback)
 *   VOID        — PENDING/PROCESSING/AUTHORIZED -> VOIDED (mandatory reason;
 *                 no D009 fallback — a never-effective/mistaken entry has no
 *                 balance-routing decision to record; B10/D004)
 *   REVERSE     — COMPLETED/CAPTURED/SETTLED -> REVERSED (mandatory reason;
 *                 cash-family legs get a real reversal voucher line, gate-
 *                 stamped into whichever drawer window is current now — CLF,
 *                 supersedes B10/D004's compensating-movement design)
 *   CAPTURE     — AUTHORIZED -> CAPTURED (no reason; gateway-confirmed or
 *                 manual re-sync — B08)
 *   SETTLE      — CAPTURED -> SETTLED (no reason; gateway-confirmed or
 *                 manual re-sync — B08)
 *
 * B08: `actorId` is nullable for CAPTURE/SETTLE only, since the gateway
 * webhook route calls this with no interactive user — provenance for a
 * NULL-actor transition is the linked `sys_gw_webhook_events_tr` row
 * (webhook route persists `transition_action`/`payment_id` there before
 * calling this function), not a human actor id. Every other action still
 * requires a real actorId (interactive back-office operation only).
 */
export interface TransitionPaymentParams {
  orderId: string;
  paymentId: string;
  tenantId: string;
  /** Null only for a webhook-driven CAPTURE/SETTLE — see interface doc above. */
  actorId: string | null;
  action: PaymentTransitionAction;
  /** Mandatory for every action but VERIFY. */
  reason?: string;
  /** Mandatory for CANCEL/FAIL_BOUNCE (D009); never used by VOID/REVERSE. */
  fallbackClassification?: FallbackClassification;
  /**
   * D010: required on every money path. The route rejects a missing key
   * with 400 before this service is ever called.
   */
  idempotencyKey: string;
  /**
   * @deprecated Unused by REVERSE since CLF — the cash-drawer ledger gate
   * decides the window itself (DEFERRED mode). Kept only so the idempotency
   * hash stays stable for keys generated before this change; ignored
   * otherwise. Do not read this for new logic.
   */
  cashDrawerSessionId?: string;
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
  /** True when this VERIFY recognised the leg's cash line in the drawer ledger (CLF). */
  deferredCashMovementCreated: boolean;
  /** True when this REVERSE created the B10 compensating cash-drawer OUT movement. */
  compensatingCashMovementCreated: boolean;
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
 * B30/B10 — transition a REAL_PAYMENT leg per the D001 canonical graph
 * (VERIFY/CANCEL/FAIL_BOUNCE from PENDING/PROCESSING; VOID from
 * PENDING/PROCESSING/AUTHORIZED; REVERSE from COMPLETED/CAPTURED/SETTLED),
 * with D009 governed fallback classification on CANCEL/FAIL_BOUNCE and D010
 * idempotency throughout.
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
 * @throws Error('CASH_LEG_HAS_NO_VOUCHER_LINE') REVERSE of a cash-family leg with no linked voucher line
 * @throws Error('CASH_LEG_MUST_REVERSE') CANCEL/FAIL_BOUNCE/VOID of a leg already
 *         recognised in the drawer ledger (CLF) — correct it with REVERSE instead
 * @throws CashDrawerLedgerError VERIFY/REVERSE — the cash-drawer ledger gate refused
 *         the line (see lib/constants/cash-drawer.ts CASH_LEDGER_ERRORS)
 */
export async function transitionPaymentTx(
  params: TransitionPaymentParams,
  tx?: PrismaTransactionClient,
): Promise<TransitionPaymentResult> {
  if (tx) {
    return transitionPaymentCoreTx(tx, params);
  }
  return prisma.$transaction((innerTx) => transitionPaymentCoreTx(innerTx, params));
}

/**
 * Core transition logic, run inside `tx`. Extracted so callers that already
 * hold a transaction (e.g. voucher reversal, CLF W9) can join it instead of
 * opening a second, independent one — the pre-CLF bug this closes: nesting a
 * fresh `prisma.$transaction` inside another meant the voucher reversal and
 * its payment unwind were never actually atomic with each other.
 */
async function transitionPaymentCoreTx(
  tx: PrismaTransactionClient,
  params: TransitionPaymentParams,
): Promise<TransitionPaymentResult> {
  const { orderId, paymentId, tenantId, actorId, action, reason, fallbackClassification, idempotencyKey, cashDrawerSessionId } = params;

  const requiresReason = REASON_REQUIRED_ACTIONS.has(action);
  const requiresFallback = FALLBACK_REQUIRED_ACTIONS.has(action);
  if (requiresReason) {
    if (!reason || !reason.trim()) {
      throw new Error('TRANSITION_REASON_REQUIRED');
    }
  }
  if (requiresFallback) {
    if (!fallbackClassification) {
      throw new Error('FALLBACK_CLASSIFICATION_REQUIRED');
    }
    if (!FALLBACK_CLASSIFICATION_VALUES.has(fallbackClassification)) {
      throw new Error('INVALID_FALLBACK_CLASSIFICATION');
    }
  }

  const targetStatus = PAYMENT_TRANSITION_TARGET_STATUS[action];
  const legalSourceStatuses = new Set(PAYMENT_TRANSITION_SOURCE_STATUSES[action]);

  {
    // ── 0. Idempotency conflict check + replay short-circuit (D010) ─────────
    const requestHash = hashPayload({
      orderId,
      paymentId,
      action,
      reason: reason ?? null,
      fallbackClassification: fallbackClassification ?? null,
      cashDrawerSessionId: cashDrawerSessionId ?? null,
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
        compensatingCashMovementCreated: false,
      });
    }

    // ── 3. Legality — D001 per-action legal source-status set ───────────────
    if (!legalSourceStatuses.has(row.payment_status)) {
      throw new Error('ILLEGAL_TRANSITION');
    }

    // ── 3b. CLF — a cash leg already recognised in the drawer ledger cannot
    // leave the active/pending state through CANCEL/FAIL_BOUNCE/VOID; the
    // money already exists in a drawer, so correcting it must go through
    // REVERSE (a real, auditable mirror), never a silent status flip.
    let lineCashEffect: string | null = null;
    if (row.fin_voucher_trx_line_id && (action === 'CANCEL' || action === 'FAIL_BOUNCE' || action === 'VOID')) {
      const line = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
        where: { id: row.fin_voucher_trx_line_id, tenant_org_id: tenantId },
        select: { cash_effect_code: true },
      });
      lineCashEffect = line?.cash_effect_code ?? null;
      if (lineCashEffect === CASH_EFFECTS.DRAWER) {
        throw new Error('CASH_LEG_MUST_REVERSE');
      }
    }

    // ── 4. Flip the row + write dedicated actor-audit columns ───────────────
    const now = new Date();
    const auditColumns =
      action === 'VERIFY'
        ? { verified_by: actorId, verified_at: now }
        : action === 'CANCEL'
          ? { cancelled_by: actorId, cancelled_at: now }
          : action === 'FAIL_BOUNCE'
            ? { failed_by: actorId, failed_at: now }
            : action === 'VOID'
              ? { voided_by: actorId, voided_at: now }
              : action === 'REVERSE'
                ? { reversed_by: actorId, reversed_at: now }
                : action === 'CAPTURE'
                  ? { captured_by: actorId, captured_at: now }
                  : { settled_by: actorId, settled_at: now };

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
        fallback_classification: requiresFallback ? (fallbackClassification as FallbackClassification) : null,
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
    let compensatingCashMovementCreated = false;

    if (action === 'VERIFY') {
      // CLF (replaces the old B32 deferred movement, org_cash_drawer_movements_dtl):
      // the cash is only real now that VERIFY confirms it cleared, so recognise
      // it in the drawer ledger now — DEFERRED mode, never refused on session
      // state, lands in whatever window is current (or the next one).
      if (row.fin_voucher_trx_line_id && isCashFamilyMethod(row.payment_method_code)) {
        const decision = await recognizeCashLineTx(
          tx,
          { tenantOrgId: tenantId, userId: actorId, mode: CASH_GATE_MODES.DEFERRED },
          row.fin_voucher_trx_line_id,
        );
        deferredCashMovementCreated = decision.effect === CASH_EFFECTS.DRAWER;
      }
      // B6 — this leg started PENDING/PROCESSING, so orderPaymentWiringHandler
      // deliberately skipped the ERP-Lite PAYMENT_RECEIVED/ORDER_SETTLED_*
      // dispatch at wiring time (money hadn't cleared yet). Now that VERIFY
      // confirms it actually cleared, dispatch the deferred GL post — same
      // "deferred until effective" pairing as the B32 cash movement above.
      await safeDispatchAutoPost('payment_received_deferred_verify', () =>
        ErpLiteAutoPostService.dispatchPaymentReceivedInTransaction(tx, {
          tenant_org_id: tenantId,
          payment_id: paymentId,
          order_id: row.order_id,
          currency_code: row.currency_code ?? 'SAR',
          payment_date: now.toISOString(),
          payment_method_code: row.payment_method_code as PaymentMethodCode,
          paid_amount: Number(row.amount),
          created_by: actorId,
        }),
      );
    } else if (action === 'CANCEL' || action === 'FAIL_BOUNCE') {
      // CANCEL / FAIL_BOUNCE — D009 fallback classification effects.
      reclassifiedPaymentType = await maybeReclassifyPaymentTypeTx(
        tx,
        tenantId,
        orderId,
        fallbackClassification as FallbackClassification,
      );
      await warnIfOrphanMovementExistsTx(tx, tenantId, paymentId, orderId);
      // CLF — a PENDING cash leg that never cleared: nothing physical moved.
      if (lineCashEffect === CASH_EFFECTS.PENDING && row.fin_voucher_trx_line_id) {
        await abandonPendingCashLineTx(
          tx,
          { tenantOrgId: tenantId, userId: actorId, mode: CASH_GATE_MODES.DEFERRED },
          row.fin_voucher_trx_line_id,
        );
      }
    } else if (action === 'VOID') {
      // B10 — a never-effective leg must never carry a live CASH_SALE
      // movement (B32 status gate); trip-wire only, no auto-reversal.
      await warnIfOrphanMovementExistsTx(tx, tenantId, paymentId, orderId);
      if (lineCashEffect === CASH_EFFECTS.PENDING && row.fin_voucher_trx_line_id) {
        await abandonPendingCashLineTx(
          tx,
          { tenantOrgId: tenantId, userId: actorId, mode: CASH_GATE_MODES.DEFERRED },
          row.fin_voucher_trx_line_id,
        );
      }
    } else if (action === 'REVERSE') {
      // REVERSE — B10 error-correction negation. CLF (replaces the old
      // compensating movement, org_cash_drawer_movements_dtl): a cash-family
      // leg's correction is a real reversal voucher line (P3 — reversals
      // always mirror in the drawer ledger, in the window current NOW, never
      // a closed one). Non-cash legs get nothing here — gateway-side
      // reversal is B8, out of scope.
      //
      // Idempotent by construction, not by a flag: this REVERSE branch runs
      // in two contexts — (a) standalone, from the pending-payments worklist,
      // where no mirror line exists yet; (b) nested, from
      // voucher-reversal.service.ts's unwindOrderPaymentLine, called AFTER
      // reverseVoucherLinesInTx already created the mirror moments earlier in
      // this same transaction. Checking for an existing mirror (via
      // reversed_line_id) rather than threading a "skip" flag through every
      // call site means a genuine retry is also safe, and it can never
      // double-reverse the same line.
      if (isCashFamilyMethod(row.payment_method_code)) {
        if (!row.fin_voucher_id || !row.fin_voucher_trx_line_id) {
          throw new Error('CASH_LEG_HAS_NO_VOUCHER_LINE');
        }
        const existingMirror = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
          where: { tenant_org_id: tenantId, reversed_line_id: row.fin_voucher_trx_line_id },
          select: { id: true },
        });
        if (!existingMirror) {
          await reverseVoucherLinesInTx(tx, {
            tenantOrgId: tenantId,
            voucherId: row.fin_voucher_id,
            reason: reason as string,
            userId: actorId,
            lineIds: [row.fin_voucher_trx_line_id],
          });
        }
        compensatingCashMovementCreated = true;
      }
    } else if (action === 'CAPTURE') {
      // B08 — AUTHORIZED -> CAPTURED is this leg's FIRST entry into the
      // ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED bucket (AUTHORIZED is its
      // own separate bucket), so it drives the deferred ERP-Lite
      // PAYMENT_RECEIVED post — same pairing as VERIFY above. SETTLE does
      // NOT repeat this (the leg is already in the COMPLETED bucket as of
      // CAPTURE; re-dispatching would double-post the same GL fact).
      await safeDispatchAutoPost('payment_received_deferred_capture', () =>
        ErpLiteAutoPostService.dispatchPaymentReceivedInTransaction(tx, {
          tenant_org_id: tenantId,
          payment_id: paymentId,
          order_id: row.order_id,
          currency_code: row.currency_code ?? 'SAR',
          payment_date: now.toISOString(),
          payment_method_code: row.payment_method_code as PaymentMethodCode,
          paid_amount: Number(row.amount),
          created_by: actorId,
        }),
      );
    }
    // SETTLE — no side effects beyond the status flip: the leg was already
    // counted as paid (COMPLETED bucket) since CAPTURE; SETTLE only records
    // that the gateway has finished disbursing funds.

    // ── 6. Recalculate the order header snapshot from fact rows ─────────────
    const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

    // ── 7. Emit the outbox event for this transition ────────────────────────
    const eventType =
      action === 'VERIFY'
        ? OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED
        : action === 'CANCEL'
          ? OUTBOX_EVENT_TYPES.PAYMENT_CANCELLED
          : action === 'FAIL_BOUNCE'
            ? OUTBOX_EVENT_TYPES.PAYMENT_FAILED
            : action === 'VOID'
              ? OUTBOX_EVENT_TYPES.PAYMENT_VOIDED
              : action === 'REVERSE'
                ? OUTBOX_EVENT_TYPES.PAYMENT_REVERSED
                : action === 'CAPTURE'
                  ? OUTBOX_EVENT_TYPES.PAYMENT_CAPTURED
                  : OUTBOX_EVENT_TYPES.PAYMENT_SETTLED;

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
      compensatingCashMovementCreated,
    });
  }
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

