import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  CREDIT_APPLICATION_STATUSES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  OUTBOX_EVENT_TYPES,
  REFUND_CONTEXTS,
  REFUND_REASON_CODES,
  REFUND_METHODS,
} from '@/lib/constants/order-financial';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { reversePromoUsageTx } from '@/lib/services/discount-service';
import { issueCreditNoteTx } from '@/lib/services/stored-value.service';
import { initiateRefund } from '@/lib/services/order-refund.service';
import { reverseCreditApplicationTx } from '@/lib/services/credit-application-reversal.service';
import { emitEventTx } from '@/lib/services/outbox.service';
import { logger } from '@/lib/utils/logger';
import { requireCurrencyCode } from '@/lib/money/currency-resolution';

/**
 * Why:
 * ADR_CANCEL_RETURN_RULES (2026-07-25) forbids automatic Fin unwind on cancel.
 * Workflow cancel no longer calls this helper. Keep it as a deprecated, explicit
 * operator tool for tests and any future admin-triggered unwind — money on
 * cancel is supposed to move through Fin screens (B13 voucher reverse, B09
 * refunds). D006 credit restore lives in credit-application-reversal.service.ts.
 *
 * @deprecated Do not invoke from order cancellation. Use explicit Fin reverse/refund.
 */

/** How the operator disposes of real collected payments on cancellation. */
export const CANCEL_DISPOSITIONS = {
  /** Route every COMPLETED payment into the approval-gated refund flow. */
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
 * Explicit financial unwind helper — not invoked by order cancellation.
 * Call only from tests or a future admin tool. Safe to retry (CAS / keys).
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
          {
            tenantId: input.tenantId,
            orderId: input.orderId,
            userId: input.userId,
            reason: input.reason,
            idempotencyPrefix: `cancel-${input.orderId}`,
            updatedInfo: `Explicit unwind — credit application reversed (${input.reason})`,
          },
          app,
          order.customer_id,
          warnings,
        );
        reversed += 1;
        restoredAmount += restoredNow.restoredAmount;
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
        // idempotency-keyed) so the approval-gated refund flow stays intact.
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
