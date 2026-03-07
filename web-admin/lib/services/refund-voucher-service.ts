/**
 * Refund Voucher Service for CleanMateX
 *
 * Creates CASH_OUT/REFUND vouchers for payment refunds.
 * Rule: No payment transaction without a voucher master in org_fin_vouchers_mst.
 * Every refund row must have voucher_id referencing org_fin_vouchers_mst.
 *
 * Plan: payment_cancel_refund_and_audit_plan.md, cancel_and_return_order_ddb29821.plan.md
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  VOUCHER_CATEGORY,
  VOUCHER_SUBTYPE,
  VOUCHER_TYPE,
  VOUCHER_STATUS,
} from '../constants/voucher';
import type { CreateRefundVoucherForPaymentInput } from '../types/voucher';

/** Transaction client type for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const REFUND_PREFIX = 'REF';
const SEQ_LEN = 5;

/**
 * Generate next refund voucher_no for a tenant (REF-YYYY-NNNNN).
 */
export async function generateRefundVoucherNo(
  tenantId: string,
  tx?: PrismaTx
): Promise<string> {
  const db = tx ?? prisma;
  return withTenantContext(tenantId, async () => {
    const year = new Date().getFullYear().toString();
    const existing = await db.org_fin_vouchers_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        voucher_no: { startsWith: `${REFUND_PREFIX}-${year}-` },
      },
      select: { voucher_no: true },
      orderBy: { voucher_no: 'desc' },
      take: 1,
    });
    const lastNo = existing[0]?.voucher_no;
    let seq = 1;
    if (lastNo) {
      const match = lastNo.match(new RegExp(`^${REFUND_PREFIX}-${year}-(\\d+)$`));
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }
    const seqStr = seq.toString().padStart(SEQ_LEN, '0');
    return `${REFUND_PREFIX}-${year}-${seqStr}`;
  });
}

/**
 * Create a refund voucher for a payment (CASH_OUT, REFUND).
 * Returns voucher_id and voucher_no for attaching to refund payment row.
 * When tx is provided, all operations run inside that transaction.
 */
export async function createRefundVoucherForPayment(
  input: CreateRefundVoucherForPaymentInput,
  tx?: PrismaTx
): Promise<{ voucher_id: string; voucher_no: string }> {
  const db = tx ?? prisma;
  const voucher_no = await generateRefundVoucherNo(input.tenant_org_id, db);

  const row = await db.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id: input.tenant_org_id,
      branch_id: input.branch_id ?? null,
      voucher_no,
      voucher_category: VOUCHER_CATEGORY.CASH_OUT,
      voucher_subtype: VOUCHER_SUBTYPE.REFUND,
      voucher_type: VOUCHER_TYPE.PAYMENT,
      invoice_id: input.invoice_id ?? null,
      order_id: input.order_id ?? null,
      customer_id: input.customer_id ?? null,
      total_amount: input.total_amount,
      currency_code: input.currency_code ?? null,
      status: VOUCHER_STATUS.ISSUED,
      issued_at: input.issued_at ?? new Date(),
      reason_code: input.reason_code ?? null,
      created_by: input.created_by ?? null,
    },
    select: { id: true, voucher_no: true },
  });

  await db.org_fin_voucher_audit_log.create({
    data: {
      voucher_id: row.id,
      tenant_org_id: input.tenant_org_id,
      action: 'issued',
      snapshot_or_reason: null,
      changed_by: input.created_by ?? null,
    },
  });

  return { voucher_id: row.id, voucher_no: row.voucher_no };
}
