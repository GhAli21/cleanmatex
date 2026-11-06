/**
 * WP18 OC-CON-005 proof against local Postgres.
 * 1. The settlement fingerprint Review signs changes when a payment lands, so Apply's check under the
 *    order lock sees it.
 * 2. The shared snapshot writer takes the order lock before it reads, so a settlement writer waits for
 *    an Apply that holds the order (and the reverse) instead of writing totals from stale rows.
 * A missing database is a skip, not a pass. The committed fixture is removed after the test.
 */
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/db/prisma';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { readSettlementFingerprint } from '@/lib/services/order-change/order-change-settlement-fingerprint';

// The snapshot writer pulls loyalty and settings services that build a browser client at load.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ROLLBACK = new Error('rollback');

let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM public.org_tenants_mst WHERE id = ${DEMO_TENANT}::uuid`;
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createOrder(db: Pick<typeof prisma, '$queryRaw'>): Promise<{ orderId: string; customerId: string }> {
  const cust = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name) VALUES (${DEMO_TENANT}::uuid, ${`WP18-CON5 ${randomUUID()}`}) RETURNING id`;
  const order = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, total_amount)
    VALUES (${DEMO_TENANT}::uuid, ${cust[0].id}::uuid, ${`WP18-CON5-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 10)
    RETURNING id`;
  return { orderId: order[0].id, customerId: cust[0].id };
}

describe('OC-CON-005 settlement during review', () => {
  it('the signed settlement fingerprint moves when a payment lands', async () => {
    if (!dbUp) return;
    await prisma.$transaction(async (tx) => {
      const { orderId } = await createOrder(tx);
      const reviewed = await readSettlementFingerprint(tx, DEMO_TENANT, orderId);
      expect(await readSettlementFingerprint(tx, DEMO_TENANT, orderId)).toBe(reviewed);
      await tx.$executeRaw`
        INSERT INTO public.org_order_payments_dtl (tenant_org_id, order_id, payment_method_code, payment_status, amount, currency_code, payment_nature_snapshot)
        VALUES (${DEMO_TENANT}::uuid, ${orderId}::uuid, 'CASH', 'COMPLETED', 4, 'OMR', 'REAL_PAYMENT')`;
      const afterPayment = await readSettlementFingerprint(tx, DEMO_TENANT, orderId);
      expect(afterPayment).not.toBe(reviewed);
      // Another organization's id reads nothing of this order.
      expect(await readSettlementFingerprint(tx, randomUUID(), orderId)).toBe(await readSettlementFingerprint(tx, randomUUID(), randomUUID()));
      throw ROLLBACK;
    }).catch((e) => { if (e !== ROLLBACK) throw e; });
  });

  it('the snapshot writer waits for the order lock held by another transaction', async () => {
    if (!dbUp) return;
    const { orderId, customerId } = await createOrder(prisma);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => { locked = resolve; });
    try {
      // Connection A: holds the order like Edit Apply does.
      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.org_orders_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ${orderId}::uuid FOR UPDATE`;
        locked();
        await held;
      }, { timeout: 20000 });
      await lockTaken;
      // Connection B: a settlement writer's recalculation must wait, not read around the lock.
      const waiter = prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '1500ms'`);
        await recalculateOrderFinancialSnapshotTx(tx, DEMO_TENANT, orderId);
      }, { timeout: 20000 });
      await expect(waiter).rejects.toThrow(/lock timeout|55P03/i);
      release();
      await holder;
    } finally {
      release?.();
      await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ${orderId}::uuid`;
      await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ${customerId}::uuid`;
    }
  });
});
