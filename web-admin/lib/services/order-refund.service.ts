import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  OUTBOX_EVENT_TYPES,
  REFUND_DOC_TYPE_CODE,
  REFUND_METHODS,
  REFUND_REASON_CODES,
} from '@/lib/constants/order-financial';
import type { RefundMethod, RefundReasonCode } from '@/lib/types/order-financial';
import { emitEventTx } from './outbox.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { assertOpenPosSessionForFinanceTx } from './pos-session.service';
import { topUpWalletTx, issueCreditNoteTx } from './stored-value.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const REFUND_SCOPES = {
  STANDARD: 'STANDARD',
  MANUAL_EXCEPTION: 'MANUAL_EXCEPTION',
} as const;

/**
 *
 */
export type RefundScope = (typeof REFUND_SCOPES)[keyof typeof REFUND_SCOPES];

interface RefundMetadata {
  refund_scope?: RefundScope;
  original_credit_app_id?: string | null;
  original_payment_id?: string | null;
  fin_voucher_id?: string | null;
  fin_voucher_trx_line_id?: string | null;
  requested_by?: string | null;
  approved_by?: string | null;
  processed_by?: string | null;
  [key: string]: unknown;
}

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
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
 * Why:
 * Batch 0 keeps the live refund RBAC contract, but the refund write path now
 * needs to capture lineage, support manual exceptions safely, and recalculate
 * the order snapshot from fact rows instead of writing ad-hoc header statuses.
 */
export interface InitiateRefundParams {
  orderId: string;
  amount: number;
  reason: RefundReasonCode;
  method: RefundMethod;
  notes?: string;
  requestedBy: string;
  currencyCode: string;
  originalPaymentId?: string;
  originalCreditAppId?: string;
  refundScope?: RefundScope;
  approvalRequired?: boolean;
  idempotencyKey?: string;
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
    notes,
    requestedBy,
    currencyCode,
    originalPaymentId,
    originalCreditAppId,
    refundScope = REFUND_SCOPES.STANDARD,
    approvalRequired = true,
    idempotencyKey,
    posSessionId,
    metadata,
  } = params;

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  if (
    refundScope === REFUND_SCOPES.MANUAL_EXCEPTION &&
    (originalPaymentId || originalCreditAppId)
  ) {
    throw new Error('Manual exception refunds cannot include original source lineage');
  }

  if (refundScope === REFUND_SCOPES.MANUAL_EXCEPTION && !notes?.trim()) {
    throw new Error('Manual exception refunds require a non-empty reason note');
  }

  return prisma.$transaction(async (tx) => {
    // F-R1 (D-12 §4): idempotent replay. The DB unique index `uq_refund_idempotency`
    // (tenant_org_id, idempotency_key) already prevents a duplicate row, but without
    // this lookup a keyed retry would surface a raw unique-violation and roll back the
    // whole tx. Return the existing refund so retries are graceful and side-effect-free.
    if (idempotencyKey) {
      const existing = await tx.org_order_refunds_dtl.findFirst({
        where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey, is_active: true },
      });
      if (existing) return existing;
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

    if (originalPaymentId) {
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

      const priorRefundsForPayment = await tx.org_order_refunds_dtl.aggregate({
        where: {
          tenant_org_id: tenantId,
          order_id: orderId,
          original_payment_id: originalPaymentId,
          is_active: true,
          refund_status: 'PROCESSED',
        },
        _sum: { refund_amount: true },
      });

      const remainingForPayment =
        toNumber(payment.amount) - toNumber(priorRefundsForPayment._sum.refund_amount);
      if (amount > remainingForPayment) {
        throw new Error(
          `Refund amount (${amount}) exceeds remaining refundable source amount (${remainingForPayment})`
        );
      }
    }

    if (originalCreditAppId) {
      const creditApp = await tx.org_order_credit_apps_dtl.findFirst({
        where: {
          id: originalCreditAppId,
          tenant_org_id: tenantId,
          order_id: orderId,
          is_active: true,
        },
        select: {
          id: true,
          applied_amount: true,
        },
      });

      if (!creditApp) {
        throw new Error('Original credit application row was not found for this order');
      }

      const priorCreditRefunds = await tx.org_order_refunds_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          order_id: orderId,
          is_active: true,
          refund_status: 'PROCESSED',
        },
        select: {
          refund_amount: true,
          metadata: true,
        },
      });

      const consumedFromSource = priorCreditRefunds.reduce((sum, row) => {
        const rowMetadata = parseMetadata(row.metadata);
        return rowMetadata.original_credit_app_id === originalCreditAppId
          ? sum + toNumber(row.refund_amount)
          : sum;
      }, 0);

      const remainingForCredit = toNumber(creditApp.applied_amount) - consumedFromSource;
      if (amount > remainingForCredit) {
        throw new Error(
          `Refund amount (${amount}) exceeds remaining refundable credit amount (${remainingForCredit})`
        );
      }
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
        refund_no: refundNo,
        refund_amount: amount,
        currency_code: currencyCode,
        reason_code: reason,
        refund_reason: notes ?? null,
        refund_method_code: method,
        pos_session_id: posSessionId ?? null,
        refund_status: approvalRequired ? 'PENDING_APPROVAL' : 'APPROVED',
        idempotency_key: idempotencyKey ?? null,
        created_by: requestedBy,
        metadata: mergeMetadata(metadata, {
          refund_scope: refundScope,
          original_payment_id: originalPaymentId ?? null,
          original_credit_app_id: originalCreditAppId ?? null,
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
        refundScope,
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
 * Process an approved refund. Performs the actual reversal where needed,
 * recalculates the financial snapshot, and emits the final outbox event.
 * @param tenantId
 * @param refundId
 * @param processedBy
 */
export async function processRefund(
  tenantId: string,
  refundId: string,
  processedBy?: string
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

    if (amount > refundableBalance) {
      throw new Error(
        `Refund amount (${amount}) exceeds remaining refundable balance (${refundableBalance})`
      );
    }

    if (method === REFUND_METHODS.WALLET && customerId) {
      // F-R2: the FOR UPDATE lock above is the dedupe guard for the wallet path
      // (topUpWalletTx has no idempotency key); a post-commit retry sees the row
      // no longer APPROVED and aborts before reaching here.
      await topUpWalletTx(tx, {
        tenantId,
        customerId,
        amount,
        orderId: order.id,
        notes: `Refund for order ${order.order_no}`,
        performedBy: processedBy,
        currencyCode: refund.currency_code,
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
        currencyCode: refund.currency_code || order.currency_code || 'OMR',
        issuedBy: processedBy,
        idempotencyKey: `refund-${refundId}-cn`,
      });
    }
    // CASH / ORIGINAL_METHOD remain operational reversals tracked through the
    // order refund row, cash drawer, and linked voucher metadata when present.

    const updated = await tx.org_order_refunds_dtl.update({
      where: { id: refundId },
      data: {
        refund_status: 'PROCESSED',
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
      originalPaymentId: refund.original_payment_id ?? null,
      originalCreditAppId: metadata.original_credit_app_id ?? null,
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
