import 'server-only';

import type { Prisma } from '@prisma/client';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import { allocateB2bStatementPaymentTx } from '@/lib/services/b2b-statement-payment.service';
import type { WiringHandler, VoucherLineForWiring, LinkedEffect } from '@/lib/types/voucher-wiring';

/**
 * Wires STATEMENT_PAYMENT voucher lines to org_b2b_statements_mst balance updates.
 */
export const statementPaymentWiringHandler: WiringHandler = {
  canHandle(line: VoucherLineForWiring): boolean {
    return (
      line.line_role === LINE_ROLE.STATEMENT_PAYMENT &&
      line.direction === 'IN' &&
      line.target_type === TARGET_TYPE.B2B_STATEMENT
    );
  },

  async validate(line: VoucherLineForWiring): Promise<void> {
    if (!line.target_id) {
      throw new Error(`STATEMENT_PAYMENT line ${line.id} is missing target_id`);
    }
  },

  async wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const result = await allocateB2bStatementPaymentTx(tx, line.target_id!, {
      tenantId: tenantOrgId,
      userId,
      amount: Number(line.amount),
      idempotencyKey: `${voucherId}_stmt_${line.id}`,
      voucherId,
    });
    return result.id;
  },

  async getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null> {
    const row = await tx.org_b2b_statements_mst.findFirst({
      where: { id: line.target_id ?? '', tenant_org_id: tenantOrgId },
      select: { id: true, balance_amount: true, currency_cd: true },
    });
    if (!row) return null;
    return {
      effectType: 'STATEMENT_PAYMENT',
      effectId: row.id,
      tableRef: 'org_b2b_statements_mst',
      amount: Number(line.amount),
      currency_code: row.currency_cd,
    };
  },
};
