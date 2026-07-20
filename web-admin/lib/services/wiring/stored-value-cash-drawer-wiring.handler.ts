import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

const FUNDING_LINE_ROLES = new Set<string>([
  LINE_ROLE.GIFT_CARD_SALE,
  LINE_ROLE.WALLET_TOPUP,
  LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
]);

/**
 * Handles cash drawer movement creation for CASH stored-value funding legs
 * (B3). Mirrors cash-drawer-wiring.handler.ts's movement-creation body but is
 * kept as a **separate** handler rather than broadening the order-scoped one
 * — that handler's comments/shape are order-specific, and linking
 * funding_tender_id (not order_id/order_payment_id) is cleaner as its own
 * focused handler (see B03 "Architecture decision" §3).
 *
 * Runs AFTER storedValueFundingWiringHandler — reads line.sv_funding_tender_id
 * which is set in-memory by that handler within the same transaction loop.
 * Handler registry order (voucher-wiring.service.ts) enforces this.
 *
 * Uses line.amount (the tendered funding amount), not tendered_amount (which
 * includes change) — same convention cashDrawerWiringHandler uses.
 *
 * movement_type SV_FUNDING_TENDER (migration 0412) was verified against
 * B16/B35's unified expected-cash formula: the movement term only excludes
 * rows where order_payment_id IS NOT NULL (sale-mirror movements already
 * counted via the order-payment-ledger term). A row created here always has
 * order_payment_id = NULL, so it is picked up correctly with no change
 * needed to the drawer-close code.
 *
 * Idempotency: the existing sparse unique index uq_cd_mov_vch_line on
 * fin_voucher_trx_line_id (migration 0303) already covers rows created here
 * — it is keyed on the voucher line, not the order-payment role.
 */
export const storedValueCashDrawerWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      FUNDING_LINE_ROLES.has(line.line_role) &&
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
        status: 'OPEN',
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
        branch_id: session.branch_id,
        cash_drawer_id: session.cash_drawer_id,
        cash_drawer_session_id: line.cash_drawer_session_id!,
        movement_type: 'SV_FUNDING_TENDER',
        direction: 'IN',
        amount: line.amount,
        currency_code: line.currency_code ?? session.currency_code,
        fin_voucher_id: voucherId,
        fin_voucher_trx_line_id: line.id,
        funding_tender_id: line.sv_funding_tender_id ?? null,
        performed_by: userId,
        performed_at: now,
        is_active: true,
        rec_status: 1,
        created_by: userId,
      },
      select: { id: true },
    });

    const changeReturned =
      line.change_returned_amount != null ? Number(line.change_returned_amount) : 0;
    if (changeReturned > 0.001) {
      // Change-out rows link only fin_voucher_id (not fin_voucher_trx_line_id)
      // — same convention as cashDrawerWiringHandler's change-return branch;
      // the drawer movement unique index is scoped per voucher line and
      // CASH_OUT is a separate physical movement from the tendered CASH_IN leg.
      await tx.org_cash_drawer_movements_dtl.create({
        data: {
          tenant_org_id: tenantOrgId,
          branch_id: session.branch_id,
          cash_drawer_id: session.cash_drawer_id,
          cash_drawer_session_id: line.cash_drawer_session_id!,
          movement_type: 'CASH_OUT',
          direction: 'OUT',
          amount: changeReturned,
          currency_code: line.currency_code ?? session.currency_code,
          fin_voucher_id: voucherId,
          funding_tender_id: line.sv_funding_tender_id ?? null,
          performed_by: userId,
          performed_at: now,
          is_active: true,
          rec_status: 1,
          created_by: userId,
        },
      });
    }

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
