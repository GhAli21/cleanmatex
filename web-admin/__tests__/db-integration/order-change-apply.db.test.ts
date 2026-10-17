/**
 * Proves a rejected Apply transaction leaves no Change row.
 * The default unit suite ignores this folder. Run with npm run test:db-integration.
 * The transaction is thrown away after the write, so a failed rollback is visible
 * as a leftover row for the generated idempotency key.
 */
import { randomUUID } from 'crypto';

import { applyOrderChange, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import type { OrderChangeFinancialResult } from '@/lib/services/order-change/order-change-financial-result.service';
import { prisma } from '@/lib/db/prisma';

let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const financial: OrderChangeFinancialResult = {
  outcome: 'SETTLED',
  outstandingAmount: '0.0000',
  overpaidAmount: '0.0000',
  unresolvedOverpayment: '0.0000',
  effectivePayments: '10.0000',
  effectiveCredits: '0.0000',
  fiscalObligation: '10.0000',
  settlementMutated: false,
  warnings: [],
};

describe('order change apply rollback', () => {
  it('rolls back the Change when the caller transaction aborts', async () => {
    if (!dbUp) return;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.org_tenants_mst LIMIT 1`;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users LIMIT 1`;
    const tenantId = tenants[0]?.id;
    const actorId = actors[0]?.id;
    if (!tenantId || !actorId) throw new Error('NO_ELIGIBLE_ORDER');

    const idempotencyKey = `wp12-rollback-${randomUUID()}`;
    const orderNo = `WP12-${randomUUID()}`;
    await expect(prisma.$transaction(async (tx) => {
      const customer = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id, name)
        VALUES (${tenantId}::uuid, 'WP12 rollback customer')
        RETURNING id`;
      const order = await tx.$queryRaw<Array<{ id: string; state_version: number }>>`
        INSERT INTO public.org_orders_mst
          (tenant_org_id, customer_id, order_no, currency_code, edit_state_version, committed_at, committed_by)
        VALUES
          (${tenantId}::uuid, ${customer[0].id}::uuid, ${orderNo}, 'OMR', 1, now(), ${actorId}::uuid)
        RETURNING id, state_version`;
      const applied = await applyOrderChange({
        tenantId,
        orderId: order[0].id,
        actorUserId: actorId,
        currencyCode: 'OMR',
        paymentTypeCode: 'PAY_ON_COLLECTION',
        idempotencyKey,
        appliedAt: new Date(),
        request: {
          expectedEditStateVersion: 1,
          expectedWfStateVersion: order[0].state_version,
          sourceContext: 'order-edit',
          reviewProof: 'proof-1',
          calculationFingerprint: 'fingerprint-1',
          operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Rollback proof' } }],
        },
        preview: {
          ok: true,
          status: 'READY',
          createsChange: true,
          decisions: [],
          calculationFingerprint: 'fingerprint-1',
          reviewProof: 'proof-1',
          financial,
          originalTotal: '10.0000',
          projectedTotal: '10.0000',
          projectedTax: '0.0000',
          displayTotal: '10.000',
          projectedItemIds: [],
          followUp: [],
        },
        runInTransaction: (fn) => fn(tx as unknown as OrderChangeApplyTx),
      });
      if (!applied.ok) throw new Error(applied.code);
      throw new Error('ROLLBACK_TEST');
    })).rejects.toThrow('ROLLBACK_TEST');

    const leftover = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_order_changes_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND idempotency_key = ${idempotencyKey}`;
    expect(leftover).toEqual([]);
  });
});
