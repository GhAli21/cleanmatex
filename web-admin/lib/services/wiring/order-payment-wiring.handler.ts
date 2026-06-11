import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE, WIRING_STATUS } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * Resolves payment_status from the voucher line, falling back to payment_method_code.
 * submit-order writes the planner's resolved status onto the voucher line so
 * wiringMode does not lose explicit PENDING card/check/bank statuses.
 * CASH and CARD are immediately COMPLETED.
 * Bank transfers, checks, and gateway payments start PENDING.
 */
function resolvePaymentStatus(line: VoucherLineForWiring): string {
  if (line.payment_status) return line.payment_status;
  const paymentMethodCode = line.payment_method_code;
  if (!paymentMethodCode) return 'PENDING';
  const code = paymentMethodCode.toUpperCase();
  if (code === PAYMENT_METHODS.CASH || code === PAYMENT_METHODS.CARD) return 'COMPLETED';
  if (code === PAYMENT_METHODS.HYPERPAY || code === PAYMENT_METHODS.PAYTABS || code === PAYMENT_METHODS.STRIPE) return 'PENDING';
  if (code === PAYMENT_METHODS.BANK_TRANSFER || code === PAYMENT_METHODS.CHECK) return 'PENDING';
  if (code === PAYMENT_METHODS.MOBILE_PAYMENT) return 'COMPLETED';
  return 'PENDING';
}

/**
 * Handles ORDER_PAYMENT lines (direction=IN).
 * Creates one org_order_payments_dtl row and sets the fin_voucher back-links.
 * Also updates order_payment_id on the line so the cash drawer handler
 * can reference it as a FK.
 *
 * Idempotency: sparse unique index uq_ord_pay_vch_line on fin_voucher_trx_line_id
 * in org_order_payments_dtl prevents double-wiring at the DB level.
 */
export const orderPaymentWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return line.line_role === LINE_ROLE.ORDER_PAYMENT && line.direction === 'IN';
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.order_id) {
      throw new Error(`ORDER_PAYMENT line ${line.id} (line_no ${line.line_no}) is missing order_id`);
    }
    if (line.target_type !== 'ORDER' || line.target_id !== line.order_id) {
      throw new Error(
        `ORDER_PAYMENT line ${line.id} (line_no ${line.line_no}) must target ORDER/${line.order_id}`,
      );
    }
    if (!line.payment_method_code) {
      throw new Error(`ORDER_PAYMENT line ${line.id} (line_no ${line.line_no}) is missing payment_method_code`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const paymentStatus = resolvePaymentStatus(line);
    const now = new Date();

    const created = await tx.org_order_payments_dtl.create({
      data: {
        tenant_org_id:           tenantOrgId,
        branch_id:               line.branch_id ?? null,
        order_id:                line.order_id!,
        customer_id:             line.customer_id ?? null,
        payment_method_code:     line.payment_method_code!,
        org_payment_method_id:   line.org_payment_method_id ?? null,
        currency_code:           line.currency_code ?? null,
        payment_nature_snapshot: 'REAL_PAYMENT',
        amount:                  line.amount,
        payment_terminal_id:     line.payment_terminal_id ?? null,
        tendered_amount:         line.tendered_amount ?? null,
        change_returned_amount:  line.change_returned_amount ?? null,
        cash_drawer_session_id:  line.cash_drawer_session_id ?? null,
        gateway_code:            line.gateway_code ?? null,
        gateway_reference:       line.gateway_reference ?? null,
        bank_reference:          line.bank_reference ?? null,
        check_no:                line.check_number ?? null,
        card_brand_code:         line.card_brand_code ?? null,
        card_last4:              line.card_last4 ?? null,
        payment_status:          paymentStatus,
        paid_at:                 paymentStatus === 'COMPLETED' ? now : null,
        fin_voucher_id:          voucherId,
        fin_voucher_trx_line_id: line.id,
        is_active:               true,
        rec_status:              1,
        received_by:             userId,
        created_by:              userId,
      },
      select: { id: true },
    });

    // Write order_payment_id back to the voucher line so the cash drawer handler
    // can use it as a FK reference (must happen within this transaction).
    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: line.id, tenant_org_id: tenantOrgId },
      data:  { order_payment_id: created.id, updated_at: now, updated_by: userId },
    });

    // Mutate in-memory so subsequent handlers in the same loop iteration see it
    line.order_payment_id = created.id;

    return created.id;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_order_payments_dtl.findFirst({
      where: { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true, amount: true, currency_code: true },
    });
    if (!row) return null;
    return {
      effectType: 'ORDER_PAYMENT',
      effectId:   row.id,
      tableRef:   'org_order_payments_dtl',
      amount:     row.amount,
      currency_code: row.currency_code,
    };
  },
};
