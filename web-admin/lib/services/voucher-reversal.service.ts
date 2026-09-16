/**
 * BVM Voucher Reversal Service
 * Creates a full reversal voucher (POSTED → REVERSED) or a partial line reversal.
 * Original lines are never deleted — a mirror reversal voucher is created instead.
 * Writes to existing org_fin_voucher_audit_log and org_domain_events_outbox.
 *
 * B13: when `order_fin_voucher_unwind` is ON, ORDER_PAYMENT lines also drive
 * B10 VOID/REVERSE so the reversal is operational, not paperwork. Other line
 * roles stay document-only until their reverse handlers ship.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { LINE_ROLE, VOUCHER_STATUS, WIRING_STATUS } from '../constants/voucher';
import {
  PAYMENT_TRANSITION_ACTIONS,
  PAYMENT_TRANSITION_SOURCE_STATUSES,
  type PaymentTransitionAction,
} from '../constants/order-financial';
import { validateStatusTransition } from './voucher-validation.service';
import { generateBizVoucherNo } from './voucher-number.service';
import { canAccess } from './feature-flags.service';
import { isCashFamilyMethod } from './cash-drawer-cash-facts';
import { transitionPaymentTx } from './payment-transition.service';
import type { VoucherType } from '../types/voucher';

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
 *
 */
export interface ReversalResult {
  reversalVoucherId: string;
  reversalVoucherNo: string;
}

/**
 * Reverse a fully POSTED voucher.
 * Creates a mirror reversal voucher with opposite-direction lines.
 * Sets original voucher_status = REVERSED.
 * @param tenantOrgId tenant that owns the voucher — all Prisma work stays in this tenant via RLS context
 * @param voucherId posted voucher to reverse
 * @param reason mandatory operator reason persisted on the reversal voucher
 * @param userId actor who confirmed the reverse
 */
export async function reverseBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  reason: string,
  userId: string
): Promise<ReversalResult> {
  // Flag resolution uses HQ RPC (separate connection). Resolve before the
  // voucher row lock so we never hold FOR UPDATE across a network round-trip.
  const unwindEnabled = await canAccess(tenantOrgId, 'order_fin_voucher_unwind');

  return withTenantContext(tenantOrgId, async () => {
    return prisma.$transaction(async (tx) => {
      const db = tx as typeof prisma;

      // Lock original voucher
      const originals = await db.$queryRaw<Array<{
        id: string;
        voucher_no: string;
        voucher_type: string;
        voucher_category: string;
        voucher_status: string;
        total_amount: string;
        currency_code: string | null;
        branch_id: string | null;
      }>>`
        SELECT id, voucher_no, voucher_type, voucher_category, voucher_status, total_amount,
               currency_code, branch_id
        FROM org_fin_vouchers_mst
        WHERE id = ${voucherId}::uuid
          AND tenant_org_id = ${tenantOrgId}::uuid
        FOR UPDATE
      `;

      const original = originals[0];
      if (!original) throw new Error(`Voucher ${voucherId} not found`);

      validateStatusTransition(original.voucher_status as never, VOUCHER_STATUS.REVERSED);

      // Load original posted lines
      const originalLines = await db.org_fin_voucher_trx_lines_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, line_status: 'POSTED', is_active: true },
      });

      if (originalLines.length === 0) {
        throw new Error('No POSTED lines found to reverse');
      }

      const now = new Date();
      const reversalVoucherNo = await generateBizVoucherNo(
        tenantOrgId,
        original.voucher_type as VoucherType,
        tx
      );

      // Derive category from original — preserve the original's category on reversal
      const reversalCategory = original.voucher_category ?? 'NON_CASH';

      // Create reversal voucher header
      const reversalVoucher = await db.org_fin_vouchers_mst.create({
        data: {
          tenant_org_id:    tenantOrgId,
          branch_id:        original.branch_id,
          voucher_no:       reversalVoucherNo,
          voucher_category: reversalCategory,
          voucher_type:     original.voucher_type,
          voucher_status:   VOUCHER_STATUS.POSTED,
          posting_status:   'NOT_POSTED',
          total_amount:     Number(original.total_amount),
          currency_code:    original.currency_code,
          reversal_reason:  reason,
          posted_at:        now,
          posted_by:        userId,
          description:      `Reversal of ${original.voucher_no}: ${reason}`,
          created_by:       userId,
        },
        select: { id: true, voucher_no: true },
      });

      // Create mirror lines with opposite direction + link back to original lines
      let lineNo = 1;
      for (const line of originalLines) {
        const oppositeDirection = line.direction === 'IN' ? 'OUT'
          : line.direction === 'OUT' ? 'IN'
          : 'NEUTRAL';

        const reversalLine = await db.org_fin_voucher_trx_lines_dtl.create({
          data: {
            tenant_org_id:   tenantOrgId,
            voucher_id:      reversalVoucher.id,
            line_no:         lineNo++,
            line_type:       line.line_type,
            line_role:       line.line_role,
            target_type:     line.target_type,
            target_id:       line.target_id,
            order_id:        line.order_id,
            customer_id:     line.customer_id,
            payment_method_code: line.payment_method_code,
            amount:          Number(line.amount),
            currency_code:   line.currency_code,
            direction:       oppositeDirection,
            description:     `Reversal of line ${line.line_no}`,
            line_status:     'POSTED',
            wiring_status:   WIRING_STATUS.NOT_WIRED,
            reversed_line_id: line.id,
            created_by:      userId,
          },
          select: { id: true },
        });

        if (unwindEnabled && line.line_role === LINE_ROLE.ORDER_PAYMENT) {
          await unwindOrderPaymentLine(tx, {
            tenantOrgId,
            originalLineId: line.id,
            reversalVoucherId: reversalVoucher.id,
            reason,
            userId,
          });
          await db.org_fin_voucher_trx_lines_dtl.updateMany({
            where: { id: reversalLine.id, tenant_org_id: tenantOrgId },
            data: { wiring_status: WIRING_STATUS.WIRED, updated_at: now, updated_by: userId },
          });
        }

        // Mark original line as REVERSED
        await db.org_fin_voucher_trx_lines_dtl.updateMany({
          where: { id: line.id, tenant_org_id: tenantOrgId },
          data: { line_status: 'REVERSED', updated_at: now, updated_by: userId },
        });
      }

      // Mark original voucher as REVERSED
      // B8 fix (RESUME doc 2026-05-28): sync legacy `status` to 'voided' on the
      // REVERSED transition. posting_status stays at its previous value
      // ('POSTED') because the wiring effect WAS posted to downstream — what
      // changed is the business state, not the posting/wiring history. The
      // CHECK constraint chk_fin_posting_status has no 'REVERSED' value.
      await db.org_fin_vouchers_mst.updateMany({
        where: { id: voucherId, tenant_org_id: tenantOrgId },
        data: {
          voucher_status:  VOUCHER_STATUS.REVERSED,
          reversed_at:     now,
          reversed_by:     userId,
          reversal_reason: reason,
          updated_at:      now,
          updated_by:      userId,
        },
      });

      // Write audit log for original
      await db.org_fin_voucher_audit_log.create({
        data: {
          voucher_id:         voucherId,
          tenant_org_id:      tenantOrgId,
          action:             'REVERSED',
          changed_by:         userId,
          changed_at:         now,
          snapshot_or_reason: JSON.stringify({
            voucher_status:       VOUCHER_STATUS.REVERSED,
            reversal_voucher_id:  reversalVoucher.id,
            reversal_voucher_no:  reversalVoucherNo,
            unwind_enabled:       unwindEnabled,
            reason,
          }),
        },
      });

      // Write domain event
      await db.org_domain_events_outbox.create({
        data: {
          tenant_org_id:  tenantOrgId,
          event_type:     'VOUCHER_REVERSED',
          aggregate_type: 'fin_voucher',
          aggregate_id:   voucherId,
          payload: {
            original_voucher_id: voucherId,
            reversal_voucher_id: reversalVoucher.id,
            reversal_voucher_no: reversalVoucherNo,
            unwind_enabled: unwindEnabled,
            reason,
            reversed_by: userId,
            reversed_at: now.toISOString(),
          },
        },
      });

      return {
        reversalVoucherId: reversalVoucher.id,
        reversalVoucherNo,
      };
    });
  });
}

/**
 * B13 v1 — drive B10 VOID/REVERSE from an ORDER_PAYMENT original line.
 * Payment rows are found via `fin_voucher_trx_line_id` (target_id on the line
 * is the order, not the payment). Nested `transitionPaymentTx` uses a Prisma
 * savepoint so voucher + payment stay one atomic unit.
 */
async function unwindOrderPaymentLine(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const { tenantOrgId, originalLineId, reversalVoucherId, reason, userId } = params;

  const payment = await tx.org_order_payments_dtl.findFirst({
    where: { tenant_org_id: tenantOrgId, fin_voucher_trx_line_id: originalLineId },
    select: {
      id: true,
      order_id: true,
      payment_status: true,
      payment_method_code: true,
      cash_drawer_session_id: true,
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
    const openSessionId = await resolveOpenDrawerSessionId(tx, tenantOrgId, payment.cash_drawer_session_id);
    if (!openSessionId) {
      throw new Error('VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED');
    }
    cashDrawerSessionId = openSessionId;
  }

  await transitionPaymentTx({
    tenantId: tenantOrgId,
    orderId: payment.order_id,
    paymentId: payment.id,
    actorId: userId,
    action,
    reason: `Voucher reverse: ${reason}`,
    idempotencyKey: `voucher_unwind:${reversalVoucherId}:${originalLineId}`,
    cashDrawerSessionId,
  });
}

/**
 * Prefer the original session when it is still OPEN; otherwise the current
 * OPEN session on the same drawer. Never pick a different drawer.
 */
async function resolveOpenDrawerSessionId(
  tx: PrismaTransactionClient,
  tenantOrgId: string,
  originalSessionId: string | null,
): Promise<string | null> {
  if (!originalSessionId) return null;

  const original = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: originalSessionId, tenant_org_id: tenantOrgId },
    select: { id: true, status: true, cash_drawer_id: true },
  });
  if (!original) return null;
  if (original.status === 'OPEN') return original.id;

  const open = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: {
      tenant_org_id: tenantOrgId,
      cash_drawer_id: original.cash_drawer_id,
      status: 'OPEN',
      is_active: true,
    },
    select: { id: true },
  });
  return open?.id ?? null;
}
