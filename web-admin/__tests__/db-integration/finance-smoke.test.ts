/**
 * F-T5 / T-1 — DB-level finance integration harness (smoke).
 *
 * Why this exists: every other finance test mocks the Prisma `tx` client, so DB-level
 * CHECK / FK / RLS enforcement is NEVER exercised in CI. That seam is exactly where the
 * only GA blocker hid (F-00: the `SAVE_TO_CUSTOMER_WALLET` CHECK), and a "mirror" unit
 * test could not catch it. This suite runs against the REAL local Supabase DB (all
 * migrations applied) and asserts live invariants:
 *
 *   1. Overpayment resolution catalog/constraint parity (the wallet-blocker class):
 *      `sys_fin_overpay_res_cd` holds every V1 code incl. SAVE_TO_CUSTOMER_WALLET, and the
 *      disposition table guards `resolution_code` with an FK (0378) — NOT a hardcoded CHECK.
 *   2. F-01 RLS enforcement: under a tenant-A JWT a cross-tenant `org_tax_doc_seq_counters`
 *      row is invisible (live policy, not just `relrowsecurity=true`).
 *   3. F-04 B2B detail constraints: `amount > 0` CHECK, the composite statement FK, and the
 *      partial idempotency unique all reject bad writes; distinct keys are allowed.
 *
 * Isolation: every write happens inside a Prisma interactive transaction that is ALWAYS
 * rolled back (negative tests reject the tx; positive tests throw a sentinel). Nothing is
 * persisted to the dev DB. Raw SQL is used throughout so the tenant middleware is bypassed
 * and tenant context is controlled explicitly (SET LOCAL ROLE + JWT claim) for the RLS probe.
 *
 * Gating: if no DB is reachable the suite skips (so a dev without the local stack, or CI
 * without a DB, stays green). When a DB IS present, a regressed invariant fails CI.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { randomUUID } from 'node:crypto';

/** Allowed-in-V1 overpayment resolution codes that MUST exist in the catalog. */
const REQUIRED_OVERPAY_CODES = [
  'REDUCE_PAYMENT',
  'RETURN_CASH_CHANGE',
  'SAVE_AS_CUSTOMER_ADVANCE',
  'SAVE_TO_CUSTOMER_WALLET',
  'SAVE_AS_CUSTOMER_CREDIT',
  'ALLOCATE_TO_CUSTOMER_BALANCES',
  'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES',
] as const;

let dbUp = false;
let tenantA = '';
let tenantB = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 2`;
    tenantA = tenants[0]?.id ?? '';
    tenantB = tenants[1]?.id ?? '';
    dbUp = tenantA.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Runs `fn` inside a transaction that is force-rolled-back (nothing persists). */
const ROLLBACK = Symbol('ft5-rollback');
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
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** `it` that skips (not fails) when no DB is reachable. */
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[F-T5] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('F-T5 finance DB smoke — overpayment resolution catalog/constraint parity', () => {
  dbit('sys_fin_overpay_res_cd contains every V1 code incl. SAVE_TO_CUSTOMER_WALLET', async () => {
    const rows = await prisma.$queryRaw<Array<{ resolution_code: string }>>`
      SELECT resolution_code FROM public.sys_fin_overpay_res_cd`;
    const codes = new Set(rows.map((r) => r.resolution_code));
    for (const code of REQUIRED_OVERPAY_CODES) {
      expect(codes.has(code)).toBe(true);
    }
  });

  dbit('overpay disposition resolution_code is FK-guarded, with NO hardcoded CHECK (0378 fix holds)', async () => {
    const cons = await prisma.$queryRaw<Array<{ contype: string; def: string }>>`
      SELECT contype::text AS contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.org_fin_overpay_disp_dtl'::regclass`;
    const fkOnCode = cons.find(
      (c) => c.contype === 'f' && /\(resolution_code\)\s+REFERENCES\s+sys_fin_overpay_res_cd/i.test(c.def),
    );
    expect(fkOnCode).toBeDefined();
    // The original blocker was a CHECK enumerating resolution codes — it must NOT come back.
    const checkOnCode = cons.find((c) => c.contype === 'c' && /resolution_code/i.test(c.def));
    expect(checkOnCode).toBeUndefined();
  });
});

describe('F-T5 finance DB smoke — F-01 RLS on org_tax_doc_seq_counters', () => {
  dbit('under a tenant-A JWT, a tenant-B seq-counter row is invisible (RLS enforced live)', async () => {
    if (!tenantB) {
      console.warn('[F-T5] need >=2 tenants for the RLS isolation probe — skipping');
      return;
    }
    let aVisible = -1;
    let bVisible = -1;
    await runRollback(async (tx) => {
      // Seed one row per tenant as the privileged connection role (bypasses RLS for setup).
      // `document_type` is constrained (chk_tax_doc_seq_type) so we use a real value with a
      // sentinel fiscal_year to scope the probe; the table is empty and the tx is rolled back.
      await tx.$executeRaw`
        INSERT INTO public.org_tax_doc_seq_counters (tenant_org_id, document_type, fiscal_year, last_sequence)
        VALUES (${tenantA}::uuid, 'CREDIT_NOTE', 9999, 0)`;
      await tx.$executeRaw`
        INSERT INTO public.org_tax_doc_seq_counters (tenant_org_id, document_type, fiscal_year, last_sequence)
        VALUES (${tenantB}::uuid, 'CREDIT_NOTE', 9999, 0)`;

      // Become an app user scoped to tenant A, then read back under RLS.
      const claims = JSON.stringify({ user_metadata: { tenant_org_id: tenantA }, role: 'authenticated' });
      await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;

      const a = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM public.org_tax_doc_seq_counters
        WHERE document_type = 'CREDIT_NOTE' AND fiscal_year = 9999 AND tenant_org_id = ${tenantA}::uuid`;
      const b = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM public.org_tax_doc_seq_counters
        WHERE document_type = 'CREDIT_NOTE' AND fiscal_year = 9999 AND tenant_org_id = ${tenantB}::uuid`;
      aVisible = a[0].n;
      bVisible = b[0].n;
    });
    expect(aVisible).toBe(1); // own-tenant row visible
    expect(bVisible).toBe(0); // cross-tenant row filtered out by the tenant_isolation policy
  });
});

describe('F-T5 finance DB smoke — F-04 B2B statement payment detail constraints', () => {
  dbit('rejects amount <= 0 (chk_b2b_stmt_pay_amt)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount)
          VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, 0)`;
      }),
    ).rejects.toThrow(/chk_b2b_stmt_pay_amt|violates check constraint/i);
  });

  dbit('rejects an unknown statement via the composite FK (fk_b2b_stmt_pay_statement)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount)
          VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, 10)`;
      }),
    ).rejects.toThrow(/fk_b2b_stmt_pay_statement|violates foreign key/i);
  });

  dbit('blocks a duplicate idempotency key on the same tenant (uq_b2b_stmt_pay_idem)', async () => {
    const key = `ft5-${randomUUID()}`;
    await expect(
      prisma.$transaction(async (tx) => {
        const stmtId = await seedStatement(tx as TxClient, tenantA);
        await tx.$executeRaw`
          INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount, idempotency_key)
          VALUES (${tenantA}::uuid, ${stmtId}::uuid, 5, ${key})`;
        // Same (tenant_org_id, idempotency_key) → must violate the partial unique index.
        await tx.$executeRaw`
          INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount, idempotency_key)
          VALUES (${tenantA}::uuid, ${stmtId}::uuid, 7, ${key})`;
      }),
    ).rejects.toThrow(/uq_b2b_stmt_pay_idem|already exists|duplicate key value/i);
  });

  dbit('allows two DIFFERENT idempotency keys on the same statement', async () => {
    let bothInserted = false;
    await runRollback(async (tx) => {
      const stmtId = await seedStatement(tx, tenantA);
      await tx.$executeRaw`
        INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount, idempotency_key)
        VALUES (${tenantA}::uuid, ${stmtId}::uuid, 5, ${`ft5-${randomUUID()}`})`;
      await tx.$executeRaw`
        INSERT INTO public.org_b2b_statement_payments_dtl (tenant_org_id, statement_id, amount, idempotency_key)
        VALUES (${tenantA}::uuid, ${stmtId}::uuid, 7, ${`ft5-${randomUUID()}`})`;
      bothInserted = true;
    });
    expect(bothInserted).toBe(true);
  });
});

/** Creates a minimal customer + B2B statement for `tenantId` inside the given tx; returns the statement id. */
async function seedStatement(tx: TxClient, tenantId: string): Promise<string> {
  const cust = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${tenantId}::uuid) RETURNING id`;
  const stmt = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_b2b_statements_mst (tenant_org_id, customer_id, statement_no)
    VALUES (${tenantId}::uuid, ${cust[0].id}::uuid, ${`FT5-${randomUUID()}`})
    RETURNING id`;
  return stmt[0].id;
}
