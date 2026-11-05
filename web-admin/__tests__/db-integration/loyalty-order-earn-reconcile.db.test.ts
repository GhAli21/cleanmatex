/**
 * Reusable Order Fin View P1B-15 (D27) — loyalty earn follows the order, against the real DB.
 *
 * Drives `reconcileOrderLoyaltyEarnTx` (the LOYALTY_EARN consumer) on a seeded order through
 * paid → edited up → refunded with points already spent → cancelled, and checks the ledger:
 * the EARN row records its rate, later deltas reuse it, a clawback never takes the balance
 * below zero and keeps the shortfall in `unreversed_points`, and a replay posts nothing.
 *
 * Isolation: every write runs inside a transaction that is always rolled back.
 * Gating: skips cleanly when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { reconcileOrderLoyaltyEarnTx } from '@/lib/services/loyalty.service';
import { randomUUID } from 'node:crypto';

let dbUp = false;
let tenantA = '';

beforeAll(async () => {
  try {
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantA = tenants[0]?.id ?? '';
    dbUp = tenantA.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ROLLBACK = Symbol('loyalty-reconcile-rollback');
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function runRollback(fn: (tx: TxClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as TxClient);
      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[loyalty-order-earn-reconcile] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('P1B-15 loyalty earn reconciliation (DB-level)', () => {
  dbit('earn → edit up → refund with spent points → replay → cancel', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      // The tenant's one program (unique per tenant), active at rate 2 for this tx.
      await tx.$executeRaw`
        INSERT INTO public.org_loyalty_programs_cf (tenant_org_id, program_name, earn_rate_per_unit, is_active, rec_status)
        VALUES (${t}::uuid, 'P1B-15 test', 2, true, 1)
        ON CONFLICT (tenant_org_id) DO UPDATE SET earn_rate_per_unit = 2, is_active = true, rec_status = 1`;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const order = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount, outstanding_amount, refunded_amount)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`LY-${randomUUID()}`}, 'OMR', 10, 10, 0)
        RETURNING id`;
      const orderId = order[0].id;
      const setOrder = (sql: { total: number; outstanding: number; refunded: number }) => tx.$executeRaw`
        UPDATE public.org_orders_mst SET total_amount = ${sql.total}, outstanding_amount = ${sql.outstanding}, refunded_amount = ${sql.refunded}
        WHERE tenant_org_id = ${t}::uuid AND id = ${orderId}::uuid`;
      const reconcile = (key: string) => reconcileOrderLoyaltyEarnTx(tx, { tenantId: t, orderId, idempotencyKey: key });
      const balance = async () => (await tx.org_loyalty_accounts_mst.findFirst({
        where: { tenant_org_id: t, customer_id: cust[0].id, is_active: true },
      }))?.points_balance ?? 0;

      // Still owing: nothing earned yet.
      expect(await reconcile('k-0')).toBeNull();

      // Paid later (LE-01): 10 × 2 = 20, rate recorded.
      await setOrder({ total: 10, outstanding: 0, refunded: 0 });
      const earn = await reconcile('k-1');
      expect(earn).toMatchObject({ txn_type: 'EARN', points: 20, remaining_points: 20 });
      expect(Number(earn?.earn_rate)).toBe(2);

      // Program rate changes; edit up to 15 still uses the recorded rate → +10.
      await tx.$executeRaw`UPDATE public.org_loyalty_programs_cf SET earn_rate_per_unit = 5 WHERE tenant_org_id = ${t}::uuid AND is_active = true`;
      await setOrder({ total: 15, outstanding: 0, refunded: 0 });
      expect(await reconcile('k-2')).toMatchObject({ txn_type: 'EARN', points: 10 });
      expect(await balance()).toBe(30);

      // Customer spends 25 points elsewhere, then the order is fully refunded.
      const account = await tx.org_loyalty_accounts_mst.findFirstOrThrow({ where: { tenant_org_id: t, customer_id: cust[0].id } });
      await tx.$executeRaw`UPDATE public.org_loyalty_accounts_mst SET points_balance = 5 WHERE tenant_org_id = ${t}::uuid AND id = ${account.id}::uuid`;
      await tx.$executeRaw`UPDATE public.org_loyalty_txn_dtl SET remaining_points = 0 WHERE tenant_org_id = ${t}::uuid AND order_id = ${orderId}::uuid AND points = 20`;
      await tx.$executeRaw`UPDATE public.org_loyalty_txn_dtl SET remaining_points = 5 WHERE tenant_org_id = ${t}::uuid AND order_id = ${orderId}::uuid AND points = 10`;
      await setOrder({ total: 15, outstanding: 0, refunded: 15 });
      expect(await reconcile('k-3')).toMatchObject({ txn_type: 'ADJUST', points: -5, points_after: 0, unreversed_points: 25 });
      expect(await balance()).toBe(0);

      // Replay of the same request, and a fresh request at target: nothing more.
      expect(await reconcile('k-3')).toBeNull();
      expect(await reconcile('k-4')).toBeNull();

      // Cancelled order: target 0 is already met by the shortfall.
      await tx.$executeRaw`UPDATE public.org_orders_mst SET cancelled_at = now() WHERE tenant_org_id = ${t}::uuid AND id = ${orderId}::uuid`;
      expect(await reconcile('k-5')).toBeNull();
    });
  });
});
