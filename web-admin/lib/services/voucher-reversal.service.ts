/**
 * BVM Voucher Reversal Service
 * Creates a full reversal voucher (POSTED → REVERSED) or a partial line reversal.
 * Original lines are never deleted — a mirror reversal voucher is created instead.
 * Writes to existing org_fin_voucher_audit_log and org_domain_events_outbox.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { VOUCHER_STATUS } from '../constants/voucher';
import { validateStatusTransition } from './voucher-validation.service';
import { generateBizVoucherNo } from './voucher-number.service';
import type { VoucherType } from '../types/voucher';

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
 * @param tenantOrgId
 * @param voucherId
 * @param reason
 * @param userId
 */
export async function reverseBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  reason: string,
  userId: string
): Promise<ReversalResult> {
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

        await db.org_fin_voucher_trx_lines_dtl.create({
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
            wiring_status:   'NOT_WIRED',
            reversed_line_id: line.id,
            created_by:      userId,
          },
        });

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
