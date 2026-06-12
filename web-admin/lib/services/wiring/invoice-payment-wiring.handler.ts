import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * Wires INVOICE_PAYMENT voucher lines to org_invoice_payments_dtl via AR allocate service.
 * Does not create org_order_payments_dtl rows.
 */
export const invoicePaymentWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      line.line_role === LINE_ROLE.INVOICE_PAYMENT &&
      line.direction === 'IN' &&
      line.target_type === TARGET_TYPE.INVOICE
    );
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.target_id) {
      throw new Error(`INVOICE_PAYMENT line ${line.id} is missing target_id`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const allocation = await allocateArPaymentTx(
      tx,
      line.target_id!,
      {
        voucher_id: voucherId,
        allocated_amount: Number(line.amount),
        notes: `Voucher ${voucherId} invoice payment line ${line.line_no}`,
        idempotency_key: `${voucherId}_inv_${line.id}`,
      },
      { tenantId: tenantOrgId, userId }
    );
    return allocation.id;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_invoice_payments_dtl.findFirst({
      where: {
        tenant_org_id: tenantOrgId,
        voucher_id: line.voucher_id,
        invoice_id: line.target_id ?? undefined,
      },
      select: { id: true, allocated_amount: true },
      orderBy: { created_at: 'desc' },
    });
    if (!row) return null;
    return {
      effectType: 'INVOICE_PAYMENT',
      effectId: row.id,
      tableRef: 'org_invoice_payments_dtl',
      amount: row.allocated_amount,
      currency_code: line.currency_code,
    };
  },
};
