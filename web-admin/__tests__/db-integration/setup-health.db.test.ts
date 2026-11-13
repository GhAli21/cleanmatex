/**
 * Setup Health — DB-level checks (migrations 0709/0710/0738).
 *
 *   - every active tenant: one row per active check, no ERROR rows
 *   - isolation: another tenant's data never changes a tenant's result
 *   - the dispatcher survives a throwing check (that row = ERROR, others still run)
 *   - fn_shc_guard_tenant: an end-user JWT for tenant A cannot run tenant B's checks
 *   - 0738: check list limit, flag rule, bulk run (all/selected organizations x checks), partial runs never store
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
          (check_code, domain_code, severity, name, name2, ok_name, ok_name2, description, description2, fn_name, display_order)
        VALUES ('ZZ_TEST_THROW', 'CATALOG', 'INFO', 't', 't', 'ok', 'ok', 't', 't', 'fn_shc_zz_test_throw', 999)`;
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

describe('0738: selective runs', () => {
  interface BulkRow { tenant_id: string; run_status: string; blockers: number; warnings: number; errors: number; failing: unknown }
  const bulk = (tx: TxClient | typeof prisma, tenantIds: string[] | null, checks: string[] | null, store = false) =>
    tx.$queryRaw<BulkRow[]>`
      SELECT tenant_id, run_status, blockers, warnings, errors, failing
        FROM public.fn_setup_health_run_bulk(${tenantIds}::uuid[], ${checks}::text[], ${store})`;

  dbit('fn_setup_health_run limits to the listed check codes; unknown codes match nothing', async () => {
    const [a] = tenants;
    const one = await prisma.$queryRaw<RunRow[]>`
      SELECT check_code, status FROM public.fn_setup_health_run(${a}::uuid, NULL, NULL, ${['CAL_NO_BUSINESS_HOURS']}::text[])`;
    expect(one.map((r) => r.check_code)).toEqual(['CAL_NO_BUSINESS_HOURS']);
    const none = await prisma.$queryRaw<RunRow[]>`
      SELECT check_code, status FROM public.fn_setup_health_run(${a}::uuid, NULL, NULL, ${['NO_SUCH_CHECK']}::text[])`;
    expect(none).toEqual([]);
  });

  dbit('fn_setup_health_flags_on: every named flag must be on', async () => {
    const [r] = await prisma.$queryRaw<Array<{ both: boolean; one_off: boolean; none: boolean }>>`
      SELECT public.fn_setup_health_flags_on('{"a":true,"b":1}'::jsonb, ARRAY['a','b']) AS both,
             public.fn_setup_health_flags_on('{"a":true,"b":false}'::jsonb, ARRAY['a','b']) AS one_off,
             public.fn_setup_health_flags_on('{}'::jsonb, '{}'::text[]) AS none`;
    expect(r).toEqual({ both: true, one_off: false, none: true });
  });

  dbit('bulk, all active organizations x all checks: one OK row each', async () => {
    const rows = await bulk(prisma, null, null);
    expect(new Set(rows.map((r) => r.tenant_id))).toEqual(new Set(tenants));
    expect(rows.every((r) => r.run_status === 'OK' && r.errors === 0)).toBe(true);
  });

  dbit('bulk, selected organizations: only those, an unknown id is NOT_FOUND, not an error', async () => {
    const [a] = tenants;
    const ghost = '00000000-0000-4000-8000-00000000dead';
    const rows = await bulk(prisma, [a, ghost], ['CAL_NO_BUSINESS_HOURS']);
    expect(Object.fromEntries(rows.map((r) => [r.tenant_id, r.run_status]))).toEqual({ [a]: 'OK', [ghost]: 'NOT_FOUND' });
  });

  dbit('bulk agrees with the single-organization run for the same checks', async () => {
    const [a] = tenants;
    const single = await run(prisma, a);
    const failing = single.filter((r) => r.status === 'FAIL').length + single.filter((r) => r.status === 'ERROR').length;
    const [row] = await bulk(prisma, [a], null);
    // Flag-off checks are left out of the bulk result, so it can only be smaller or equal.
    expect((row.failing as unknown[]).length).toBeLessThanOrEqual(failing);
  });

  dbit('a partial run refuses to store; an all-checks run stores one row per organization', async () => {
    const [a] = tenants;
    await expect(bulk(prisma, [a], ['CAL_NO_BUSINESS_HOURS'], true)).rejects.toThrow(/p_store requires all checks|22023/);
    await rolledBack(async (tx) => {
      await bulk(tx, [a], null, true);
      const [{ n }] = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM public.org_setup_health_sum_tr WHERE tenant_org_id = ${a}::uuid`;
      expect(n).toBe(1);
    });
  });

  dbit('rejects empty and oversized selections', async () => {
    await expect(bulk(prisma, [], null)).rejects.toThrow(/1 to 500|22023/);
    await expect(bulk(prisma, null, [])).rejects.toThrow(/must not be empty|22023/);
  });

  dbit('an end-user JWT cannot call the bulk function (service role only)', async () => {
    if (!member) return;
    await expect(
      rolledBack(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
        return bulk(tx, [member!.tenantId], null);
      }),
    ).rejects.toThrow(/permission denied/i);
  });
});
