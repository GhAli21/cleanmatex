import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * TEMPORARY legacy mirror for customer account receipts (CLF W6) — delete in
 * CLF R3 together with the other three mirror handlers (plan §4B.5 W13).
 *
 * Before W6 the receipt service wrote `org_cash_drawer_movements_dtl` directly.
 * W6 moved the cash into the drawer ledger through the gate; until the R2
 * reader switch, the old drawer-close screens still read the movements table,
 * so this handler keeps them showing receipt cash.
 *
 * Fires only for a CASH `CUSTOMER_CREDIT_RECEIPT` IN line the gate attached to
 * a session (the gate clears `cash_drawer_session_id` for any line it did not
 * put in a drawer). Writes ONE net IN row for `line.amount` and no change row:
 * receipt rows carry no order_payment_id, so the legacy expected-cash formula
 * counts them directly and a change OUT would subtract the change twice.
 *
 * Idempotency: sparse unique index uq_cd_mov_vch_line on
 * fin_voucher_trx_line_id (migration 0303).
 */
export const customerReceiptCashDrawerWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      line.line_role === LINE_ROLE.CUSTOMER_CREDIT_RECEIPT &&
      line.direction === 'IN' &&
      line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CASH &&
      line.cash_drawer_session_id != null
    );
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.cash_drawer_session_id) {
      throw new Error(`${line.line_role} line ${line.id} (line_no ${line.line_no}) is missing cash_drawer_session_id`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const session = await tx.org_cash_drawer_sessions_mst.findFirst({
      where: {
        id: line.cash_drawer_session_id!,
        tenant_org_id: tenantOrgId,
        status: CASH_DRAWER_SESSION_STATUSES.OPEN,
      },
      select: { id: true, cash_drawer_id: true, branch_id: true, currency_code: true },
    });
    if (!session) {
      throw new Error(
        `Cash drawer session ${line.cash_drawer_session_id} not found or not OPEN for tenant ${tenantOrgId}`
      );
    }

    const now = new Date();
    const created = await tx.org_cash_drawer_movements_dtl.create({
      data: {
        tenant_org_id: tenantOrgId,
        branch_id: session.branch_id ?? line.branch_id ?? null,
        cash_drawer_id: session.cash_drawer_id,
        cash_drawer_session_id: session.id,
        movement_type: 'CASH_SALE',
        direction: 'IN',
        amount: line.amount,
        currency_code: line.currency_code ?? session.currency_code,
        fin_voucher_id: voucherId,
        fin_voucher_trx_line_id: line.id,
        performed_by: userId,
        performed_at: now,
        is_active: true,
        rec_status: 1,
        created_by: userId,
      },
      select: { id: true },
    });

    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: line.id, tenant_org_id: tenantOrgId },
      data: { cash_drawer_mvt_id: created.id, updated_at: now, updated_by: userId },
    });
    line.cash_drawer_mvt_id = created.id;

    return created.id;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_cash_drawer_movements_dtl.findFirst({
      where: { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true, amount: true, currency_code: true },
    });
    if (!row) return null;
    return {
      effectType: 'CASH_DRAWER_MOVEMENT',
      effectId: row.id,
      tableRef: 'org_cash_drawer_movements_dtl',
      amount: row.amount,
      currency_code: row.currency_code,
    };
  },
};
