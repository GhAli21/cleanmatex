import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { PrismaTransactionClient } from '@/lib/services/order-settlement.service';
import {
  CREDIT_APPLICATION_STATUSES,
  CREDIT_APPLICATION_TYPES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  OUTBOX_EVENT_TYPES,
  REFUND_CONTEXTS,
  REFUND_REASON_CODES,
  REFUND_METHODS,
} from '@/lib/constants/order-financial';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { reversePromoUsageTx } from '@/lib/services/discount-service';
import { refundGiftCardTx } from '@/lib/services/gift-card-service';
import {
  topUpWalletTx,
  issueAdvanceTx,
  issueCreditNoteTx,
} from '@/lib/services/stored-value.service';
import { initiateRefund } from '@/lib/services/order-refund.service';
import { emitEventTx } from '@/lib/services/outbox.service';
import { logger } from '@/lib/utils/logger';
import { requireCurrencyCode } from '@/lib/money/currency-resolution';

/**
 * Why:
 * Cancelling a paid order must never strand the customer's money (validation
 * finding FN-02). This service is the single financial unwind for order
 * cancellation: it reverses APPLIED credit applications back to their source
 * ledgers, routes real payments through an explicit disposition chosen at
 * cancel time, reverses promo usage, recalculates the canonical snapshot, and
 * leaves an outbox audit event — all idempotently, so a failed unwind can be
 * retried after the status transition already committed.
 */

/** How the operator disposes of real collected payments on cancellation. */
export const CANCEL_DISPOSITIONS = {
  /** Route every COMPLETED payment into the (maker-checker) refund flow. */
  REFUND: 'REFUND',
  /** Convert the collected total into an active customer credit note. */
  STORE_CREDIT: 'STORE_CREDIT',
  /** Retain the money (e.g. cancellation charge) — approval-gated upstream. */
  KEEP_ON_ACCOUNT: 'KEEP_ON_ACCOUNT',
} as const;
export type CancelDisposition =
  (typeof CANCEL_DISPOSITIONS)[keyof typeof CANCEL_DISPOSITIONS];

export interface UnwindOrderFinancialsInput {
  tenantId: string;
  orderId: string;
  userId: string;
  /** Required when the order holds real collected payments. */
  disposition?: CancelDisposition;
  reason: string;
}

export interface UnwindOrderFinancialsResult {
  reversedCreditApplications: number;
  restoredStoredValueAmount: number;
  paidAmountDisposed: number;
  disposition: CancelDisposition | null;
  refundIds: string[];
  creditNoteId: string | null;
  warnings: string[];
}

const MONEY_EPSILON = 0.001;

/**
 * Reverse one APPLIED credit application back to its source ledger.
 * The APPLIED→REVERSED flip is a compare-and-set (`updateMany` with the status
 * in the WHERE) so a retried unwind can never double-restore stored value.
 * @param tx active transaction client
 * @param input unwind input (tenant/order/user/reason)
 * @param app credit application row
 * @param customerId order customer (stored-value restore target)
 * @param warnings mutable warning collector
 * @returns restored amount (0 when skipped)
 */
async function reverseCreditApplicationTx(
  tx: PrismaTransactionClient,
  input: UnwindOrderFinancialsInput,
  app: {
    id: string;
    credit_type: string;
    credit_source_id: string | null;
    applied_amount: unknown;
    currency_code: string;
  },
  customerId: string | null,
  warnings: string[],
): Promise<number> {
  const amount = Number(app.applied_amount ?? 0);

  const flipped = await tx.org_order_credit_apps_dtl.updateMany({
    where: {
      id: app.id,
      tenant_org_id: input.tenantId,
      application_status: CREDIT_APPLICATION_STATUSES.APPLIED,
    },
    data: {
      application_status: CREDIT_APPLICATION_STATUSES.REVERSED,
      updated_at: new Date(),
      updated_by: input.userId,
      updated_info: `Order cancelled — credit application reversed (${input.reason})`.slice(0, 500),
    },
  });
  if (flipped.count === 0) return 0; // already reversed by an earlier attempt

  const restoreKey = `cancel-${input.orderId}-ca-${app.id}`;
  const restoreNote = `Order cancelled — restored from credit application ${app.id}`;

  switch (app.credit_type) {
    case CREDIT_APPLICATION_TYPES.GIFT_CARD: {
      if (!app.credit_source_id) {
        warnings.push(`Gift-card credit application ${app.id} has no source card — restore manually.`);
        return 0;
      }
      const { actualRefundAmount } = await refundGiftCardTx(tx, {
        giftCardId: app.credit_source_id,
        amount,
        orderId: input.orderId,
        invoiceId: '',
        reason: restoreNote.slice(0, 500),
        processedBy: input.userId,
        tenantOrgId: input.tenantId,
        idempotencyKey: restoreKey,
      });
      if (actualRefundAmount < amount - MONEY_EPSILON) {
        warnings.push(
          `Gift card ${app.credit_source_id}: restored ${actualRefundAmount} of ${amount} (capped at original amount).`,
        );
      }
      return actualRefundAmount;
    }
    case CREDIT_APPLICATION_TYPES.WALLET: {
      if (!customerId) {
        warnings.push(`Wallet credit application ${app.id}: order has no customer — restore manually.`);
        return 0;
      }
      // topUpWalletTx has no idempotency key — the APPLIED→REVERSED CAS above
      // is the single-execution guard for this restore.
      await topUpWalletTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        orderId: input.orderId,
        notes: restoreNote,
        performedBy: input.userId,
        currencyCode: app.currency_code,
      });
      return amount;
    }
    case CREDIT_APPLICATION_TYPES.ADVANCE: {
      if (!customerId) {
        warnings.push(`Advance credit application ${app.id}: order has no customer — restore manually.`);
        return 0;
      }
      await issueAdvanceTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        notes: restoreNote,
        performedBy: input.userId,
        currencyCode: app.currency_code,
      });
      return amount;
    }
    case CREDIT_APPLICATION_TYPES.CREDIT_NOTE: {
      if (!customerId) {
        warnings.push(`Credit-note application ${app.id}: order has no customer — restore manually.`);
        return 0;
      }
      // The consumed note may be expired/exhausted; issuing a fresh note for
      // the reversed amount is the auditable restore (mirrors refund flow).
      await issueCreditNoteTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        reason: restoreNote,
        orderId: input.orderId,
        issuedBy: input.userId,
        currencyCode: app.currency_code,
        idempotencyKey: restoreKey,
      });
      return amount;
    }
    default: {
      // e.g. LOYALTY_POINTS — no automated restore path yet; surfaced, never silent.
      warnings.push(
        `Credit application ${app.id} (${app.credit_type}, ${amount}) marked REVERSED but requires manual restore.`,
      );
      return 0;
    }
  }
}

/**
 * Financial unwind for a cancelled order. Call AFTER the status transition
 * commits; safe to retry (every step is CAS- or idempotency-key-guarded).
 *
 * @param input tenant/order/user, disposition for real payments, reason
 * @returns per-step outcome + warnings for the UI/audit trail
 */
export async function unwindOrderFinancialsOnCancel(
  input: UnwindOrderFinancialsInput,
): Promise<UnwindOrderFinancialsResult> {
  const warnings: string[] = [];

  const txResult = await withTenantContext(input.tenantId, () =>
    prisma.$transaction(async (tx) => {
      const order = await tx.org_orders_mst.findFirstOrThrow({
        where: { id: input.orderId, tenant_org_id: input.tenantId },
        select: { customer_id: true, currency_code: true },
      });

      const [creditApps, payments] = await Promise.all([
        tx.org_order_credit_apps_dtl.findMany({
          where: {
            tenant_org_id: input.tenantId,
            order_id: input.orderId,
            application_status: CREDIT_APPLICATION_STATUSES.APPLIED,
          },
          select: {
            id: true,
            credit_type: true,
            credit_source_id: true,
            applied_amount: true,
            currency_code: true,
          },
        }),
        tx.org_order_payments_dtl.findMany({
          where: {
            tenant_org_id: input.tenantId,
            order_id: input.orderId,
            is_active: true,
            payment_status: { in: [...ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED] },
          },
          select: {
            id: true,
            amount: true,
            change_returned_amount: true,
            payment_method_code: true,
            currency_code: true,
          },
        }),
      ]);

      // 1. Reverse applied credit back to stored-value ledgers.
      let reversed = 0;
      let restoredAmount = 0;
      for (const app of creditApps) {
        const restoredNow = await reverseCreditApplicationTx(
          tx,
          input,
          app,
          order.customer_id,
          warnings,
        );
        reversed += 1;
        restoredAmount += restoredNow;
      }

      // 2. Real payments — net of change already returned at the counter.
      const paidNet = payments.reduce(
        (sum, p) => sum + Number(p.amount ?? 0) - Number(p.change_returned_amount ?? 0),
        0,
      );

      let creditNoteId: string | null = null;
      let disposition: CancelDisposition | null = null;
      if (paidNet > MONEY_EPSILON) {
        disposition = input.disposition ?? null;
        if (!disposition) {
          // Guarded upstream; hard backstop so money can never pass silently.
          throw new Error('CANCEL_DISPOSITION_REQUIRED');
        }
        if (disposition === CANCEL_DISPOSITIONS.STORE_CREDIT) {
          if (!order.customer_id) {
            throw new Error('STORE_CREDIT disposition requires an order customer');
          }
          const note = await issueCreditNoteTx(tx, {
            tenantId: input.tenantId,
            customerId: order.customer_id,
            amount: paidNet,
            reason: `Order cancelled — collected payments converted to store credit (${input.reason})`.slice(0, 500),
            orderId: input.orderId,
            issuedBy: input.userId,
            currencyCode: requireCurrencyCode(
              payments[0]?.currency_code ?? order.currency_code,
              `cancel ${input.orderId} store-credit issuance`
            ),
            idempotencyKey: `cancel-${input.orderId}-store-credit`,
          });
          creditNoteId = note.id;
        }
        // REFUND: rows are created post-tx via initiateRefund (own transaction,
        // idempotency-keyed) so the maker-checker refund flow stays intact.
        // KEEP_ON_ACCOUNT: no financial mutation — approval enforced upstream;
        // the outbox event below is the durable audit record.
      }

      // 3. Promo usage reversal (canonical usage log; no-op when unused).
      const promo = await reversePromoUsageTx(tx, {
        orderId: input.orderId,
        tenantOrgId: input.tenantId,
        voidedBy: input.userId,
      });

      // 4. Snapshot recalc — REVERSED credit no longer counts, statuses settle.
      await recalculateOrderFinancialSnapshotTx(tx, input.tenantId, input.orderId, {});

      // 5. Durable audit trail.
      await emitEventTx(
        tx,
        input.tenantId,
        OUTBOX_EVENT_TYPES.ORDER_CANCEL_FINANCIAL_UNWIND,
        'ORDER',
        input.orderId,
        {
          disposition,
          paidAmountDisposed: paidNet,
          reversedCreditApplications: reversed,
          restoredStoredValueAmount: restoredAmount,
          promoUsagesReversed: promo.reversedCount,
          creditNoteId,
          reason: input.reason,
          performedBy: input.userId,
          warnings,
        },
      );

      return { reversed, restoredAmount, paidNet, disposition, creditNoteId, payments };
    }),
  );

  // 6. REFUND disposition — one refund per payment row, outside the unwind tx
  // (initiateRefund runs its own transaction and is idempotent per key).
  const refundIds: string[] = [];
  if (
    txResult.disposition === CANCEL_DISPOSITIONS.REFUND &&
    txResult.paidNet > MONEY_EPSILON
  ) {
    for (const payment of txResult.payments) {
      const refundable =
        Number(payment.amount ?? 0) - Number(payment.change_returned_amount ?? 0);
      if (refundable <= MONEY_EPSILON) continue;
      try {
        const refund = await initiateRefund(input.tenantId, {
          orderId: input.orderId,
          amount: refundable,
          reason: REFUND_REASON_CODES.CANCELLED,
          method: REFUND_METHODS.ORIGINAL_METHOD,
          // B01/D003 v2: cancel unwind is its own reason_context — the sale is
          // dead, so the refund row never reopens the customer's due.
          refundContext: REFUND_CONTEXTS.CANCELLATION_UNWIND,
          notes: `Order cancelled: ${input.reason}`.slice(0, 500),
          requestedBy: input.userId,
          currencyCode: payment.currency_code,
          originalPaymentId: payment.id,
          idempotencyKey: `cancel-${input.orderId}-refund-${payment.id}`,
        });
        refundIds.push(refund.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Refund initiation failed for payment ${payment.id}: ${message}`);
        logger.error(
          'Cancel-unwind refund initiation failed',
          error instanceof Error ? error : new Error(message),
          { feature: 'order-cancel', orderId: input.orderId, paymentId: payment.id },
        );
      }
    }
  }

  return {
    reversedCreditApplications: txResult.reversed,
    restoredStoredValueAmount: txResult.restoredAmount,
    paidAmountDisposed: txResult.paidNet,
    disposition: txResult.disposition,
    refundIds,
    creditNoteId: txResult.creditNoteId,
    warnings,
  };
}
