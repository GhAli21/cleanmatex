import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { SV_FUNDING_TENDER_STATUS } from '@/lib/constants/order-financial';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';
import { finalizeStoredValueFundingIfReady } from '@/lib/services/stored-value-funding.service';

const FUNDING_LINE_ROLES = new Set<string>([
  LINE_ROLE.GIFT_CARD_SALE,
  LINE_ROLE.WALLET_TOPUP,
  LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
]);

/**
 * Handles GIFT_CARD_SALE / WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT lines
 * (B3 — see stored-value-funding.service.ts). Creates the tender-leg fact
 * row, hands its id to stored-value-cash-drawer-wiring.handler.ts (which
 * runs immediately after, same line, same handler-registry loop — mirrors
 * how order_payment_id is handed to cashDrawerWiringHandler), then calls the
 * idempotent finalizer, which credits the ledger exactly once the running
 * tender total reaches the voucher's total_amount.
 *
 * Idempotency: uq_svft_vch_line (fin_voucher_trx_line_id) prevents a single
 * voucher line from being wired to more than one tender row at the DB level.
 */
export const storedValueFundingWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return FUNDING_LINE_ROLES.has(line.line_role) && line.direction === 'IN';
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.target_type || !line.target_id) {
      throw new Error(`${line.line_role} line ${line.id} (line_no ${line.line_no}) is missing target_type/target_id`);
    }
    if (!line.payment_method_code) {
      throw new Error(`${line.line_role} line ${line.id} (line_no ${line.line_no}) is missing payment_method_code`);
    }
    if (!line.currency_code) {
      throw new Error(`${line.line_role} line ${line.id} (line_no ${line.line_no}) is missing currency_code`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const existing = await tx.org_sv_funding_tenders_dtl.findFirst({
      where: { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true },
    });

    let tenderId: string;
    if (existing) {
      tenderId = existing.id;
    } else {
      const now = new Date();
      const created = await tx.org_sv_funding_tenders_dtl.create({
        data: {
          tenant_org_id: tenantOrgId,
          branch_id: line.branch_id ?? null,
          fin_voucher_id: voucherId,
          fin_voucher_trx_line_id: line.id,
          // Voucher line numbers are unique per voucher — reuse as leg_index
          // rather than maintaining a separate counter.
          leg_index: line.line_no,
          funding_type: line.line_role,
          target_type: line.target_type!,
          target_id: line.target_id!,
          customer_id: line.customer_id ?? null,
          payment_method_code: line.payment_method_code!,
          org_payment_method_id: line.org_payment_method_id ?? null,
          amount: line.amount,
          tendered_amount: line.tendered_amount ?? null,
          change_returned_amount: line.change_returned_amount ?? null,
          currency_code: line.currency_code!,
          status: SV_FUNDING_TENDER_STATUS.COMPLETED,
          payment_status: line.payment_status ?? null,
          cash_drawer_session_id: line.cash_drawer_session_id ?? null,
          pos_session_id: line.pos_session_id ?? null,
          gateway_code: line.gateway_code ?? null,
          gateway_reference: line.gateway_reference ?? null,
          check_number: line.check_number ?? null,
          check_bank: line.check_bank ?? null,
          check_date: line.check_date ?? null,
          idempotency_key: `${line.id}_sv_tender`,
          confirmed_at: now,
          created_by: userId,
        },
        select: { id: true },
      });
      tenderId = created.id;
    }

    // Write sv_funding_tender_id back to the voucher line so the cash-drawer
    // handler can use it as a FK reference (must happen within this transaction).
    const now = new Date();
    await tx.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: line.id, tenant_org_id: tenantOrgId },
      data: { sv_funding_tender_id: tenderId, updated_at: now, updated_by: userId },
    });

    // Mutate in-memory so the cash-drawer handler in the same loop iteration sees it.
    line.sv_funding_tender_id = tenderId;

    await finalizeStoredValueFundingIfReady(tx, tenantOrgId, voucherId, userId, line.id);

    return tenderId;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_sv_funding_tenders_dtl.findFirst({
      where: { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true, amount: true, currency_code: true },
    });
    if (!row) return null;
    return {
      effectType: 'STORED_VALUE_FUNDING_TENDER',
      effectId: row.id,
      tableRef: 'org_sv_funding_tenders_dtl',
      amount: row.amount,
      currency_code: row.currency_code,
    };
  },
};
