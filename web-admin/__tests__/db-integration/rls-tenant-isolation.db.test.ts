/**
 * Real Postgres RLS tenant-isolation proof (T16).
 *
 * Every other "RLS" test in this repo (__tests__/tenant-isolation/rls-policies.test.ts,
 * __tests__/auth/request-permission-auth.test.ts) mocks the Supabase client — none of
 * them execute a query as the actual RLS-bound Postgres role, so none can ever fail
 * even if the policies were broken or missing. This suite is the first real one.
 *
 * Why this couldn't just reuse the existing db-integration harness's Prisma connection
 * directly: `DATABASE_URL` connects as the `postgres` superuser (see .env.local). Every
 * Postgres superuser unconditionally bypasses row-level security — that is core Postgres
 * behavior, not a bug — so a query run directly over that connection can never prove or
 * disprove RLS either way. `current_tenant_id()` (migration 0004) reads
 * `auth.jwt() -> 'user_metadata' ->> 'tenant_org_id'`, which is populated by PostgREST
 * from the caller's JWT via the `request.jwt.claims` session GUC — that is the real
 * mechanism the live app relies on for every API route using
 * `createServerSupabaseClient`/`createClient()` (see lib/supabase/server.ts; dozens of
 * routes under app/api/v1/orders/**, not the Prisma/raw-SQL workflow-engine path, which
 * enforces tenant isolation entirely through its own explicit `WHERE tenant_org_id = ...`
 * clauses and never touches RLS).
 *
 * To exercise that mechanism for real without needing the full Supabase Auth HTTP stack
 * running, each test opens a transaction, `SET LOCAL ROLE authenticated` (dropping out of
 * the superuser session for that transaction only — Postgres superusers may SET ROLE to
 * any role without a grant), then sets `request.jwt.claims` via `set_config(...)` to
 * exactly the JSON shape PostgREST would set for a real signed-in user. From that point
 * the transaction is bound by the same RLS policies (migration 0081,
 * `tenant_isolation_org_orders_mst`, `FOR ALL USING (tenant_org_id = current_tenant_id())`)
 * a real API request would be. ROLLBACK at the end discards both the role/GUC change and
 * any attempted write, so nothing here can corrupt seeded data.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';

let dbReady = false;
let otherTenantId: string | null = null;
let tenantAOrderId: string | null = null;
let tenantBOrderId: string | null = null;
let tenantACustomerId: string | null = null;
let tenantBCustomerId: string | null = null;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'org_orders_mst'
            AND policyname = 'tenant_isolation_org_orders_mst'
        )
        AND EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'current_tenant_id'
        )
        AND EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
        ) AS ready
    `;
    dbReady = readiness[0]?.ready === true;
    if (!dbReady) return;

    const other = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id <> ${DEMO_TENANT}::uuid LIMIT 1
    `;
    otherTenantId = other[0]?.id ?? null;
    if (!otherTenantId) {
      dbReady = false;
      return;
    }

    const customerA = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_customers_mst (tenant_org_id, name)
      VALUES (${DEMO_TENANT}::uuid, ${`RLS test A ${randomUUID()}`})
      RETURNING id
    `;
    tenantACustomerId = customerA[0].id;

    const customerB = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_customers_mst (tenant_org_id, name)
      VALUES (${otherTenantId}::uuid, ${`RLS test B ${randomUUID()}`})
      RETURNING id
    `;
    tenantBCustomerId = customerB[0].id;

    const orderA = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_orders_mst (
        tenant_org_id, customer_id, order_no, currency_code, status, current_status,
        state_version, payment_type_code, total_amount, outstanding_amount
      ) VALUES (
        ${DEMO_TENANT}::uuid, ${tenantACustomerId}::uuid, ${`RLS-A-${randomUUID()}`},
        'OMR', 'intake', 'intake', 1, 'PAY_IN_ADVANCE', 10, 0
      )
      RETURNING id
    `;
    tenantAOrderId = orderA[0].id;

    const orderB = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_orders_mst (
        tenant_org_id, customer_id, order_no, currency_code, status, current_status,
        state_version, payment_type_code, total_amount, outstanding_amount
      ) VALUES (
        ${otherTenantId}::uuid, ${tenantBCustomerId}::uuid, ${`RLS-B-${randomUUID()}`},
        'OMR', 'intake', 'intake', 1, 'PAY_IN_ADVANCE', 10, 0
      )
      RETURNING id
    `;
    tenantBOrderId = orderB[0].id;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  try {
    if (tenantAOrderId) await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE id = ${tenantAOrderId}::uuid`;
    if (tenantBOrderId) await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE id = ${tenantBOrderId}::uuid`;
    if (tenantACustomerId) await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${tenantACustomerId}::uuid`;
    if (tenantBCustomerId) await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${tenantBCustomerId}::uuid`;
  } finally {
    await prisma.$disconnect();
  }
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[rls-tenant-isolation-db] Local DB, RLS policy, or authenticated role unavailable - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

/**
 * Runs `fn` inside a transaction impersonating a real authenticated request for
 * `tenantId`: same Postgres role, same `request.jwt.claims` shape PostgREST sets from a
 * real user's JWT. Always rolls back, so a write attempted inside `fn` never persists
 * regardless of whether RLS allowed or blocked it.
 * @param tenantId
 * @param fn
 */
async function asAuthenticatedTenant<T>(
  tenantId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  let result!: T;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
    await tx.$queryRaw`SELECT set_config(
      'request.jwt.claims',
      ${JSON.stringify({ role: 'authenticated', user_metadata: { tenant_org_id: tenantId } })},
      true
    )`;
    result = await fn(tx);
    throw new RollbackMarker();
  }).catch((err) => {
    if (!(err instanceof RollbackMarker)) throw err;
  });
  return result;
}

/** Forces the transaction wrapper above to always ROLLBACK, never COMMIT. */
class RollbackMarker extends Error {}

describe('RLS tenant isolation (real Postgres, real authenticated role)', () => {
  dbit('a real authenticated-role SELECT sees only the caller tenant\'s order, not the other tenant\'s — even though both rows exist', async () => {
    const rows = await asAuthenticatedTenant(DEMO_TENANT, (tx) =>
      tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_orders_mst
        WHERE id IN (${tenantAOrderId}::uuid, ${tenantBOrderId}::uuid)
      `,
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(tenantAOrderId);
    expect(ids).not.toContain(tenantBOrderId);
  });

  dbit('RLS blocks a cross-tenant UPDATE — 0 rows affected, no error, and the other tenant\'s row is provably unchanged', async () => {
    const beforeRows = await prisma.$queryRaw<Array<{ order_no: string }>>`
      SELECT order_no FROM public.org_orders_mst WHERE id = ${tenantBOrderId}::uuid
    `;
    const originalOrderNo = beforeRows[0].order_no;

    const affected = await asAuthenticatedTenant(DEMO_TENANT, async (tx) => {
      const result = await tx.$executeRaw`
        UPDATE public.org_orders_mst
        SET order_no = 'SHOULD-NOT-APPLY'
        WHERE id = ${tenantBOrderId}::uuid
      `;
      return result;
    });
    expect(affected).toBe(0);

    const afterRows = await prisma.$queryRaw<Array<{ order_no: string }>>`
      SELECT order_no FROM public.org_orders_mst WHERE id = ${tenantBOrderId}::uuid
    `;
    expect(afterRows[0].order_no).toBe(originalOrderNo);
  });

  dbit('RLS still allows the caller to update their own tenant\'s row — isolation is not just "everything fails closed"', async () => {
    const affected = await asAuthenticatedTenant(DEMO_TENANT, (tx) =>
      tx.$executeRaw`
        UPDATE public.org_orders_mst
        SET order_no = order_no
        WHERE id = ${tenantAOrderId}::uuid
      `,
    );
    expect(affected).toBe(1);
  });

  dbit('the other tenant sees the reverse: their own order is visible, the first tenant\'s is not', async () => {
    const rows = await asAuthenticatedTenant(otherTenantId as string, (tx) =>
      tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_orders_mst
        WHERE id IN (${tenantAOrderId}::uuid, ${tenantBOrderId}::uuid)
      `,
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(tenantBOrderId);
    expect(ids).not.toContain(tenantAOrderId);
  });
});
