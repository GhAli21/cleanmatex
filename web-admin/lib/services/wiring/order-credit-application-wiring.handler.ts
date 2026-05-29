import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE } from '@/lib/constants/voucher';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

export const orderCreditApplicationWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return line.line_role === LINE_ROLE.ORDER_CREDIT_APPLICATION;
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.order_id) {
      throw new Error(`ORDER_CREDIT_APPLICATION line ${line.id} (line_no ${line.line_no}) is missing order_id`);
    }
    if (!line.credit_application_type) {
      throw new Error(`ORDER_CREDIT_APPLICATION line ${line.id} (line_no ${line.line_no}) is missing credit_application_type`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const existing = await tx.org_order_credit_apps_dtl.findFirst({
      where:  { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const now = new Date();

    const created = await tx.org_order_credit_apps_dtl.create({
      data: {
        tenant_org_id:           tenantOrgId,
        order_id:                line.order_id!,
        credit_type:             line.credit_application_type!,
        applied_amount:          line.amount,
        currency_code:           line.currency_code ?? 'SAR',
        applied_by:              userId,
        applied_at:              now,
        fin_voucher_id:          voucherId,
        fin_voucher_trx_line_id: line.id,
        is_active:               true,
        rec_status:              1,
        created_by:              userId,
      },
      select: { id: true },
    });

    return created.id;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_order_credit_apps_dtl.findFirst({
      where:  { fin_voucher_trx_line_id: line.id, tenant_org_id: tenantOrgId },
      select: { id: true, applied_amount: true, currency_code: true },
    });
    if (!row) return null;
    return {
      effectType:    'CREDIT_APPLICATION',
      effectId:      row.id,
      tableRef:      'org_order_credit_apps_dtl',
      amount:        row.applied_amount,
      currency_code: row.currency_code,
    };
  },
};
