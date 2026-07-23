import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE, WIRING_STATUS } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';
import { resolvePaymentStatus } from './order-payment-wiring.handler';

/**
 * Handles cash drawer movement creation for CASH order payments.
 *
 * Runs AFTER orderPaymentWiringHandler — reads line.order_payment_id
 * which is set in-memory by the order payment handler within the same
 * transaction loop. Handler registry order enforces this.
 *
 * Uses line.amount (the tendered sale amount), NOT tendered_amount
 * (which includes change). PRD §11.4.
 *
 * Idempotency: sparse unique index uq_cd_mov_vch_line on
 * fin_voucher_trx_line_id prevents double-wiring at the DB level.
 *
 * B32 status gate: a movement is only created for an effective-COMPLETED
 * leg. `WIRING_HANDLERS.filter(h => h.canHandle(line))` runs once per line
 * BEFORE any handler's `wire()` executes (voucher-wiring.service.ts), so
 * gating on the resolved status here — via the same `resolvePaymentStatus`
 * order-payment-wiring.handler uses — is what closes M8's gap: a
 * drawer-required method configured to create PENDING (D9 override) must
 * not record cash-in while the money hasn't actually cleared. When such a
 * leg later transitions PENDING/PROCESSING -> COMPLETED via the B30
 * back-office VERIFY action, `payment-transition.service.ts` creates the
 * deferred movement at that point instead.
 */
export const cashDrawerWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      line.line_role === LINE_ROLE.ORDER_PAYMENT &&
      line.direction === 'IN' &&
      line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CASH &&
      line.cash_drawer_session_id != null &&
      resolvePaymentStatus(line) === 'COMPLETED'
    );
  },

  async validate(line: VoucherLineForWiring, tx?: Prisma.TransactionClient): Promise<void> {
    if (!line.cash_drawer_session_id) {
      throw new Error(`CASH_DRAWER line ${line.id} (line_no ${line.line_no}) is missing cash_drawer_session_id`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    // Fetch the session to get cash_drawer_id and branch_id
    const session = await tx.org_cash_drawer_sessions_mst.findFirst({
      where: {
        id:           line.cash_drawer_session_id!,
        tenant_org_id: tenantOrgId,
        status:       'OPEN',
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
        movement_type:           'CASH_SALE',
        direction:               'IN',
        // line.amount is the settled payment amount; tendered_amount includes change
        amount:                  line.amount,
        currency_code:           line.currency_code ?? session.currency_code,
        order_id:                line.order_id ?? null,
        // FK to the order payment row created by orderPaymentWiringHandler
        order_payment_id:        line.order_payment_id ?? null,
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

    const changeReturned =
      line.change_returned_amount != null ? Number(line.change_returned_amount) : 0;
    if (changeReturned > 0.001) {
      // Change-out rows link only fin_voucher_id (not fin_voucher_trx_line_id) because
      // the drawer movement unique index is scoped per voucher line and CASH_OUT is
      // a separate physical movement from the tendered CASH_IN leg.
      await tx.org_cash_drawer_movements_dtl.create({
        data: {
          tenant_org_id:          tenantOrgId,
          branch_id:              session.branch_id,
          cash_drawer_id:         session.cash_drawer_id,
          cash_drawer_session_id: line.cash_drawer_session_id!,
          movement_type:          'CASH_OUT',
          direction:              'OUT',
          amount:                 changeReturned,
          currency_code:          line.currency_code ?? session.currency_code,
          order_id:               line.order_id ?? null,
          order_payment_id:       line.order_payment_id ?? null,
          fin_voucher_id:         voucherId,
          performed_by:           userId,
          performed_at:           now,
          is_active:              true,
          rec_status:             1,
          created_by:             userId,
        },
      });
    }

    // Write cash_drawer_mvt_id back to the voucher line
    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: line.id, tenant_org_id: tenantOrgId },
      data:  { cash_drawer_mvt_id: created.id, updated_at: now, updated_by: userId },
    });

    // Mutate in-memory so subsequent handlers can read it
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
