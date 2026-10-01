import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { CASH_DRAWER_SESSION_STATUSES, DRAWER_CASH_IN_OUT_ROLES } from '@/lib/constants/cash-drawer';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * TEMPORARY legacy mirror for the drawer "Cash in / Cash out" dialog (CLF
 * W11, §4B.2a-A) — delete in CLF R3 together with the other mirror handlers
 * (plan §4B.5 W13).
 *
 * The gate (W1) already recognises every cash-method voucher line in the new
 * ledger regardless of role; this handler only keeps the *old* drawer-close
 * screens (which still sum `org_cash_drawer_movements_dtl` directly for an
 * OPEN session — see `deriveExpectedCashAndVariance`) showing these amounts
 * until the R2 reader switch. Writes one row for `line.amount` in the line's
 * own direction; no change/rounding row applies to this dialog.
 *
 * Idempotency: sparse unique index uq_cd_mov_vch_line on
 * fin_voucher_trx_line_id (migration 0303).
 */

const HANDLED_ROLES: readonly string[] = [
  ...DRAWER_CASH_IN_OUT_ROLES.OUT,
  ...DRAWER_CASH_IN_OUT_ROLES.IN,
];

/** line_role → legacy sys_cash_drawer_movement_type_cd code (no new migration; reuses existing seeded codes). */
const MOVEMENT_TYPE_BY_ROLE: Record<string, string> = {
  [LINE_ROLE.CASH_PAY_IN]:       'CASH_IN',
  [LINE_ROLE.PETTY_CASH_RETURN]: 'PETTY_CASH',
  [LINE_ROLE.PETTY_CASH_ISSUE]:  'PETTY_CASH',
  [LINE_ROLE.EXPENSE_PAYMENT]:   'CASH_OUT',
  [LINE_ROLE.SUPPLIER_PAYMENT]:  'CASH_OUT',
};

export const cashMovementCashDrawerWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      HANDLED_ROLES.includes(line.line_role) &&
      (line.direction === 'IN' || line.direction === 'OUT') &&
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
        movement_type: MOVEMENT_TYPE_BY_ROLE[line.line_role] ?? 'ADJUSTMENT',
        direction: line.direction!,
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
