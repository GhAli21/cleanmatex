/**
 * F-02 / D-12 §3 — AR payment allocation idempotency (DB-level).
 *
 * Locks the `allocateArPaymentTx` idempotency mechanism (org_idempotency_keys via
 * `withIdempotencyResource`, resource_type `ar_invoice_allocate_payment`) AND the
 * D-12 linkage fix: on replay the SAME allocation-payment row id is returned (the
 * `resourceId` read back from the cached idempotency row), so wired-effect /
 * overpayment target_ref linkage stays stable instead of regressing to undefined.
 *
 *   - same key replay → ONE org_invoice_payments_dtl row; both calls return the
 *     same allocationPaymentId; invoice paid/outstanding moved exactly once.
 *   - distinct keys     → TWO allocation rows; paid amount reflects both.
 *
 * Harness note: `allocateArPaymentTx` takes an external tx for its WRITES, but its
 * final return reads the invoice via `getArInvoiceDetail` on a NON-tx reader — so a
 * tx-local invoice is invisible ("AR invoice not found"). We therefore COMMIT a bare
 * invoice + customer seed (so the reader finds them), run the allocation inside a
 * rolled-back tx (every allocation/ledger/status/outbox write vanishes), and delete
 * only the two committed seed rows in `finally`. Skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';
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

const ROLLBACK = Symbol('ar-allocate-idem-rollback');
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

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[ar-allocate.idempotency] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

/** COMMITS a customer + an OPEN AR invoice with `total` outstanding; returns ids for teardown. */
async function commitSeedInvoice(total: number): Promise<{ invoiceId: string; customerId: string }> {
  const cust = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${tenantA}::uuid) RETURNING id`;
  const inv = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_invoice_mst
      (tenant_org_id, customer_id, invoice_no, currency_code, total, paid_amount, outstanding_amount, status)
    VALUES (${tenantA}::uuid, ${cust[0].id}::uuid, ${`ARI-${randomUUID()}`}, 'OMR', ${total}, 0, ${total}, 'OPEN')
    RETURNING id`;
  return { invoiceId: inv[0].id, customerId: cust[0].id };
}

async function teardownSeed(invoiceId: string, customerId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM public.org_invoice_mst WHERE id = ${invoiceId}::uuid AND tenant_org_id = ${tenantA}::uuid`;
  await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${customerId}::uuid AND tenant_org_id = ${tenantA}::uuid`;
}

async function countAllocations(tx: TxClient, invoiceId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM public.org_invoice_payments_dtl
    WHERE tenant_org_id = ${tenantA}::uuid AND invoice_id = ${invoiceId}::uuid`;
  return rows[0].n;
}
async function paidOf(tx: TxClient, invoiceId: string): Promise<number> {
  const inv = await tx.$queryRaw<Array<{ paid: number }>>`
    SELECT paid_amount::float8 AS paid FROM public.org_invoice_mst
    WHERE id = ${invoiceId}::uuid AND tenant_org_id = ${tenantA}::uuid`;
  return inv[0].paid;
}

describe('F-02 AR allocate idempotency (DB-level)', () => {
  dbit('same idempotency key replay → one allocation row, same allocationPaymentId, paid moved once', async () => {
    if (!dbUp) return;
    const seed = await commitSeedInvoice(100);
    let count = -1;
    let firstId: string | null = '';
    let replayId: string | null = '';
    let paidAmount = -1;
    try {
      await runRollback(async (tx) => {
        const userId = randomUUID();
        const key = `ar-retry-${randomUUID()}`;
        const r1 = await allocateArPaymentTx(tx, seed.invoiceId, { allocated_amount: 40, idempotency_key: key }, { tenantId: tenantA, userId });
        const r2 = await allocateArPaymentTx(tx, seed.invoiceId, { allocated_amount: 40, idempotency_key: key }, { tenantId: tenantA, userId });
        firstId = r1.allocationPaymentId;
        replayId = r2.allocationPaymentId;
        count = await countAllocations(tx, seed.invoiceId);
        paidAmount = await paidOf(tx, seed.invoiceId);
      });
    } finally {
      await teardownSeed(seed.invoiceId, seed.customerId);
    }
    expect(count).toBe(1); // replay did not create a second allocation
    expect(firstId).toBeTruthy();
    expect(replayId).toBe(firstId); // D-12 linkage: stable resource id on replay
    expect(paidAmount).toBeCloseTo(40, 5); // paid moved exactly once
  });

  dbit('distinct idempotency keys → two allocation rows; paid reflects both', async () => {
    if (!dbUp) return;
    const seed = await commitSeedInvoice(100);
    let count = -1;
    let paidAmount = -1;
    let id1: string | null = '';
    let id2: string | null = '';
    try {
      await runRollback(async (tx) => {
        const userId = randomUUID();
        const r1 = await allocateArPaymentTx(tx, seed.invoiceId, { allocated_amount: 30, idempotency_key: `ar-${randomUUID()}` }, { tenantId: tenantA, userId });
        const r2 = await allocateArPaymentTx(tx, seed.invoiceId, { allocated_amount: 25, idempotency_key: `ar-${randomUUID()}` }, { tenantId: tenantA, userId });
        id1 = r1.allocationPaymentId;
        id2 = r2.allocationPaymentId;
        count = await countAllocations(tx, seed.invoiceId);
        paidAmount = await paidOf(tx, seed.invoiceId);
      });
    } finally {
      await teardownSeed(seed.invoiceId, seed.customerId);
    }
    expect(count).toBe(2);
    expect(id1).not.toBe(id2);
    expect(paidAmount).toBeCloseTo(55, 5); // 30 + 25
  });
});
