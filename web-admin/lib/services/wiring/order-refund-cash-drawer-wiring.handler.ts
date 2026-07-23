import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE, VOUCHER_DIRECTION } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * B9 — handles cash-drawer OUT movement creation for CASH refund execution.
 *
 * Distinct from `cashDrawerWiringHandler` (which owns ORDER_PAYMENT/IN legs —
 * sale cash-in plus its own change-return CASH_OUT sub-leg): a refund line is
 * a self-contained OUT leg, not a sub-leg of anything, so unlike the
 * change-return row this handler's movement links BOTH `fin_voucher_id` AND
 * `fin_voucher_trx_line_id` — one refund voucher line, one movement, no
 * sparse-unique-index conflict.
 *
 * Idempotency: the sparse unique index `uq_cd_mov_vch_line` on
 * `fin_voucher_trx_line_id` prevents double-wiring at the DB level, same
 * guarantee `cashDrawerWiringHandler` relies on.
 */
export const orderRefundCashDrawerWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      line.line_role === LINE_ROLE.ORDER_REFUND &&
      line.direction === VOUCHER_DIRECTION.OUT &&
      line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CASH &&
      line.cash_drawer_session_id != null
    );
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.cash_drawer_session_id) {
      throw new Error(`ORDER_REFUND line ${line.id} (line_no ${line.line_no}) is missing cash_drawer_session_id`);
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
        id:            line.cash_drawer_session_id!,
        tenant_org_id: tenantOrgId,
        status:        'OPEN',
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
        tenant_org_id:           tenantOrgId,
        branch_id:               session.branch_id,
        cash_drawer_id:          session.cash_drawer_id,
        cash_drawer_session_id:  line.cash_drawer_session_id!,
        movement_type:           'CASH_OUT',
        direction:               'OUT',
        amount:                  line.amount,
        currency_code:           line.currency_code ?? session.currency_code,
        order_id:                line.order_id ?? null,
        fin_voucher_id:          voucherId,
        fin_voucher_trx_line_id: line.id,
        performed_by:            userId,
        performed_at:            now,
        is_active:               true,
        rec_status:              1,
        created_by:              userId,
      },
      select: { id: true },
    });

    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: line.id, tenant_org_id: tenantOrgId },
      data:  { cash_drawer_mvt_id: created.id, updated_at: now, updated_by: userId },
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
      effectType:    'CASH_DRAWER_MOVEMENT',
      effectId:      row.id,
      tableRef:      'org_cash_drawer_movements_dtl',
      amount:        row.amount,
      currency_code: row.currency_code,
    };
  },
};
