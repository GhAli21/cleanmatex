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
import { LINE_ROLE, VOUCHER_STATUS, WIRING_STATUS, normalizeVoucherLineRole } from '../constants/voucher';
import {
  CREDIT_APPLICATION_STATUSES,
  PAYMENT_TRANSITION_ACTIONS,
  PAYMENT_TRANSITION_SOURCE_STATUSES,
  type PaymentTransitionAction,
} from '../constants/order-financial';
import { validateStatusTransition } from './voucher-validation.service';
import { generateBizVoucherNo } from './voucher-number.service';
import { canAccess } from './feature-flags.service';
import { isCashFamilyMethod } from './cash-drawer-cash-facts';
import { transitionPaymentTx } from './payment-transition.service';
import { reverseCreditApplicationTx } from './credit-application-reversal.service';
import {
  isStoredValueFundingRole,
  unwindStoredValueFundingLine,
} from './voucher-funding-unwind.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import type { VoucherType } from '../types/voucher';

/** Prisma transaction client shared with nested B10 payment transitions. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type CustomerPartyRow = {
  display_name: string | null;
  name: string | null;
  name2: string | null;
  first_name: string | null;
  last_name: string | null;
};

/**
 * Header party_name for a reverse when the source voucher never stored one.
 */
function customerPartyName(row: CustomerPartyRow | null): string | null {
  if (!row) return null;
  const fromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const value = (row.display_name ?? row.name ?? row.name2 ?? fromParts).trim();
  return value.length > 0 ? value : null;
}

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
        voucher_subtype: string | null;
        voucher_status: string;
        total_amount: string;
        subtotal_amount: string | null;
        discount_amount: string | null;
        tax_amount: string | null;
        fee_amount: string | null;
        paid_amount: string | null;
        refunded_amount: string | null;
        outstanding_amount: string | null;
        currency_code: string | null;
        currency_ex_rate: string | null;
        branch_id: string | null;
        direction: string | null;
        party_type: string | null;
        party_name: string | null;
        supplier_id: string | null;
        employee_id: string | null;
        customer_id: string | null;
        order_id: string | null;
        invoice_id: string | null;
        source_module: string | null;
        source_ref_type: string | null;
        source_ref_id: string | null;
        reason_code: string | null;
        notes: string | null;
        description: string | null;
      }>>`
        SELECT id, voucher_no, voucher_type, voucher_category, voucher_subtype, voucher_status,
               total_amount, subtotal_amount, discount_amount, tax_amount,
               fee_amount, paid_amount, refunded_amount, outstanding_amount, currency_code,
               currency_ex_rate, branch_id, direction, party_type, party_name, supplier_id,
               employee_id, customer_id, order_id, invoice_id, source_module, source_ref_type,
               source_ref_id, reason_code, notes, description
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

      const reversalCategory = original.voucher_category ?? 'NON_CASH';
      const originalNotes = original.notes?.trim() || null;
      let partyName = original.party_name?.trim() || null;
      if (!partyName && original.customer_id) {
        const customer = await db.org_customers_mst.findFirst({
          where: { id: original.customer_id, tenant_org_id: tenantOrgId },
          select: {
            display_name: true,
            name: true,
            name2: true,
            first_name: true,
            last_name: true,
          },
        });
        partyName = customerPartyName(customer);
      }

      // Create reversal voucher header — copy operational facts from the source
      // so list/detail are not blank. Date/datetime are the reverse moment.
      // ref_voucher_id points at the voucher this row was created because of.
      const reversalVoucher = await db.org_fin_vouchers_mst.create({
        data: {
          tenant_org_id:    tenantOrgId,
          branch_id:        original.branch_id,
          voucher_no:       reversalVoucherNo,
          voucher_category: reversalCategory,
          voucher_subtype:  original.voucher_subtype,
          voucher_type:     original.voucher_type,
          voucher_status:   VOUCHER_STATUS.POSTED,
          posting_status:   'POSTED',
          direction:        original.direction,
          party_type:       original.party_type,
          party_name:       partyName,
          supplier_id:      original.supplier_id,
          employee_id:      original.employee_id,
          customer_id:      original.customer_id,
          order_id:         original.order_id,
          invoice_id:       original.invoice_id,
          source_module:    original.source_module,
          source_ref_type:  original.source_ref_type,
          source_ref_id:    original.source_ref_id,
          reason_code:      original.reason_code,
          total_amount:     Number(original.total_amount),
          subtotal_amount:  original.subtotal_amount != null ? Number(original.subtotal_amount) : null,
          discount_amount:  original.discount_amount != null ? Number(original.discount_amount) : null,
          tax_amount:       original.tax_amount != null ? Number(original.tax_amount) : null,
          fee_amount:       original.fee_amount != null ? Number(original.fee_amount) : null,
          paid_amount:      original.paid_amount != null ? Number(original.paid_amount) : Number(original.total_amount),
          refunded_amount:  original.refunded_amount != null ? Number(original.refunded_amount) : null,
          outstanding_amount: 0,
          currency_code:    original.currency_code,
          currency_ex_rate: original.currency_ex_rate != null ? Number(original.currency_ex_rate) : null,
          voucher_date:     now,
          voucher_datetime: now,
          issued_at:        now,
          ref_voucher_id:   original.id,
          reversal_reason:  reason,
          posted_at:        now,
          posted_by:        userId,
          description:      `Reversal of ${original.voucher_no}: ${reason}`,
          notes:            originalNotes,
          created_by:       userId,
        },
        select: { id: true, voucher_no: true },
      });

      // Create mirror lines with opposite direction + link back to original lines
      let lineNo = 1;
      const ordersToRecalc = new Set<string>();
      for (const line of originalLines) {
        const oppositeDirection = line.direction === 'IN' ? 'OUT'
          : line.direction === 'OUT' ? 'IN'
          : 'NEUTRAL';

        const originalLineDesc = line.description?.trim() || null;
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
            supplier_id:     line.supplier_id,
            employee_id:     line.employee_id,
            branch_id:       line.branch_id,
            payment_method_code: line.payment_method_code,
            amount:          Number(line.amount),
            currency_code:   line.currency_code,
            currency_ex_rate: line.currency_ex_rate != null ? Number(line.currency_ex_rate) : null,
            direction:       oppositeDirection,
            tendered_amount: line.tendered_amount != null ? Number(line.tendered_amount) : null,
            change_returned_amount: line.change_returned_amount != null ? Number(line.change_returned_amount) : null,
            card_brand_code: line.card_brand_code,
            card_last4:      line.card_last4,
            auth_code:       line.auth_code,
            gateway_code:    line.gateway_code,
            gateway_transaction_id: line.gateway_transaction_id,
            gateway_reference: line.gateway_reference,
            bank_reference:  line.bank_reference,
            check_number:    line.check_number,
            check_bank:      line.check_bank,
            check_date:      line.check_date,
            expense_category_code: line.expense_category_code,
            party_name:      line.party_name ?? partyName,
            description:     originalLineDesc
              ? `Reversal of line ${line.line_no}: ${originalLineDesc}`
              : `Reversal of line ${line.line_no}`,
            notes:           line.notes,
            line_status:     'POSTED',
            payment_status:  line.payment_status,
            wiring_status:   WIRING_STATUS.NOT_WIRED,
            reversed_line_id: line.id,
            cash_drawer_session_id: line.cash_drawer_session_id,
            pos_session_id:  line.pos_session_id,
            credit_application_type: line.credit_application_type,
            org_payment_method_id: line.org_payment_method_id,
            payment_terminal_id: line.payment_terminal_id,
            created_by:      userId,
          },
          select: { id: true },
        });

        if (unwindEnabled) {
          const role = normalizeVoucherLineRole(String(line.line_role ?? ''));
          let unwound = false;
          if (role === LINE_ROLE.ORDER_PAYMENT) {
            await unwindOrderPaymentLine(tx, {
              tenantOrgId,
              originalLineId: line.id,
              reversalVoucherId: reversalVoucher.id,
              reason,
              userId,
            });
            unwound = true;
            if (line.order_id) ordersToRecalc.add(line.order_id);
          } else if (role === LINE_ROLE.ORDER_CREDIT_APPLICATION) {
            await unwindOrderCreditApplicationLine(tx, {
              tenantOrgId,
              originalLineId: line.id,
              reversalVoucherId: reversalVoucher.id,
              reason,
              userId,
              lineOrderId: line.order_id,
              lineCustomerId: line.customer_id,
            });
            unwound = true;
            if (line.order_id) ordersToRecalc.add(line.order_id);
          } else if (isStoredValueFundingRole(String(line.line_role ?? ''))) {
            await unwindStoredValueFundingLine(tx, {
              tenantOrgId,
              originalLineId: line.id,
              originalLineRole: String(line.line_role ?? ''),
              reversalVoucherId: reversalVoucher.id,
              reversalLineId: reversalLine.id,
              reason,
              userId,
            });
            unwound = true;
          }
          if (unwound) {
            await db.org_fin_voucher_trx_lines_dtl.updateMany({
              where: { id: reversalLine.id, tenant_org_id: tenantOrgId },
              data: { wiring_status: WIRING_STATUS.WIRED, updated_at: now, updated_by: userId },
            });
          }
        }

        // Mark original line as REVERSED
        await db.org_fin_voucher_trx_lines_dtl.updateMany({
          where: { id: line.id, tenant_org_id: tenantOrgId },
          data: { line_status: 'REVERSED', updated_at: now, updated_by: userId },
        });
      }

      for (const orderId of ordersToRecalc) {
        await recalculateOrderFinancialSnapshotTx(tx, tenantOrgId, orderId, {});
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
          reversed_by_voucher_id: reversalVoucher.id,
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
