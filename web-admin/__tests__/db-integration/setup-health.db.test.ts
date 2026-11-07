/**
 * Setup Health — DB-level checks (migrations 0709/0710).
 *
 *   - every active tenant: one row per active check, no ERROR rows
 *   - isolation: another tenant's data never changes a tenant's result
 *   - the dispatcher survives a throwing check (that row = ERROR, others still run)
 *   - fn_shc_guard_tenant: an end-user JWT for tenant A cannot run tenant B's checks
 *
 * Every write runs in a rolled-back transaction. Skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
interface RunRow { check_code: string; status: string }

let dbUp = false;
let tenants: string[] = [];
let member: { userId: string; tenantId: string } | null = null;

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE is_active AND rec_status = 1 ORDER BY created_at`;
    tenants = rows.map((r) => r.id);
    const m = await prisma.$queryRaw<Array<{ user_id: string; tenant_org_id: string }>>`
      SELECT user_id, tenant_org_id FROM public.org_users_mst WHERE is_active LIMIT 1`;
    member = m[0] ? { userId: m[0].user_id, tenantId: m[0].tenant_org_id } : null;
    dbUp = tenants.length >= 2;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ROLLBACK = Symbol('setup-health-rollback');
async function rolledBack<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  let out: T | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      out = await fn(tx as TxClient);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return out as T;
}

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[setup-health.db] DB unavailable or < 2 tenants — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

const run = (tx: TxClient | typeof prisma, tenant: string) =>
  tx.$queryRaw<RunRow[]>`SELECT check_code, status FROM public.fn_setup_health_run(${tenant}::uuid, NULL, NULL)`;

describe('fn_setup_health_run', () => {
  dbit('returns one row per active check and no ERROR for every active tenant', async () => {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM public.sys_setup_health_check_cd WHERE is_active AND rec_status = 1`;
    for (const t of tenants) {
      const rows = await run(prisma, t);
      expect(rows).toHaveLength(n);
      expect(rows.filter((r) => r.status === 'ERROR')).toEqual([]);
    }
  });

  dbit("another tenant's data does not change a tenant's result", async () => {
    const [a, b] = tenants;
    const before = await run(prisma, a);
    const after = await rolledBack(async (tx) => {
      // Wipe tenant B's calendar and speed rules; tenant A must not notice.
      await tx.$executeRaw`UPDATE public.org_tenants_mst SET business_hours = NULL WHERE id = ${b}::uuid`;
      await tx.$executeRaw`UPDATE public.org_branches_mst SET business_hours = NULL WHERE tenant_org_id = ${b}::uuid`;
      await tx.$executeRaw`UPDATE public.org_speed_price_rules_cf SET is_active = false WHERE tenant_org_id = ${b}::uuid`;
      return run(tx, a);
    });
    expect(after).toEqual(before);
  });

  dbit('a throwing check returns ERROR for that row only', async () => {
    const [a] = tenants;
    const rows = await rolledBack(async (tx) => {
      await tx.$executeRawUnsafe(`
        CREATE FUNCTION public.fn_shc_zz_test_throw(p_tenant uuid, p_branch uuid) RETURNS jsonb
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$`);
      await tx.$executeRaw`
        INSERT INTO public.sys_setup_health_check_cd
          (check_code, domain_code, severity, name, name2, description, description2, fn_name, display_order)
        VALUES ('ZZ_TEST_THROW', 'CATALOG', 'INFO', 't', 't', 't', 't', 'fn_shc_zz_test_throw', 999)`;
      return run(tx, a);
    });
    expect(rows.find((r) => r.check_code === 'ZZ_TEST_THROW')?.status).toBe('ERROR');
    expect(rows.filter((r) => r.check_code !== 'ZZ_TEST_THROW' && r.status === 'ERROR')).toEqual([]);
  });
});

describe('fn_shc_guard_tenant', () => {
  async function asMember<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return rolledBack(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config('request.jwt.claims',
        ${JSON.stringify({ role: 'authenticated', sub: member!.userId })}, true)`;
      return fn(tx);
    });
  }

  dbit('lets a member run their own tenant', async () => {
    if (!member) return;
    const rows = await asMember((tx) => run(tx, member!.tenantId));
    expect(rows.length).toBeGreaterThan(0);
  });

  dbit("rejects a member asking for another tenant's checks", async () => {
    if (!member) return;
    const other = tenants.find((t) => t !== member!.tenantId)!;
    const [{ is_member }] = await prisma.$queryRaw<Array<{ is_member: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM public.org_users_mst
                     WHERE user_id = ${member.userId}::uuid AND tenant_org_id = ${other}::uuid AND is_active) AS is_member`;
    if (is_member) return; // user belongs to both tenants: nothing to reject
    await expect(asMember((tx) => run(tx, other))).rejects.toThrow(/tenant not accessible|42501/);
  });
});
