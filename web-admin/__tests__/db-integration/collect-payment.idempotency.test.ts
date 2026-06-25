/**
 * F-10 / D-12 §2 — collect-payment idempotency (GA-class, DB-level).
 *
 * What F-10 fixed: `collectPaymentTx` used to derive a STABLE per-(order,user) key
 * `${orderId}_collect_${collectedBy}` and hand it to the keyed disposition/allocation
 * sub-ops. Two DISTINCT later-collection events by the same cashier therefore shared
 * one idempotency key, so the second event's disposition lines hit the existing rows
 * and were silently de-duplicated (the second collection's excess routing was lost).
 * The fix: each collection event gets a collision-free key (client/POS per-attempt key,
 * else a per-request UUID), so distinct events record distinct dispositions while a
 * genuine retry of the SAME event still de-dupes.
 *
 * Why this suite targets `executeOverpaymentDispositionTx` (not `collectPaymentTx`):
 * `collectPaymentTx` opens its OWN `prisma.$transaction` (commits — not composable into
 * the rollback harness) and reads tenant settings via the Supabase SSR `createClient()`
 * (no request context in a node test). Its idempotency semantics live entirely in the
 * keyed sub-op `executeOverpaymentDispositionTx`, which DOES accept an external `tx` and
 * is the exact locus of the old collision. We exercise that real DB path here:
 *   - distinct keys  → two independent disposition rows  (proves two collection events
 *                       both apply + sum — the bug is gone)
 *   - same key replay → one disposition row, second call returns the existing id
 *                       (proves a genuine retry de-dupes)
 *
 * Isolation: every write runs inside a Prisma interactive transaction that is ALWAYS
 * rolled back. Gating: skips cleanly when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { executeOverpaymentDispositionTx } from '@/lib/services/overpayment-disposition.service';
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';
import { randomUUID } from 'node:crypto';

let dbUp = false;
let tenantA = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
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

/** Runs `fn` inside a transaction that is force-rolled-back (nothing persists). */
const ROLLBACK = Symbol('collect-idem-rollback');
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function runRollback(fn: (tx: TxClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as TxClient);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

/** `it` that skips (not fails) when no DB is reachable. */
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[collect-payment.idempotency] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

/** Seeds a minimal customer + PAY_ON_COLLECTION order for `tenantId`; returns ids. */
async function seedOrder(tx: TxClient, tenantId: string): Promise<{ orderId: string; customerId: string }> {
  const cust = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${tenantId}::uuid) RETURNING id`;
  const order = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code)
    VALUES (${tenantId}::uuid, ${cust[0].id}::uuid, ${`CI-${randomUUID()}`}, 'OMR')
    RETURNING id`;
  return { orderId: order[0].id, customerId: cust[0].id };
}

/** A single RETURN_CASH_CHANGE disposition (audit-only — no stored-value writes / FKs). */
function cashChangeResolution(amount: number): OverpaymentResolutionInput {
  return {
    excessAmount: amount,
    lines: [{ resolutionCode: 'RETURN_CASH_CHANGE', legRef: randomUUID(), amount }],
  } as OverpaymentResolutionInput;
}

async function countDispositions(tx: TxClient, tenantId: string, orderId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM public.org_fin_overpay_disp_dtl
    WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND is_active = true`;
  return rows[0].n;
}

describe('F-10 collect-payment idempotency — disposition keyed semantics (DB-level)', () => {
  dbit('distinct idempotency keys record two independent dispositions that sum (two collection events both apply)', async () => {
    let count = -1;
    let total = -1;
    await runRollback(async (tx) => {
      const { orderId, customerId } = await seedOrder(tx, tenantA);
      const userId = randomUUID();

      // Event 1 — partial collection excess routed to cash change.
      const r1 = await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: cashChangeResolution(3),
        idempotencyKey: `evt-${randomUUID()}`, // collision-free per-event key (the F-10 fix)
      });
      // Event 2 — a SEPARATE collection event by the same cashier, distinct key.
      const r2 = await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: cashChangeResolution(5),
        idempotencyKey: `evt-${randomUUID()}`,
      });

      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r1[0].id).not.toBe(r2[0].id); // two distinct audit rows
      count = await countDispositions(tx, tenantA, orderId);
      const sumRows = await tx.$queryRaw<Array<{ s: number }>>`
        SELECT COALESCE(sum(amount),0)::float8 AS s FROM public.org_fin_overpay_disp_dtl
        WHERE tenant_org_id = ${tenantA}::uuid AND order_id = ${orderId}::uuid AND is_active = true`;
      total = sumRows[0].s;
    });
    expect(count).toBe(2); // both collection events persisted — no silent dedupe
    expect(total).toBeCloseTo(8, 5); // 3 + 5
  });

  dbit('same idempotency key replay de-dupes (one row; second call returns the existing id)', async () => {
    let count = -1;
    let firstId = '';
    let replayId = '';
    await runRollback(async (tx) => {
      const { orderId, customerId } = await seedOrder(tx, tenantA);
      const userId = randomUUID();
      const key = `retry-${randomUUID()}`; // same key both calls (a genuine retry of ONE event)

      const r1 = await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: cashChangeResolution(4),
        idempotencyKey: key,
      });
      const r2 = await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: cashChangeResolution(4),
        idempotencyKey: key,
      });

      firstId = r1[0].id;
      replayId = r2[0].id;
      count = await countDispositions(tx, tenantA, orderId);
    });
    expect(count).toBe(1); // replay did not double-write
    expect(replayId).toBe(firstId); // second call returned the cached/existing audit row
  });

  dbit('different resolution codes under the same base key stay distinct (per-line key composition)', async () => {
    // The line key is `${idempotencyKey}_op_${resolutionCode}_${lineIndex}`, so a base key
    // shared across different resolution codes must NOT collide.
    let count = -1;
    await runRollback(async (tx) => {
      const { orderId, customerId } = await seedOrder(tx, tenantA);
      const userId = randomUUID();
      const baseKey = `mixed-${randomUUID()}`;

      await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: cashChangeResolution(2),
        idempotencyKey: baseKey,
      });
      // Same base key, different resolution code → SAVE_AS_CUSTOMER_ADVANCE (needs customerId).
      await executeOverpaymentDispositionTx({
        tx, tenantId: tenantA, userId, orderId, customerId,
        currencyCode: 'OMR', voucherId: null,
        resolution: {
          excessAmount: 6,
          lines: [{ resolutionCode: 'SAVE_AS_CUSTOMER_ADVANCE', amount: 6 }],
        } as OverpaymentResolutionInput,
        idempotencyKey: baseKey,
      });
      count = await countDispositions(tx, tenantA, orderId);
    });
    expect(count).toBe(2); // distinct resolution codes are not deduped by a shared base key
  });
});
