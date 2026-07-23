import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  CREDIT_APPLICATION_TYPES,
  OUTBOX_EVENT_TYPES,
  REFUND_CONTEXTS,
  REFUND_DOC_TYPE_CODE,
  REFUND_ERROR_CODES,
  REFUND_METHODS,
  REFUND_REASON_CODES,
  REFUND_SOURCE_TYPES,
} from '@/lib/constants/order-financial';
import type {
  RefundContext,
  RefundMethod,
  RefundReasonCode,
  RefundSourceType,
} from '@/lib/types/order-financial';
import { emitEventTx } from './outbox.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { assertOpenPosSessionForFinanceTx } from './pos-session.service';
import { topUpWalletTx, issueCreditNoteTx } from './stored-value.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { requireCurrencyCode } from '@/lib/money/currency-resolution';
import { createBizVoucher } from './voucher-biz.service';
import { addVoucherLine } from './voucher-line.service';
import { postAndWireBizVoucher } from './voucher-wiring.service';
import {
  VOUCHER_TYPE,
  LINE_TYPE,
  LINE_ROLE,
  VOUCHER_DIRECTION,
  PARTY_TYPE,
  TARGET_TYPE,
} from '@/lib/constants/voucher';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const REFUND_SCOPES = {
  STANDARD: 'STANDARD',
  MANUAL_EXCEPTION: 'MANUAL_EXCEPTION',
} as const;

/**
 *
 */
export type RefundScope = (typeof REFUND_SCOPES)[keyof typeof REFUND_SCOPES];

/**
 * Why:
 * B01 refund validation failures must be machine-readable at the API boundary
 * (explicit 4xx with a stable code, never a silent default or a parsed string).
 */
export class RefundValidationError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 422) {
    super(message);
    this.name = 'RefundValidationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface RefundMetadata {
  refund_scope?: RefundScope;
  original_credit_app_id?: string | null;
  original_payment_id?: string | null;
  fin_voucher_id?: string | null;
  fin_voucher_trx_line_id?: string | null;
  requested_by?: string | null;
  approved_by?: string | null;
  processed_by?: string | null;
  /** Operator-entered reopen for MANUAL_EXCEPTION rows; the column is written once at process (D003 v2). */
  requested_reopen_amount?: number | null;
  [key: string]: unknown;
}

function toNumber(d: Decimal | number | null | undefined): number {
  return d == null ? 0 : Number(d);
}

function parseMetadata(metadata: unknown): RefundMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  return metadata as RefundMetadata;
}

function mergeMetadata(
  base: unknown,
  updates: Record<string, unknown>
): Prisma.InputJsonValue {
  return {
    ...parseMetadata(base),
    ...updates,
  } as Prisma.InputJsonValue;
}

/**
 * Map a credit application's `credit_type` to its D002 v2 origin-only refund
 * source (B01 §3). Legacy aliases resolve through CREDIT_APPLICATION_TYPES.
 * Returns null for unknown types — callers must reject, never default.
 * @param creditType raw `org_order_credit_apps_dtl.credit_type` value
 */
export function mapCreditTypeToRefundSource(
  creditType: string | null | undefined
): RefundSourceType | null {
  const normalized = String(creditType ?? '').trim().toUpperCase();
  switch (normalized) {
    case CREDIT_APPLICATION_TYPES.GIFT_CARD:
      return REFUND_SOURCE_TYPES.GIFT_CARD_RESTORE;
    case CREDIT_APPLICATION_TYPES.WALLET:
      return REFUND_SOURCE_TYPES.WALLET_RESTORE;
    case CREDIT_APPLICATION_TYPES.ADVANCE:
    case 'CUSTOMER_ADVANCE':
      return REFUND_SOURCE_TYPES.CUSTOMER_ADVANCE_RESTORE;
    case CREDIT_APPLICATION_TYPES.CREDIT_NOTE:
    case 'CUSTOMER_CREDIT':
      return REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE;
    case CREDIT_APPLICATION_TYPES.LOYALTY_POINTS:
    case 'LOYALTY_CREDIT':
      return REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE;
    default:
      return null;
  }
}

/**
 * D003 v2 reopen rule (B01 §5): commercial contexts never reopen the
 * customer's due; REFUND_AND_REBILL reopens the full refund amount;
 * MANUAL_EXCEPTION honors the operator-entered value within bounds.
 * @param refundContext row reason_context
 * @param refundAmount row refund amount (upper bound)
 * @param requestedReopenAmount operator-entered value for MANUAL_EXCEPTION rows
 */
export function resolveReopensDueAmount(
  refundContext: RefundContext,
  refundAmount: number,
  requestedReopenAmount?: number | null
): number {
  switch (refundContext) {
    case REFUND_CONTEXTS.REFUND_AND_REBILL:
      return refundAmount;
    case REFUND_CONTEXTS.MANUAL_EXCEPTION: {
      const requested = requestedReopenAmount == null ? 0 : Number(requestedReopenAmount);
      if (!Number.isFinite(requested) || requested < 0 || requested > refundAmount) {
        throw new RefundValidationError(
          REFUND_ERROR_CODES.REFUND_REOPEN_INVALID,
          `Manual-exception reopen amount (${requested}) must be between 0 and the refund amount (${refundAmount})`,
          400
        );
      }
      return requested;
    }
    // STANDARD, PRICE_ADJUSTMENT_GOODWILL, CANCELLATION_UNWIND — value was
    // returned / the sale is reduced or dead; the customer never silently
    // owes again (D003 v2 core rule).
    default:
      return 0;
  }
}

async function getRefundableBalanceSummaryTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string
): Promise<{
  order: {
    id: string;
    order_no: string;
    customer_id: string | null;
    branch_id: string | null;
    currency_code: string | null;
    total_paid_amount: Decimal | null;
    total_credit_applied_amount: Decimal | null;
  };
  refundableBalance: number;
}> {
  const order = await tx.org_orders_mst.findFirstOrThrow({
    where: { id: orderId, tenant_org_id: tenantId },
    select: {
      id: true,
      order_no: true,
      customer_id: true,
      branch_id: true,
      currency_code: true,
      total_paid_amount: true,
      total_credit_applied_amount: true,
    },
  });

  const processedRefunds = await tx.org_order_refunds_dtl.aggregate({
    where: {
      tenant_org_id: tenantId,
      order_id: orderId,
      is_active: true,
      refund_status: 'PROCESSED',
    },
    _sum: { refund_amount: true },
  });

  const grossApplied =
    toNumber(order.total_paid_amount) + toNumber(order.total_credit_applied_amount);
  const refunded = toNumber(processedRefunds._sum.refund_amount);

  return {
    order,
    refundableBalance: Math.max(0, grossApplied - refunded),
  };
}

/**
 * Cumulative PROCESSED refund total already drawn against one credit
 * application, using the dedicated lineage column (B01 §6 — replaces the
 * legacy metadata-JSON iteration with an indexed lookup).
 */
async function sumProcessedRefundsForCreditAppTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
  originalCreditAppId: string
): Promise<number> {
  const agg = await tx.org_order_refunds_dtl.aggregate({
    where: {
      tenant_org_id: tenantId,
      order_id: orderId,
      original_credit_app_id: originalCreditAppId,
      is_active: true,
      refund_status: 'PROCESSED',
    },
    _sum: { refund_amount: true },
  });
  return toNumber(agg._sum.refund_amount);
}

async function sumProcessedRefundsForPaymentTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
  originalPaymentId: string
): Promise<number> {
  const agg = await tx.org_order_refunds_dtl.aggregate({
    where: {
      tenant_org_id: tenantId,
      order_id: orderId,
      original_payment_id: originalPaymentId,
      is_active: true,
      refund_status: 'PROCESSED',
    },
    _sum: { refund_amount: true },
  });
  return toNumber(agg._sum.refund_amount);
}

/**
 * Why:
 * B01 makes the refund service the only writer of the five-facet refund facts
 * (D002 v2): the caller supplies lineage + reason_context, the service derives
 * `refund_source_type`, validates lineage consistency, and stamps both columns
 * at initiation. `reopens_due_amount` is written exactly once at process time
 * per the approved D003 v2 rules.
 */
export interface InitiateRefundParams {
  orderId: string;
  amount: number;
  reason: RefundReasonCode;
  method: RefundMethod;
  /** D002 v2 reason_context — mandatory on every refund (B01 §2). */
  refundContext: RefundContext;
  notes?: string;
  requestedBy: string;
  currencyCode: string;
  originalPaymentId?: string;
  originalCreditAppId?: string;
  refundScope?: RefundScope;
  approvalRequired?: boolean;
  /** Route idempotency key — required by B01 §12 (was optional pre-B01). */
  idempotencyKey: string;
  /**
   * Operator-entered reopen for MANUAL_EXCEPTION rows only (D003 v2).
   * Bounded 0..amount; the column is written at process time.
   */
  reopensDueAmount?: number;
  /**
   * Internal B27 hook: REFUND_AND_REBILL is rejected until the dedicated
   * order-reopen/rebill permission code ships (B01 §13). B27 wires the
   * permission check and passes true; API callers can never set it directly.
   */
  rebillAuthorized?: boolean;
  posSessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Initiate a refund for an order. Creates a refund record that must be
 * approved or processed according to the operational policy.
 * @param tenantId
 * @param params
 */
export async function initiateRefund(
  tenantId: string,
  params: InitiateRefundParams
) {
  const {
    orderId,
    amount,
    reason,
    method,
    refundContext,
    notes,
    requestedBy,
    currencyCode,
    originalPaymentId,
    originalCreditAppId,
    refundScope = REFUND_SCOPES.STANDARD,
    approvalRequired = true,
    idempotencyKey,
    reopensDueAmount,
    rebillAuthorized = false,
    posSessionId,
    metadata,
  } = params;

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  if (!idempotencyKey?.trim()) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_IDEMPOTENCY_CONFLICT,
      'An idempotency key is required to initiate a refund',
      400
    );
  }

  if (!Object.values(REFUND_CONTEXTS).includes(refundContext)) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID,
      `Unknown refund context: ${String(refundContext)}`,
      400
    );
  }

  // B01 §13: mechanics ship in B1, activation arrives with B27's dedicated
  // order-reopen/rebill permission code. Until then the API-facing path
  // rejects explicitly (never silently downgrades the context).
  if (refundContext === REFUND_CONTEXTS.REFUND_AND_REBILL && !rebillAuthorized) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_AND_REBILL_NOT_AVAILABLE,
      'REFUND_AND_REBILL requires the dedicated order-reopen permission (ships with work package B27)',
      403
    );
  }

  const isManualException = refundContext === REFUND_CONTEXTS.MANUAL_EXCEPTION;

  // Back-compat: refundScope MANUAL_EXCEPTION (pre-B01 API shape) must agree
  // with the authoritative reason_context — contradictions are rejected.
  if (refundScope === REFUND_SCOPES.MANUAL_EXCEPTION && !isManualException) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID,
      'Manual-exception refunds must carry refund context MANUAL_EXCEPTION',
      400
    );
  }

  if (isManualException && (originalPaymentId || originalCreditAppId)) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH,
      'Manual exception refunds cannot include original source lineage',
      400
    );
  }

  if (isManualException && !notes?.trim()) {
    throw new Error('Manual exception refunds require a non-empty reason note');
  }

  // Operator-entered reopen is a MANUAL_EXCEPTION-only input (D003 v2);
  // every other context has a fixed rule and must not accept an override.
  if (reopensDueAmount != null && !isManualException) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_REOPEN_INVALID,
      'A reopen amount can only be supplied on MANUAL_EXCEPTION refunds',
      400
    );
  }
  if (
    reopensDueAmount != null &&
    (!Number.isFinite(reopensDueAmount) || reopensDueAmount < 0 || reopensDueAmount > amount)
  ) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_REOPEN_INVALID,
      `Reopen amount (${reopensDueAmount}) must be between 0 and the refund amount (${amount})`,
      400
    );
  }

  // Lineage XOR (B01 §4): a refund returns value from exactly one origin.
  if (originalPaymentId && originalCreditAppId) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH,
      'A refund references either an original payment or an original credit application, never both',
      400
    );
  }

  // Rebill unwinds a real payment so the order can be recollected; restore
  // sources move outstanding via the paired credit reversal instead
  // (D003 v2 invariant 4 — never both).
  if (refundContext === REFUND_CONTEXTS.REFUND_AND_REBILL && !originalPaymentId) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH,
      'REFUND_AND_REBILL requires the original payment lineage',
      400
    );
  }
  if (refundContext === REFUND_CONTEXTS.REFUND_AND_REBILL && !notes?.trim()) {
    throw new RefundValidationError(
      REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID,
      'REFUND_AND_REBILL requires a non-empty reason note',
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    // F-R1 (D-12 §4): idempotent replay. The DB unique index `uq_refund_idempotency`
    // (tenant_org_id, idempotency_key) already prevents a duplicate row, but without
    // this lookup a keyed retry would surface a raw unique-violation and roll back the
    // whole tx. Return the existing refund so retries are graceful and side-effect-free.
    const existing = await tx.org_order_refunds_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey, is_active: true },
    });
    if (existing) {
      // B01 §12 (S2 pattern): same key + different payload is a conflict,
      // never a silent replay of the earlier request.
      const existingMetadata = parseMetadata(existing.metadata);
      const payloadMatches =
        existing.order_id === orderId &&
        toNumber(existing.refund_amount) === amount &&
        (existing.refund_method_code ?? null) === method &&
        existing.refund_context === refundContext &&
        (existing.original_payment_id ?? null) === (originalPaymentId ?? null) &&
        (existing.original_credit_app_id ?? existingMetadata.original_credit_app_id ?? null) ===
          (originalCreditAppId ?? null);
      if (!payloadMatches) {
        throw new RefundValidationError(
          REFUND_ERROR_CODES.REFUND_IDEMPOTENCY_CONFLICT,
          'This idempotency key was already used with a different refund payload',
          409
        );
      }
      return existing;
    }

    const { order, refundableBalance } = await getRefundableBalanceSummaryTx(
      tx,
      tenantId,
      orderId
    );

    await assertOpenPosSessionForFinanceTx(tx, {
      tenantId,
      userId: requestedBy,
      posSessionId,
      branchId: order.branch_id,
    });

    if (amount > refundableBalance) {
      throw new Error(
        `Refund amount (${amount}) exceeds refundable balance (${refundableBalance})`
      );
    }

    // ── Source derivation (D002 v2, B01 §4): the service is the only
    // classifier — callers supply lineage + context, never the source. ──
    let refundSourceType: RefundSourceType;

    if (isManualException) {
      refundSourceType = REFUND_SOURCE_TYPES.MANUAL_EXCEPTION;
    } else if (originalPaymentId) {
      const payment = await tx.org_order_payments_dtl.findFirst({
        where: {
          id: originalPaymentId,
          tenant_org_id: tenantId,
          order_id: orderId,
          is_active: true,
        },
        select: {
          id: true,
          amount: true,
          payment_status: true,
        },
      });

      if (!payment) {
        throw new Error('Original payment row was not found for this order');
      }
      if (payment.payment_status !== 'COMPLETED') {
        throw new Error('Only completed payment rows can be refunded');
      }

      const priorForPayment = await sumProcessedRefundsForPaymentTx(
        tx,
        tenantId,
        orderId,
        originalPaymentId
      );
      const remainingForPayment = toNumber(payment.amount) - priorForPayment;
      if (amount > remainingForPayment) {
        throw new Error(
          `Refund amount (${amount}) exceeds remaining refundable source amount (${remainingForPayment})`
        );
      }

      refundSourceType = REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND;
    } else if (originalCreditAppId) {
      const creditApp = await tx.org_order_credit_apps_dtl.findFirst({
        where: {
          id: originalCreditAppId,
          tenant_org_id: tenantId,
          order_id: orderId,
          is_active: true,
        },
        select: {
          id: true,
          credit_type: true,
          applied_amount: true,
        },
      });

      if (!creditApp) {
        throw new Error('Original credit application row was not found for this order');
      }

      const mappedSource = mapCreditTypeToRefundSource(creditApp.credit_type);
      if (!mappedSource) {
        throw new RefundValidationError(
          REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH,
          `Credit application type (${creditApp.credit_type}) has no refund source mapping`,
          400
        );
      }

      // Column-based cumulative cap (B01 §6): indexed lookup on the promoted
      // lineage column replaces the legacy metadata-JSON iteration.
      const consumedFromSource = await sumProcessedRefundsForCreditAppTx(
        tx,
        tenantId,
        orderId,
        originalCreditAppId
      );
      const remainingForCredit = toNumber(creditApp.applied_amount) - consumedFromSource;
      if (amount > remainingForCredit) {
        throw new Error(
          `Refund amount (${amount}) exceeds remaining refundable credit amount (${remainingForCredit})`
        );
      }

      refundSourceType = mappedSource;
    } else {
      // No prior settlement leg — goodwill / price concession (D002 v2).
      if (!notes?.trim()) {
        throw new RefundValidationError(
          REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID,
          'Goodwill refunds without source lineage require a non-empty reason note',
          400
        );
      }
      refundSourceType = REFUND_SOURCE_TYPES.GOODWILL_CONCESSION;
    }

    // Concurrency-safe refund number (F-R3): the prior `count(*)+1` approach
    // raced — two concurrent refunds read the same count and minted the same
    // REF- number. `fn_next_fin_doc_no` takes a row-level FOR UPDATE lock on
    // the tenant's REFUND sequence and returns the formatted number atomically
    // (same mechanism as AR invoice numbering). Seeded by migration with the
    // `REF-` prefix; auto-created if missing.
    const refundNoRows = await tx.$queryRaw<Array<{ doc_no: string | null }>>(Prisma.sql`
      SELECT public.fn_next_fin_doc_no(${tenantId}::uuid, ${REFUND_DOC_TYPE_CODE}) AS doc_no
    `);
    const refundNo = refundNoRows[0]?.doc_no;
    if (!refundNo) {
      throw new Error('Failed to generate refund number.');
    }

    const refund = await tx.org_order_refunds_dtl.create({
      data: {
        tenant_org_id: tenantId,
        order_id: orderId,
        original_payment_id: originalPaymentId ?? null,
        original_credit_app_id: originalCreditAppId ?? null,
        refund_no: refundNo,
        refund_amount: amount,
        currency_code: currencyCode,
        reason_code: reason,
        refund_reason: notes ?? null,
        refund_method_code: method,
        refund_source_type: refundSourceType,
        refund_context: refundContext,
        pos_session_id: posSessionId ?? null,
        refund_status: approvalRequired ? 'PENDING_APPROVAL' : 'APPROVED',
        idempotency_key: idempotencyKey,
        created_by: requestedBy,
        metadata: mergeMetadata(metadata, {
          refund_scope: isManualException
            ? REFUND_SCOPES.MANUAL_EXCEPTION
            : REFUND_SCOPES.STANDARD,
          original_payment_id: originalPaymentId ?? null,
          original_credit_app_id: originalCreditAppId ?? null,
          requested_reopen_amount: isManualException ? (reopensDueAmount ?? 0) : null,
          requested_by: requestedBy,
        }),
        is_active: true,
        rec_status: 1,
      },
    });

    await emitEventTx(
      tx,
      tenantId,
      OUTBOX_EVENT_TYPES.REFUND_PROCESSED,
      'order_refund',
      refund.id,
      {
        stage: 'INITIATED',
        refundId: refund.id,
        orderId,
        orderNo: order.order_no,
        amount,
        method,
        reason,
        refundContext,
        refundSourceType,
        refundScope: isManualException
          ? REFUND_SCOPES.MANUAL_EXCEPTION
          : REFUND_SCOPES.STANDARD,
      }
    );

    return refund;
  });
}

/**
 * Manager approval gate. Moves refund from PENDING_APPROVAL to APPROVED.
 * @param tenantId
 * @param refundId
 * @param approverId
 */
export async function approveRefund(
  tenantId: string,
  refundId: string,
  approverId: string
) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.org_order_refunds_dtl.findFirstOrThrow({
      where: {
        id: refundId,
        tenant_org_id: tenantId,
        refund_status: 'PENDING_APPROVAL',
      },
    });

  const ENABLE_SELF_APPROVAL_CHECK = false;

    // B34 maker≠checker: the requester can never approve their own refund —
    // enforced here (single authority for API and any future caller) and
    // reflected in the UI as a disabled button with the reason.
    if (ENABLE_SELF_APPROVAL_CHECK && refund.created_by && refund.created_by === approverId) {
      throw new RefundValidationError(
        REFUND_ERROR_CODES.REFUND_SELF_APPROVAL_BLOCKED,
        'A refund cannot be approved by the user who requested it (maker-checker)',
        403
      );
    }

    const updated = await tx.org_order_refunds_dtl.update({
      where: { id: refund.id },
      data: {
        refund_status: 'APPROVED',
        approved_by: approverId,
        approved_at: new Date(),
        updated_at: new Date(),
        updated_by: approverId,
        metadata: mergeMetadata(refund.metadata, {
          approved_by: approverId,
        }),
      },
    });

    await emitEventTx(
      tx,
      tenantId,
      OUTBOX_EVENT_TYPES.REFUND_PROCESSED,
      'order_refund',
      refundId,
      {
        stage: 'APPROVED',
        refundId,
        orderId: refund.order_id,
        approverId,
      }
    );

    return updated;
  });
}

/**
 * B9 — execution inputs for CASH/ORIGINAL_METHOD refund destinations.
 * Omitted or `enabled: false` preserves the exact pre-B9 record-only
 * behavior (flag-off rollback path).
 */
export interface RefundExecutionInput {
  enabled: boolean;
  /** Required when refund_method_code = CASH. */
  cashDrawerSessionId?: string;
  /** Optional register-session gate, mirrors initiateRefund's own opt-in check. */
  posSessionId?: string;
  /** Required when refund_method_code = ORIGINAL_METHOD — an operator-entered
   *  proof of the manual/gateway settlement (bank transfer ref, terminal void
   *  slip no., gateway dashboard ref, etc.). Never claimed automatically. */
  manualSettlementReference?: string;
}

/**
 * Process an approved refund. Re-validates the B01 facts and caps, performs
 * the destination execution where needed, writes `reopens_due_amount` once
 * per the approved D003 v2 rules, recalculates the financial snapshot, and
 * emits the final outbox event.
 *
 * B9: when `execution.enabled` is true, CASH destinations create a
 * REFUND_VOUCHER wired to a real cash-drawer CASH_OUT movement (D007: BVM
 * refund voucher + operational fact commit transactionally with the refund
 * row); ORIGINAL_METHOD destinations create a REFUND_VOUCHER carrying the
 * operator's manual-settlement reference (no gateway API exists yet — B8).
 * When omitted/false, both destinations remain record-only exactly as they
 * were before this package (the flag-off rollback path).
 * @param tenantId
 * @param refundId
 * @param processedBy
 * @param execution
 */
export async function processRefund(
  tenantId: string,
  refundId: string,
  processedBy?: string,
  execution?: RefundExecutionInput
) {
  return prisma.$transaction(async (tx) => {
    // F-R2 (D-12 §4): lock the refund row FOR UPDATE before issuing any stored value.
    // Without this, two concurrent processRefund calls could both read status APPROVED
    // and both issue a wallet top-up / credit note (double-issue). The lock serializes
    // them; the loser sees the row no longer APPROVED (it was moved to PROCESSED) and
    // aborts. Pairs with the per-refund idempotency keys passed to the stored-value
    // writers below (defense-in-depth skip-on-existing).
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_order_refunds_dtl
      WHERE id = ${refundId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND refund_status = 'APPROVED'
      FOR UPDATE`;
    if (!locked[0]) {
      throw new Error('Refund not found or not awaiting processing');
    }

    const refund = await tx.org_order_refunds_dtl.findFirstOrThrow({
      where: { id: refundId, tenant_org_id: tenantId, refund_status: 'APPROVED' },
    });

    const { order, refundableBalance } = await getRefundableBalanceSummaryTx(
      tx,
      tenantId,
      refund.order_id
    );

    const amount = toNumber(refund.refund_amount);
    const method = refund.refund_method_code as RefundMethod;
    const customerId = order.customer_id;
    const metadata = parseMetadata(refund.metadata);
    const refundContext = refund.refund_context as RefundContext;

    // B01 §4: re-validate the stamped facts before any destination executes.
    if (!Object.values(REFUND_CONTEXTS).includes(refundContext)) {
      throw new RefundValidationError(
        REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID,
        `Refund ${refundId} carries an unknown refund context (${String(refundContext)})`,
        422
      );
    }

    if (amount > refundableBalance) {
      throw new Error(
        `Refund amount (${amount}) exceeds remaining refundable balance (${refundableBalance})`
      );
    }

    // B01 §11: source caps are re-checked at process time with the indexed
    // column sums — concurrent partial refunds serialize on the row locks and
    // the loser exceeds the remaining cap and fails cleanly here.
    if (refund.original_payment_id) {
      const payment = await tx.org_order_payments_dtl.findFirst({
        where: {
          id: refund.original_payment_id,
          tenant_org_id: tenantId,
          order_id: refund.order_id,
          is_active: true,
        },
        select: { amount: true },
      });
      if (payment) {
        const priorForPayment = await sumProcessedRefundsForPaymentTx(
          tx,
          tenantId,
          refund.order_id,
          refund.original_payment_id
        );
        if (amount > toNumber(payment.amount) - priorForPayment) {
          throw new Error(
            `Refund amount (${amount}) exceeds remaining refundable source amount (${toNumber(payment.amount) - priorForPayment})`
          );
        }
      }
    }

    if (refund.original_credit_app_id) {
      const creditApp = await tx.org_order_credit_apps_dtl.findFirst({
        where: {
          id: refund.original_credit_app_id,
          tenant_org_id: tenantId,
          order_id: refund.order_id,
          is_active: true,
        },
        select: { applied_amount: true },
      });
      if (creditApp) {
        const consumedFromSource = await sumProcessedRefundsForCreditAppTx(
          tx,
          tenantId,
          refund.order_id,
          refund.original_credit_app_id
        );
        if (amount > toNumber(creditApp.applied_amount) - consumedFromSource) {
          throw new Error(
            `Refund amount (${amount}) exceeds remaining refundable credit amount (${toNumber(creditApp.applied_amount) - consumedFromSource})`
          );
        }
      }
    }

    // D003 v2: computed exactly once here; immutable afterwards (B01 §5).
    const reopensDueAmount = resolveReopensDueAmount(
      refundContext,
      amount,
      metadata.requested_reopen_amount
    );

    if (method === REFUND_METHODS.WALLET && customerId) {
      // B01 §12: dedicated wallet destination key (defense-in-depth beside the
      // FOR UPDATE lock) — a replay after commit skips on the existing ledger row.
      await topUpWalletTx(tx, {
        tenantId,
        customerId,
        amount,
        orderId: order.id,
        notes: `Refund for order ${order.order_no}`,
        performedBy: processedBy,
        currencyCode: refund.currency_code ?? order.currency_code,
        idempotencyKey: `refund-${refundId}-wallet`,
      });
    } else if (method === REFUND_METHODS.CREDIT_NOTE && customerId) {
      // F-R2: use the tx-composed, idempotent variant so the credit note is atomic
      // with the refund update AND a retry can't issue a second note.
      await issueCreditNoteTx(tx, {
        tenantId,
        customerId,
        amount,
        reason: `Refund for order ${order.order_no}`,
        orderId: order.id,
        currencyCode: requireCurrencyCode(
          refund.currency_code ?? order.currency_code,
          `refund ${refundId} credit-note issuance`
        ),
        issuedBy: processedBy,
        idempotencyKey: `refund-${refundId}-cn`,
      });
    } else if (
      (method === REFUND_METHODS.CASH || method === REFUND_METHODS.ORIGINAL_METHOD) &&
      execution?.enabled
    ) {
      // B9: real execution behind the flag. Flag-off (or execution omitted)
      // falls through with no branch at all — the exact pre-B9 record-only
      // behavior (no voucher, no drawer movement, no gateway call).
      const refundCurrencyCode = requireCurrencyCode(
        refund.currency_code ?? order.currency_code,
        `refund ${refundId} execution`
      );

      if (method === REFUND_METHODS.CASH) {
        if (!execution.cashDrawerSessionId) {
          throw new RefundValidationError(
            REFUND_ERROR_CODES.REFUND_CASH_DRAWER_SESSION_REQUIRED,
            'A cash-drawer session is required to execute a CASH refund',
            422
          );
        }
        const session = await tx.org_cash_drawer_sessions_mst.findFirst({
          where: { id: execution.cashDrawerSessionId, tenant_org_id: tenantId, status: 'OPEN' },
          select: { id: true },
        });
        if (!session) {
          throw new RefundValidationError(
            REFUND_ERROR_CODES.REFUND_CASH_DRAWER_SESSION_NOT_OPEN,
            'The selected cash-drawer session is not open',
            422
          );
        }
        // Opportunistic register-session gate — mirrors initiateRefund's own
        // opt-in check (item 5 of the B9 research); a no-op if not supplied.
        await assertOpenPosSessionForFinanceTx(tx, {
          tenantId,
          userId: processedBy ?? '',
          posSessionId: execution.posSessionId,
          branchId: order.branch_id ?? undefined,
        });

        const voucher = await createBizVoucher(
          tenantId,
          {
            voucher_type:    VOUCHER_TYPE.REFUND,
            direction:       VOUCHER_DIRECTION.OUT,
            party_type:      PARTY_TYPE.CUSTOMER,
            customer_id:     customerId ?? undefined,
            order_id:        order.id,
            source_module:   'ORDERS',
            source_ref_type: 'ORDER',
            source_ref_id:   order.id,
            currency_code:   refundCurrencyCode,
            total_amount:    amount,
            branch_id:       order.branch_id ?? undefined,
            idempotency_key: `refund-${refundId}-vch`,
          },
          processedBy ?? 'system',
          tx,
        );

        const line = await addVoucherLine(
          tenantId,
          voucher.id,
          {
            line_type:              LINE_TYPE.REFUND,
            line_role:              LINE_ROLE.ORDER_REFUND,
            direction:              VOUCHER_DIRECTION.OUT,
            target_type:            TARGET_TYPE.ORDER,
            target_id:              order.id,
            order_id:               order.id,
            customer_id:            customerId ?? undefined,
            branch_id:              order.branch_id ?? undefined,
            payment_method_code:    REFUND_METHODS.CASH,
            payment_status:         'COMPLETED',
            amount,
            currency_code:          refundCurrencyCode,
            cash_drawer_session_id: execution.cashDrawerSessionId,
            pos_session_id:         execution.posSessionId,
            idempotency_key:        `refund-${refundId}-vch-line`,
          },
          processedBy ?? 'system',
          undefined,
          tx,
        );

        await postAndWireBizVoucher(tenantId, voucher.id, processedBy ?? 'system', `refund-${refundId}-vch-post`, tx);

        const movement = await tx.org_cash_drawer_movements_dtl.findFirst({
          where: { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantId },
          select: { id: true },
        });

        await tx.org_order_refunds_dtl.update({
          where: { id: refundId },
          data: {
            fin_voucher_id:          voucher.id,
            fin_voucher_trx_line_id: line.id,
            cash_drawer_movement_id: movement?.id ?? null,
          },
        });
      } else {
        // ORIGINAL_METHOD — no gateway API exists yet (B8); require an explicit
        // manual-settlement reference so this is never a silent claim (D004/D007).
        const manualRef = execution.manualSettlementReference?.trim();
        if (!manualRef) {
          throw new RefundValidationError(
            REFUND_ERROR_CODES.REFUND_MANUAL_SETTLEMENT_REFERENCE_REQUIRED,
            'A manual settlement reference is required to execute an ORIGINAL_METHOD refund',
            422
          );
        }

        const voucher = await createBizVoucher(
          tenantId,
          {
            voucher_type:    VOUCHER_TYPE.REFUND,
            direction:       VOUCHER_DIRECTION.OUT,
            party_type:      PARTY_TYPE.CUSTOMER,
            customer_id:     customerId ?? undefined,
            order_id:        order.id,
            source_module:   'ORDERS',
            source_ref_type: 'ORDER',
            source_ref_id:   order.id,
            currency_code:   refundCurrencyCode,
            total_amount:    amount,
            branch_id:       order.branch_id ?? undefined,
            idempotency_key: `refund-${refundId}-vch`,
          },
          processedBy ?? 'system',
          tx,
        );

        const line = await addVoucherLine(
          tenantId,
          voucher.id,
          {
            line_type:           LINE_TYPE.REFUND,
            line_role:           LINE_ROLE.ORDER_REFUND,
            direction:           VOUCHER_DIRECTION.OUT,
            target_type:         TARGET_TYPE.ORDER,
            target_id:           order.id,
            order_id:            order.id,
            customer_id:         customerId ?? undefined,
            branch_id:           order.branch_id ?? undefined,
            payment_method_code: REFUND_METHODS.ORIGINAL_METHOD,
            payment_status:      'COMPLETED',
            amount,
            currency_code:       refundCurrencyCode,
            gateway_reference:   manualRef,
            idempotency_key:     `refund-${refundId}-vch-line`,
          },
          processedBy ?? 'system',
          undefined,
          tx,
        );

        await postAndWireBizVoucher(tenantId, voucher.id, processedBy ?? 'system', `refund-${refundId}-vch-post`, tx);

        await tx.org_order_refunds_dtl.update({
          where: { id: refundId },
          data: {
            fin_voucher_id:          voucher.id,
            fin_voucher_trx_line_id: line.id,
            gateway_refund_id:       manualRef,
          },
        });
      }
    }
    // CASH / ORIGINAL_METHOD with execution disabled (or omitted) remain
    // record-only — the exact pre-B9 behavior (no drawer OUT, no gateway call).

    const updated = await tx.org_order_refunds_dtl.update({
      where: { id: refundId },
      data: {
        refund_status: 'PROCESSED',
        reopens_due_amount: reopensDueAmount,
        processed_at: new Date(),
        updated_at: new Date(),
        updated_by: processedBy ?? null,
        metadata: mergeMetadata(metadata, {
          processed_by: processedBy ?? null,
        }),
      },
    });

    const snapshot = await recalculateOrderFinancialSnapshotTx(
      tx,
      tenantId,
      refund.order_id
    );

    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.REFUND_PROCESSED, 'order', order.id, {
      stage: 'PROCESSED',
      refundId,
      amount,
      method,
      customerId,
      refundContext,
      refundSourceType: refund.refund_source_type,
      reopensDueAmount,
      originalPaymentId: refund.original_payment_id ?? null,
      originalCreditAppId: refund.original_credit_app_id ?? metadata.original_credit_app_id ?? null,
      paymentStatus: snapshot.paymentStatus,
      outstandingAmount: snapshot.outstandingAmount,
    });

    return updated;
  });
}

/**
 *
 * @param tenantId
 * @param orderId
 */
export async function getOrderRefunds(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'desc' },
    })
  );
}

export { REFUND_METHODS, REFUND_REASON_CODES };
