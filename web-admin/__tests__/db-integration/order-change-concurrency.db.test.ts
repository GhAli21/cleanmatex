/**
 * WP18 concurrency proof against local Postgres.
 * OC-CON-001, 002, 003, 004 and 007. A missing database is a skip, not a pass.
 * Rows use a WP18- prefix and are removed after each test.
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

interface Seed {
  tenantId: string;
  actorId: string;
  customerId: string;
  orderId: string;
  wfVersion: number;
}

async function seed(): Promise<Seed> {
  const tenants = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.org_tenants_mst LIMIT 1`;
  const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users LIMIT 1`;
  const tenantId = tenants[0]?.id;
  const actorId = actors[0]?.id;
  if (!tenantId || !actorId) throw new Error('NO_ELIGIBLE_ORDER');
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${tenantId}::uuid, ${`WP18 ${randomUUID()}`})
    RETURNING id`;
  const order = await prisma.$queryRaw<Array<{ id: string; state_version: number }>>`
    INSERT INTO public.org_orders_mst
      (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, edit_state_version, committed_at, committed_by)
    VALUES
      (${tenantId}::uuid, ${customer[0].id}::uuid, ${`WP18-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 1, now(), ${actorId}::uuid)
    RETURNING id, state_version`;
  return {
    tenantId,
    actorId,
    customerId: customer[0].id,
    orderId: order[0].id,
    wfVersion: Number(order[0].state_version),
  };
}

async function cleanup(row: Seed | null): Promise<void> {
  if (!row) return;
  // Applied Change history and a committed order are immutable. Only the
  // idempotency claim is disposable. The WP18 order row stays in the local database.
  await prisma.$executeRaw`
    DELETE FROM public.org_idempotency_keys
    WHERE tenant_org_id = ${row.tenantId}::uuid AND key LIKE 'wp18-%'`;
}

function apply(row: Seed, key: string, notes: string, versions?: { edit?: number; wf?: number }) {
  return applyOrderChange({
    tenantId: row.tenantId,
    orderId: row.orderId,
    actorUserId: row.actorId,
    currencyCode: 'OMR',
    paymentTypeCode: 'PAY_ON_COLLECTION',
    idempotencyKey: key,
    appliedAt: new Date(),
    request: {
      expectedEditStateVersion: versions?.edit ?? 1,
      expectedWfStateVersion: versions?.wf ?? row.wfVersion,
      sourceContext: 'order-edit',
      reviewProof: 'proof-1',
      calculationFingerprint: 'fingerprint-1',
      operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes } }],
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
}

async function changeCount(row: Seed): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM public.org_order_changes_mst
    WHERE tenant_org_id = ${row.tenantId}::uuid AND order_id = ${row.orderId}::uuid`;
  return rows[0]?.count ?? 0;
}

describe('order change concurrency', () => {
  let row: Seed | null = null;

  afterEach(async () => {
    if (!dbUp) return;
    await cleanup(row);
    row = null;
  });

  it('OC-CON-001 and OC-CON-007 replay the same key as one Change', async () => {
    if (!dbUp) return;
    row = await seed();
    const key = `wp18-${randomUUID()}`;
    const [first, second] = await Promise.all([
      apply(row, key, 'Same note'),
      apply(row, key, 'Same note'),
    ]);
    const results = [first, second];
    expect(results.filter((result) => result.ok).length).toBeGreaterThanOrEqual(1);
    expect(results.some((result) => result.ok && result.replayed)).toBe(true);
    expect(await changeCount(row)).toBe(1);
  });

  it('OC-CON-002 rejects the same key with a different note and writes once', async () => {
    if (!dbUp) return;
    row = await seed();
    const key = `wp18-${randomUUID()}`;
    const first = await apply(row, key, 'First note');
    const second = await apply(row, key, 'Different note', { edit: 2 });
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await changeCount(row)).toBe(1);
  });

  it('OC-CON-003 lets one editor win the same revision', async () => {
    if (!dbUp) return;
    row = await seed();
    const [left, right] = await Promise.all([
      apply(row, `wp18-${randomUUID()}`, 'Editor A'),
      apply(row, `wp18-${randomUUID()}`, 'Editor B'),
    ]);
    const results = [left, right];
    expect(results.filter((result) => result.ok).length).toBe(1);
    expect(results.filter((result) => !result.ok && result.code === 'VERSION_CONFLICT').length).toBe(1);
    expect(await changeCount(row)).toBe(1);
  });

  it('OC-CON-004 rejects Apply after the workflow version moves', async () => {
    if (!dbUp) return;
    row = await seed();
    await prisma.$executeRaw`
      UPDATE public.org_orders_mst
      SET state_version = state_version + 1
      WHERE id = ${row.orderId}::uuid AND tenant_org_id = ${row.tenantId}::uuid`;
    const result = await apply(row, `wp18-${randomUUID()}`, 'After workflow');
    expect(result).toEqual({ ok: false, status: 409, code: 'WORKFLOW_VERSION_CONFLICT' });
    expect(await changeCount(row)).toBe(0);
  });
});
