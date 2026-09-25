/**
 * BVM Voucher Reversal Service
 * Creates a full reversal voucher (POSTED → REVERSED) or a partial line reversal.
 * Original lines are never deleted — a mirror reversal voucher is created instead.
 * Writes to existing org_fin_voucher_audit_log and org_domain_events_outbox.
 *
 * B13: when `order_fin_voucher_unwind` is ON, reverse wiring runs per line
 * role (ORDER_PAYMENT via B10, ORDER_CREDIT_APPLICATION via D006, stored-value
 * funding clawback). Flag OFF stays document-only.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { LINE_ROLE, WIRING_STATUS, normalizeVoucherLineRole } from '../constants/voucher';
import {
  CREDIT_APPLICATION_STATUSES,
  PAYMENT_TRANSITION_ACTIONS,
  PAYMENT_TRANSITION_SOURCE_STATUSES,
  type PaymentTransitionAction,
} from '../constants/order-financial';
import { canAccess } from './feature-flags.service';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';
import { transitionPaymentTx } from './payment-transition.service';
import { reverseCreditApplicationTx } from './credit-application-reversal.service';
import { reverseVoucherLinesInTx } from './voucher-line-reversal.service';
import {
  isStoredValueFundingRole,
  unwindStoredValueFundingLine,
} from './voucher-funding-unwind.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';

/** Prisma transaction client shared with nested B10 payment transitions. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const ALREADY_UNWOUND_PAYMENT_STATUSES = new Set<string>([
  'REVERSED',
  'VOIDED',
  'CANCELLED',
]);

const COMPLETED_PAYMENT_STATUSES = new Set<string>(PAYMENT_TRANSITION_SOURCE_STATUSES.REVERSE);
const VOIDABLE_PAYMENT_STATUSES = new Set<string>(PAYMENT_TRANSITION_SOURCE_STATUSES.VOID);

/**
 * Result of a voucher reversal.
 */
export interface ReversalResult {
  reversalVoucherId: string;
  reversalVoucherNo: string;
  /** REVERSED, or PARTIALLY_REVERSED when only some lines were reversed. */
  originalStatus?: string;
}

/**
 * Reverse a POSTED (or partially reversed) voucher — every remaining line, or
 * only `opts.lineIds`. The reversal voucher and its mirror lines are built by
 * {@link reverseVoucherLinesInTx} (cash mirrors land in the drawer window that
 * is current NOW, never in a closed session). When `order_fin_voucher_unwind`
 * is ON, the operational effects are unwound per line role inside the same
 * transaction (B13).
 * @param tenantOrgId tenant that owns the voucher
 * @param voucherId posted voucher to reverse
 * @param reason mandatory operator reason persisted on the reversal voucher
 * @param userId actor who confirmed the reverse
 * @param opts optional line selection and a replacement drawer for cash mirrors
 */
export async function reverseBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  reason: string,
  userId: string,
  opts: { lineIds?: string[]; cashDrawerId?: string | null } = {},
): Promise<ReversalResult> {
  // Flag resolution uses HQ RPC (separate connection). Resolve before the
  // voucher row lock so we never hold FOR UPDATE across a network round-trip.
  const unwindEnabled = await canAccess(tenantOrgId, 'order_fin_voucher_unwind');

  return withTenantContext(tenantOrgId, async () => {
    return prisma.$transaction(async (tx) => {
      const result = await reverseVoucherLinesInTx(tx, {
        tenantOrgId,
        voucherId,
        reason,
        userId,
        lineIds: opts.lineIds,
        cashDrawerId: opts.cashDrawerId,
      });

      const ordersToRecalc = new Set<string>();
      if (unwindEnabled) {
        const now = new Date();
        for (const pair of result.pairs) {
          const role = normalizeVoucherLineRole(pair.originalLineRole);
          let unwound = false;
          if (role === LINE_ROLE.ORDER_PAYMENT) {
            await unwindOrderPaymentLine(tx, {
              tenantOrgId,
              originalLineId: pair.originalLineId,
              reversalVoucherId: result.reversalVoucherId,
              reason,
              userId,
              // Same session the mirror voucher line landed in (computed once
              // by the gate) — never re-resolved independently.
              reversalSessionId: pair.reversalSessionId,
            });
            unwound = true;
            if (pair.originalOrderId) ordersToRecalc.add(pair.originalOrderId);
          } else if (role === LINE_ROLE.ORDER_CREDIT_APPLICATION) {
            await unwindOrderCreditApplicationLine(tx, {
              tenantOrgId,
              originalLineId: pair.originalLineId,
              reversalVoucherId: result.reversalVoucherId,
              reason,
              userId,
              lineOrderId: pair.originalOrderId,
              lineCustomerId: pair.originalCustomerId,
            });
            unwound = true;
            if (pair.originalOrderId) ordersToRecalc.add(pair.originalOrderId);
          } else if (isStoredValueFundingRole(pair.originalLineRole)) {
            await unwindStoredValueFundingLine(tx, {
              tenantOrgId,
              originalLineId: pair.originalLineId,
              originalLineRole: pair.originalLineRole,
              reversalVoucherId: result.reversalVoucherId,
              reversalLineId: pair.reversalLineId,
              reason,
              userId,
            });
            unwound = true;
          }
          if (unwound) {
            await tx.org_fin_voucher_trx_lines_dtl.updateMany({
              where: { id: pair.reversalLineId, tenant_org_id: tenantOrgId },
              data: { wiring_status: WIRING_STATUS.WIRED, updated_at: now, updated_by: userId },
            });
          }
        }
      }

      for (const orderId of ordersToRecalc) {
        await recalculateOrderFinancialSnapshotTx(tx, tenantOrgId, orderId, {});
      }

      return {
        reversalVoucherId: result.reversalVoucherId,
        reversalVoucherNo: result.reversalVoucherNo,
        originalStatus: result.originalStatus,
      };
    });
  });
}

/**
 * B13 — restore the credit application wired to this original line (D006).
 */
async function unwindOrderCreditApplicationLine(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reason: string;
    userId: string;
    lineOrderId: string | null;
    lineCustomerId: string | null;
  },
): Promise<void> {
  const { tenantOrgId, originalLineId, reversalVoucherId, reason, userId, lineOrderId, lineCustomerId } = params;

  const app = await tx.org_order_credit_apps_dtl.findFirst({
    where: { tenant_org_id: tenantOrgId, fin_voucher_trx_line_id: originalLineId },
    select: {
      id: true,
      order_id: true,
      credit_type: true,
      credit_source_id: true,
      applied_amount: true,
      currency_code: true,
      application_status: true,
      fin_voucher_trx_line_id: true,
    },
  });

  if (!app) {
    throw new Error('VOUCHER_UNWIND_CREDIT_APP_NOT_FOUND');
  }

  const status = String(app.application_status ?? '').toUpperCase();
  if (
    status === CREDIT_APPLICATION_STATUSES.REVERSED
    || status === CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING
    || status === CREDIT_APPLICATION_STATUSES.CANCELLED
  ) {
    return;
  }

  const warnings: string[] = [];
  await reverseCreditApplicationTx(
    tx,
    {
      tenantId: tenantOrgId,
      orderId: app.order_id || lineOrderId || '',
      userId,
      reason: `Voucher reverse: ${reason}`,
      idempotencyPrefix: `voucher_unwind:${reversalVoucherId}`,
      updatedInfo: `Voucher reverse — credit application restored (${reason})`,
    },
    app,
    lineCustomerId,
    warnings,
  );
}

/**
 * B13 v1 — drive B10 VOID/REVERSE from an ORDER_PAYMENT original line.
 * Payment rows are found via `fin_voucher_trx_line_id` (target_id on the line
 * is the order, not the payment).
 *
 * CLF: the compensating cash movement's session is `reversalSessionId` — the
 * SAME session the gate already chose for the mirror voucher line, computed
 * once in {@link reverseVoucherLinesInTx}. This function never re-resolves a
 * session on its own, so the voucher line and the old movement row (kept
 * until the R2 reader switch, W13) can never disagree about where the cash
 * landed. `null` means the gate placed the cash in the next window (no
 * session open) — the old movement path still requires an open session, so
 * REVERSE is refused in that case exactly as it was before CLF.
 */
async function unwindOrderPaymentLine(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reason: string;
    userId: string;
    reversalSessionId: string | null;
  },
): Promise<void> {
  const { tenantOrgId, originalLineId, reversalVoucherId, reason, userId, reversalSessionId } = params;

  const payment = await tx.org_order_payments_dtl.findFirst({
    where: { tenant_org_id: tenantOrgId, fin_voucher_trx_line_id: originalLineId },
    select: {
      id: true,
      order_id: true,
      payment_status: true,
      payment_method_code: true,
    },
  });

  if (!payment) {
    throw new Error('VOUCHER_UNWIND_PAYMENT_NOT_FOUND');
  }

  const status = String(payment.payment_status ?? '').toUpperCase();
  if (ALREADY_UNWOUND_PAYMENT_STATUSES.has(status)) {
    return;
  }

  let action: PaymentTransitionAction;
  if (COMPLETED_PAYMENT_STATUSES.has(status)) {
    action = PAYMENT_TRANSITION_ACTIONS.REVERSE;
  } else if (VOIDABLE_PAYMENT_STATUSES.has(status)) {
    action = PAYMENT_TRANSITION_ACTIONS.VOID;
  } else {
    throw new Error(`VOUCHER_UNWIND_UNSUPPORTED_PAYMENT_STATUS:${status}`);
  }

  let cashDrawerSessionId: string | undefined;
  if (action === PAYMENT_TRANSITION_ACTIONS.REVERSE && isCashFamilyMethod(payment.payment_method_code)) {
    if (!reversalSessionId) {
      throw new Error('VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED');
    }
    cashDrawerSessionId = reversalSessionId;
  }

  // Joins the caller's transaction — see transitionPaymentCoreTx: the voucher
  // reversal and its payment unwind must commit or roll back together, not
  // as two independent transactions.
  await transitionPaymentTx(
    {
      tenantId: tenantOrgId,
      orderId: payment.order_id,
      paymentId: payment.id,
      actorId: userId,
      action,
      reason: `Voucher reverse: ${reason}`,
      idempotencyKey: `voucher_unwind:${reversalVoucherId}:${originalLineId}`,
      cashDrawerSessionId,
    },
    tx,
  );
}
