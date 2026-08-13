/**
 * B28 follow-up — real concurrent-transaction lock-ordering proof for
 * `processRefund`'s FOR UPDATE guard (F-R2, order-refund.service.ts:761-775).
 *
 * The existing mocked tests (refund.service.test.ts's "F-R2" describe block,
 * refund-b01-matrix.test.ts #12) only simulate a lock-miss by mocking
 * `$queryRaw` to return `[]` — they prove the code's *reaction* to losing a
 * lock, not that two real, independent Postgres transactions racing for the
 * same row are actually serialized. This file proves the real thing: two
 * genuinely concurrent `processRefund()` calls (two separate `prisma.
 * $transaction` connections, fired via `Promise.allSettled`) against the
 * SAME APPROVED refund row — exactly the double-issue scenario the code
 * comment describes ("two concurrent processRefund calls could both read
 * status APPROVED and both issue a wallet top-up / credit note").
 *
 * Deliberately scoped to CASH with no `execution` param (B9's flag-off,
 * record-only path) — this exercises the real, production `processRefund`
 * function end to end (not a reimplementation of its lock), while avoiding
 * the need to fabricate realistic drawer-session/gateway/wallet fixtures;
 * those destinations' own correctness is already covered by the existing
 * mocked test suites. What THIS test proves — and nothing else — is that
 * the row lock actually prevents a double-process under real concurrency.
 *
 * Runs only against the LOCAL dev DB (127.0.0.1:54322 per .env — never
 * remote). Seed rows are soft-deleted (is_active=false, rec_status=0) in
 * afterAll rather than hard-DELETEd, matching this repo's soft-delete
 * convention and avoiding any FK-ordering risk from side effects
 * (recalculateOrderFinancialSnapshotTx, emitEventTx) this test doesn't
 * enumerate exhaustively. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { processRefund } from '@/lib/services/order-refund.service';
import { randomUUID } from 'node:crypto';

let dbUp = false;
let tenantId = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantId = tenants[0]?.id ?? '';
    dbUp = tenantId.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[refund-concurrent-processing] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

type SeedIds = { customerId: string; orderId: string; refundId: string };

/** Seeds a minimal-but-real customer + order + APPROVED refund, all committed. */
async function seedApprovedRefund(refundAmount: number, totalPaid: number): Promise<SeedIds> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${tenantId}::uuid, ${'B28 concurrency test customer'})
    RETURNING id`;
  const customerId = customer[0].id;

  const order = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst
      (tenant_org_id, customer_id, order_no, currency_code, total_paid_amount)
    VALUES
      (${tenantId}::uuid, ${customerId}::uuid, ${`CONC-${randomUUID()}`}, 'OMR', ${totalPaid})
    RETURNING id`;
  const orderId = order[0].id;

  const refund = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_refunds_dtl
      (tenant_org_id, order_id, refund_amount, currency_code, refund_status,
       refund_method_code, refund_source_type, refund_context, approved_at)
    VALUES
      (${tenantId}::uuid, ${orderId}::uuid, ${refundAmount}, 'OMR', 'APPROVED',
       'CASH', 'GOODWILL_CONCESSION', 'STANDARD', now())
    RETURNING id`;
  const refundId = refund[0].id;

  return { customerId, orderId, refundId };
}

/**
 * Cleans up seeded rows. The refund row has is_active/rec_status (soft-
 * deleted, matching repo convention); org_orders_mst does NOT carry those
 * columns (orders use their own status lifecycle instead), so the order and
 * customer are best-effort hard-deleted leaf-to-root. Processing may have
 * created an outbox event and touched the order's own snapshot columns —
 * neither blocks deleting the order/customer rows themselves (no FK back
 * onto them), but this is wrapped defensively so a cleanup hiccup never
 * fails the test that already made its assertions.
 */
async function softDeleteSeed({ customerId, orderId, refundId }: SeedIds): Promise<void> {
  await prisma.$executeRaw`
    UPDATE public.org_order_refunds_dtl SET is_active = false, rec_status = 0 WHERE id = ${refundId}::uuid`;
  try {
    await prisma.$executeRaw`DELETE FROM public.org_domain_events_outbox WHERE aggregate_id = ${orderId}::uuid`;
  } catch {
    // best-effort — outbox cleanup is not required for test correctness
  }
  try {
    await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE id = ${orderId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${customerId}::uuid`;
  } catch {
    // best-effort — leftover local-only test rows (clearly labeled CONC-*) are harmless
  }
}

describe('processRefund — real concurrent-transaction lock ordering (B28 follow-up)', () => {
  dbit('two concurrent calls on the same APPROVED refund: exactly one processes, the other is rejected by the lock', async () => {
    const seed = await seedApprovedRefund(30, 100);
    try {
      const results = await Promise.allSettled([
        processRefund(tenantId, seed.refundId, 'actor-1'),
        processRefund(tenantId, seed.refundId, 'actor-2'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // The core safety property: real Postgres row locking serializes the
      // two transactions — it is never the case that both see APPROVED and
      // both proceed (which would double-process the same refund).
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason?.message).toMatch(
        /not found or not awaiting processing/i
      );

      const finalRow = await prisma.$queryRaw<Array<{ refund_status: string }>>`
        SELECT refund_status FROM public.org_order_refunds_dtl WHERE id = ${seed.refundId}::uuid`;
      expect(finalRow[0].refund_status).toBe('PROCESSED');
    } finally {
      await softDeleteSeed(seed);
    }
  });

  dbit('a third late arrival after the refund is already PROCESSED is rejected the same way (not just the initial race)', async () => {
    const seed = await seedApprovedRefund(15, 50);
    try {
      await processRefund(tenantId, seed.refundId, 'actor-1');

      await expect(processRefund(tenantId, seed.refundId, 'actor-2')).rejects.toThrow(
        /not found or not awaiting processing/i
      );

      const finalRow = await prisma.$queryRaw<Array<{ refund_status: string }>>`
        SELECT refund_status FROM public.org_order_refunds_dtl WHERE id = ${seed.refundId}::uuid`;
      expect(finalRow[0].refund_status).toBe('PROCESSED');
    } finally {
      await softDeleteSeed(seed);
    }
  });
});
