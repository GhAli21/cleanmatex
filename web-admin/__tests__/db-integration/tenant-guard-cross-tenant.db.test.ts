/**
 * Tenant Guard — real-Postgres proof that a cross-tenant Prisma read/write fails
 * (Tenant Guard Restoration package, docs/features/Tenant_Guard_Restoration/).
 *
 * Why this is needed on top of rls-tenant-isolation.db.test.ts: Prisma connects as the
 * `postgres` superuser, which bypasses RLS. So on the Prisma path the ONLY tenant
 * barrier is application code — the explicit tenant_org_id filter, now checked by the
 * $extends guard. This suite runs the real exported `prisma` singleton (extensions
 * included) in `enforce` mode against real rows of two tenants and shows:
 *  - the cross-tenant row provably exists and is reachable when the guard is bypassed
 *    (so every rejection below is meaningful, not vacuous);
 *  - an unscoped by-id read/update/delete of tenant B's row under tenant A is rejected
 *    before it reaches the database, and B's row stays unchanged;
 *  - naming tenant B while in tenant A's context is rejected (TENANT_MISMATCH);
 *  - a correctly scoped query for B's id under tenant A returns nothing;
 *  - interactive $transaction clients are guarded too.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { TenantGuardViolationError, withTenantGuardBypass } from '@/lib/db/tenant-guard';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ORIGINAL_MODE = process.env.TENANT_GUARD_MODE;

let dbReady = false;
let tenantB: string | null = null;
let customerA: string | null = null;
let customerB: string | null = null;
let orderA: string | null = null;
let orderB: string | null = null;
let orderBNo = '';

/** Seed through raw SQL: fixtures are deliberately outside the guarded model API. */
async function seedOrder(tenantId: string, customerId: string, orderNo: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (
      tenant_org_id, customer_id, order_no, currency_code, status, current_status,
      state_version, payment_type_code, total_amount, outstanding_amount
    ) VALUES (
      ${tenantId}::uuid, ${customerId}::uuid, ${orderNo},
      'OMR', 'intake', 'intake', 1, 'PAY_IN_ADVANCE', 10, 0
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function seedCustomer(tenantId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${tenantId}::uuid, ${`TenantGuard test ${randomUUID()}`})
    RETURNING id
  `;
  return rows[0].id;
}

beforeAll(async () => {
  process.env.TENANT_GUARD_MODE = 'enforce';
  try {
    const other = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id <> ${DEMO_TENANT}::uuid LIMIT 1
    `;
    tenantB = other[0]?.id ?? null;
    const demo = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id = ${DEMO_TENANT}::uuid
    `;
    if (!tenantB || demo.length === 0) return;

    customerA = await seedCustomer(DEMO_TENANT);
    customerB = await seedCustomer(tenantB);
    orderA = await seedOrder(DEMO_TENANT, customerA, `TG-A-${randomUUID()}`);
    orderBNo = `TG-B-${randomUUID()}`;
    orderB = await seedOrder(tenantB, customerB, orderBNo);
    dbReady = true;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  process.env.TENANT_GUARD_MODE = ORIGINAL_MODE;
  try {
    for (const id of [orderA, orderB]) {
      if (id) await prisma.$executeRaw`DELETE FROM public.org_orders_mst WHERE id = ${id}::uuid`;
    }
    for (const id of [customerA, customerB]) {
      if (id) await prisma.$executeRaw`DELETE FROM public.org_customers_mst WHERE id = ${id}::uuid`;
    }
  } finally {
    await prisma.$disconnect();
  }
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[tenant-guard-cross-tenant-db] Local DB or second tenant unavailable - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

/** Read B's order_no through raw SQL to prove it was not modified. */
async function readOrderBNo(): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<Array<{ order_no: string }>>`
    SELECT order_no FROM public.org_orders_mst WHERE id = ${orderB}::uuid
  `;
  return rows[0]?.order_no;
}

describe('Tenant Guard — cross-tenant access through the real Prisma client (enforce mode)', () => {
  dbit('control: tenant B\'s order exists and an unguarded by-id read would return it', async () => {
    const row = await withTenantGuardBypass('db-test-control', () =>
      prisma.org_orders_mst.findUnique({ where: { id: orderB! }, select: { id: true, tenant_org_id: true } })
    );
    expect(row?.id).toBe(orderB);
    expect(row?.tenant_org_id).toBe(tenantB);
  });

  dbit('an unscoped by-id read of tenant B\'s order under tenant A is rejected', async () => {
    await expect(
      withTenantContext(DEMO_TENANT, () => prisma.org_orders_mst.findUnique({ where: { id: orderB! } }))
    ).rejects.toBeInstanceOf(TenantGuardViolationError);
    await expect(
      withTenantContext(DEMO_TENANT, () => prisma.org_orders_mst.findFirst({ where: { order_no: orderBNo } }))
    ).rejects.toThrow(/MISSING_TENANT_FILTER/);
  });

  dbit('an unscoped read is rejected even with no tenant context at all', async () => {
    await expect(prisma.org_orders_mst.findMany({ where: { id: orderB! } })).rejects.toBeInstanceOf(
      TenantGuardViolationError
    );
  });

  dbit('naming tenant B while in tenant A\'s context is rejected (TENANT_MISMATCH)', async () => {
    await expect(
      withTenantContext(DEMO_TENANT, () =>
        prisma.org_orders_mst.findFirst({ where: { id: orderB!, tenant_org_id: tenantB! } })
      )
    ).rejects.toThrow(/TENANT_MISMATCH/);
  });

  dbit('a correctly scoped query for tenant B\'s id under tenant A returns nothing', async () => {
    const row = await withTenantContext(DEMO_TENANT, (tenantId) =>
      prisma.org_orders_mst.findFirst({ where: { id: orderB!, tenant_org_id: tenantId } })
    );
    expect(row).toBeNull();
    const own = await withTenantContext(DEMO_TENANT, (tenantId) =>
      prisma.org_orders_mst.findFirst({ where: { id: orderA!, tenant_org_id: tenantId }, select: { id: true } })
    );
    expect(own?.id).toBe(orderA);
  });

  dbit('unscoped update/delete of tenant B\'s order are rejected and the row is unchanged', async () => {
    await expect(
      withTenantContext(DEMO_TENANT, () =>
        prisma.org_orders_mst.update({ where: { id: orderB! }, data: { order_no: 'SHOULD-NOT-APPLY' } })
      )
    ).rejects.toBeInstanceOf(TenantGuardViolationError);
    await expect(
      withTenantContext(DEMO_TENANT, () => prisma.org_orders_mst.updateMany({ where: { id: orderB! }, data: { order_no: 'X' } }))
    ).rejects.toBeInstanceOf(TenantGuardViolationError);
    await expect(
      withTenantContext(DEMO_TENANT, () => prisma.org_orders_mst.delete({ where: { id: orderB! } }))
    ).rejects.toBeInstanceOf(TenantGuardViolationError);
    expect(await readOrderBNo()).toBe(orderBNo);
  });

  dbit('a query created inside tenant A\'s context but awaited outside it is still checked against A', async () => {
    let pending: Promise<unknown> | null = null;
    await withTenantContext(DEMO_TENANT, async () => {
      pending = prisma.org_orders_mst.findFirst({ where: { id: orderB!, tenant_org_id: tenantB! } });
    });
    await expect(pending).rejects.toThrow(/TENANT_MISMATCH/);
  });

  dbit('the violation names the real call site, not Prisma internals', async () => {
    const err = await prisma.org_orders_mst.findUnique({ where: { id: orderB! } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TenantGuardViolationError);
    expect((err as TenantGuardViolationError).violation.callsite).toContain('tenant-guard-cross-tenant.db.test.ts');
  });

  dbit('interactive $transaction clients are guarded too', async () => {
    await expect(
      withTenantContext(DEMO_TENANT, () =>
        prisma.$transaction((tx) => tx.org_orders_mst.findUnique({ where: { id: orderB! } }))
      )
    ).rejects.toBeInstanceOf(TenantGuardViolationError);
  });
});
