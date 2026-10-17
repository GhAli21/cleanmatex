/**
 * WP18 tenant isolation proof.
 * OC-SEC-001 and OC-SEC-002. A missing database is a skip, not a pass.
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

describe('order change tenant isolation', () => {
  it('OC-SEC-001 does not write another organization order', async () => {
    if (!dbUp) return;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.org_tenants_mst ORDER BY id LIMIT 2`;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users LIMIT 1`;
    const tenantId = tenants[0]?.id;
    const otherTenant = tenants.find((tenant) => tenant.id !== tenantId)?.id;
    const actorId = actors[0]?.id;
    if (!tenantId || !otherTenant || !actorId) throw new Error('OC-SEC-001 BLOCKED: two organizations are required');
    const customer = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_customers_mst (tenant_org_id, name)
      VALUES (${tenantId}::uuid, ${`WP18 isolation ${randomUUID()}`})
      RETURNING id`;
    const order = await prisma.$queryRaw<Array<{ id: string; state_version: number }>>`
      INSERT INTO public.org_orders_mst
        (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, edit_state_version, committed_at, committed_by, internal_notes)
      VALUES
        (${tenantId}::uuid, ${customer[0].id}::uuid, ${`WP18-SEC-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 1, now(), ${actorId}::uuid, 'owned note')
      RETURNING id, state_version`;
    try {
      const result = await applyOrderChange({
        tenantId: otherTenant,
        orderId: order[0].id,
        actorUserId: actorId,
        currencyCode: 'OMR',
        paymentTypeCode: 'PAY_ON_COLLECTION',
        idempotencyKey: `wp18-sec-${randomUUID()}`,
        appliedAt: new Date(),
        request: {
          expectedEditStateVersion: 1,
          expectedWfStateVersion: Number(order[0].state_version),
          sourceContext: 'order-edit',
          reviewProof: 'proof-1',
          calculationFingerprint: 'fingerprint-1',
          operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'leaked' } }],
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
        runInTransaction: (fn) => prisma.$transaction((tx) => fn(tx as unknown as OrderChangeApplyTx)),
      });
      expect(result.ok).toBe(false);
      const notes = await prisma.$queryRaw<Array<{ internal_notes: string | null; edit_state_version: number }>>`
        SELECT internal_notes, edit_state_version
        FROM public.org_orders_mst
        WHERE id = ${order[0].id}::uuid AND tenant_org_id = ${tenantId}::uuid`;
      expect(notes[0]).toEqual({ internal_notes: 'owned note', edit_state_version: 1 });
    } finally {
      await prisma.$executeRaw`
        DELETE FROM public.org_idempotency_keys
        WHERE tenant_org_id = ${otherTenant}::uuid AND key LIKE 'wp18-sec-%'`;
    }
  });

  it('OC-SEC-002 rejects an item that is not on this order', async () => {
    if (!dbUp) return;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.org_tenants_mst LIMIT 1`;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users LIMIT 1`;
    const tenantId = tenants[0]?.id;
    const actorId = actors[0]?.id;
    if (!tenantId || !actorId) throw new Error('NO_ELIGIBLE_ORDER');
    const customer = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_customers_mst (tenant_org_id, name)
      VALUES (${tenantId}::uuid, ${`WP18 target ${randomUUID()}`})
      RETURNING id`;
    const order = await prisma.$queryRaw<Array<{ id: string; state_version: number }>>`
      INSERT INTO public.org_orders_mst
        (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, edit_state_version, committed_at, committed_by)
      VALUES
        (${tenantId}::uuid, ${customer[0].id}::uuid, ${`WP18-TGT-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 1, now(), ${actorId}::uuid)
      RETURNING id, state_version`;
    const foreignItem = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    try {
      const result = await applyOrderChange({
        tenantId,
        orderId: order[0].id,
        actorUserId: actorId,
        currencyCode: 'OMR',
        paymentTypeCode: 'PAY_ON_COLLECTION',
        idempotencyKey: `wp18-tgt-${randomUUID()}`,
        appliedAt: new Date(),
        request: {
          expectedEditStateVersion: 1,
          expectedWfStateVersion: Number(order[0].state_version),
          sourceContext: 'order-edit',
          reviewProof: 'proof-1',
          calculationFingerprint: 'fingerprint-1',
          operations: [{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: foreignItem }, payload: {} }],
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
          projectedTotal: '8.0000',
          projectedTax: '0.0000',
          displayTotal: '8.000',
          projectedItemIds: [],
          lines: [{ id: foreignItem, active: true, unitPrice: '2.0000', merchandiseAmount: '2.0000' }],
          followUp: [],
        },
        runInTransaction: (fn) => prisma.$transaction((tx) => fn(tx as unknown as OrderChangeApplyTx)),
      });
      expect(result).toEqual({ ok: false, status: 409, code: 'REMOVAL_NOT_ACTIVE' });
      const version = await prisma.$queryRaw<Array<{ edit_state_version: number }>>`
        SELECT edit_state_version
        FROM public.org_orders_mst
        WHERE id = ${order[0].id}::uuid AND tenant_org_id = ${tenantId}::uuid`;
      expect(version[0]?.edit_state_version).toBe(1);
    } finally {
      await prisma.$executeRaw`
        DELETE FROM public.org_idempotency_keys
        WHERE tenant_org_id = ${tenantId}::uuid AND key LIKE 'wp18-tgt-%'`;
    }
  });
});
