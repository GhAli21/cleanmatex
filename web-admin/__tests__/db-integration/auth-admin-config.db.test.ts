/**
 * Real-Postgres proof for migration 0570 (auth admin config). Every write runs in a transaction that
 * is always rolled back.
 *
 * Covers: tenant override is accepted only for tenant-changeable items within bounds, platform-only
 * items reject overrides, reset/reactivate, the effective resolver (PLATFORM / TENANT /
 * PLATFORM_ENFORCED), CONFIG_CHANGED audit rows, API-role privileges, and the lockout thresholds now
 * coming from the catalog.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class RollbackMarker extends Error {}

let ready = false;
let tenantId = '';

async function rolledBack<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result!: T;
  await prisma
    .$transaction(async (tx) => {
      result = await fn(tx);
      throw new RollbackMarker();
    })
    .catch((err) => {
      if (!(err instanceof RollbackMarker)) throw err;
    });
  return result;
}

const dbit = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!ready) return;
    await fn();
  });

type Effective = { config_code: string; source: string; effective_value: string; tenant_value: string | null };

async function effective(tx: Tx, code: string): Promise<Effective> {
  const rows = await tx.$queryRaw<Effective[]>`
    SELECT config_code, source, effective_value, tenant_value
    FROM public.fn_auth_config_effective(${tenantId}::uuid) WHERE config_code = ${code}`;
  return rows[0];
}

beforeAll(async () => {
  try {
    const schema = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'org_auth_admin_config_cf')
              AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auth_config_effective')) AS ok`;
    if (!schema[0]?.ok) return;
    const t = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.org_tenants_mst LIMIT 1`;
    tenantId = t[0]?.id ?? '';
    ready = Boolean(tenantId);
  } catch {
    ready = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('catalog seed', () => {
  dbit('has the 10 items; the 3 lockout items are platform-managed, the other 7 tenant-changeable', async () => {
    const rows = await prisma.$queryRaw<Array<{ config_group: string; changeable: boolean; n: bigint }>>`
      SELECT config_group, is_allow_tenant_change AS changeable, count(*) AS n
      FROM public.sys_auth_admin_config_cf GROUP BY 1, 2 ORDER BY 1, 2`;
    const lockout = rows.filter((r) => r.config_group === 'LOCKOUT');
    expect(lockout).toHaveLength(1);
    expect(lockout[0].changeable).toBe(false);
    expect(Number(lockout[0].n)).toBe(3);
    const changeable = rows.filter((r) => r.changeable).reduce((s, r) => s + Number(r.n), 0);
    expect(changeable).toBe(7);
  });
});

describe('tenant override guard', () => {
  dbit('accepts a valid override and resolves it as TENANT', async () => {
    const e = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${tenantId}::uuid, 'AUTH_IDLE_TIMEOUT_MIN', '45')`;
      return effective(tx, 'AUTH_IDLE_TIMEOUT_MIN');
    });
    expect(e.source).toBe('TENANT');
    expect(e.effective_value).toBe('45');
    expect(e.tenant_value).toBe('45');
  });

  dbit('rejects an override of a platform-managed item', async () => {
    await expect(
      rolledBack((tx) =>
        tx.$executeRaw`
          INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
          VALUES (${tenantId}::uuid, 'AUTH_LOCKOUT_MAX_ATTEMPTS', '10')`,
      ),
    ).rejects.toThrow(/managed by the platform|42501/i);
  });

  dbit('rejects out-of-range, non-numeric and non-enum values', async () => {
    const bad: Array<[string, string]> = [
      ['AUTH_IDLE_TIMEOUT_MIN', '9999'],
      ['AUTH_IDLE_TIMEOUT_MIN', 'abc'],
      ['AUTH_NEW_DEVICE_ALERT', 'maybe'],
      ['AUTH_SESSION_LIMIT_POLICY', 'DROP_ALL'],
    ];
    for (const [code, value] of bad) {
      await expect(
        rolledBack((tx) =>
          tx.$executeRaw`
            INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
            VALUES (${tenantId}::uuid, ${code}, ${value})`,
        ),
      ).rejects.toThrow(/not valid for auth config item|23514/i);
    }
  });

  dbit('reset (deactivate) returns to PLATFORM; re-activating reapplies the override', async () => {
    const out = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${tenantId}::uuid, 'AUTH_SESSION_MAX_HOURS', '24')`;
      const set = await effective(tx, 'AUTH_SESSION_MAX_HOURS');
      await tx.$executeRaw`
        UPDATE public.org_auth_admin_config_cf SET is_active = false, rec_status = 0
        WHERE tenant_org_id = ${tenantId}::uuid AND config_code = 'AUTH_SESSION_MAX_HOURS'`;
      const reset = await effective(tx, 'AUTH_SESSION_MAX_HOURS');
      await tx.$executeRaw`
        UPDATE public.org_auth_admin_config_cf SET is_active = true, rec_status = 1
        WHERE tenant_org_id = ${tenantId}::uuid AND config_code = 'AUTH_SESSION_MAX_HOURS'`;
      const again = await effective(tx, 'AUTH_SESSION_MAX_HOURS');
      return { set, reset, again };
    });
    expect(out.set.source).toBe('TENANT');
    expect(out.reset.source).toBe('PLATFORM');
    expect(out.reset.effective_value).toBe('12');
    expect(out.again.source).toBe('TENANT');
    expect(out.again.effective_value).toBe('24');
  });

  dbit('one override per tenant per item', async () => {
    await expect(
      rolledBack(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
          VALUES (${tenantId}::uuid, 'AUTH_REMEMBER_ME_DAYS', '3')`;
        await tx.$executeRaw`
          INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
          VALUES (${tenantId}::uuid, 'AUTH_REMEMBER_ME_DAYS', '4')`;
      }),
    ).rejects.toThrow(/uq_org_auth_cfg_tenant_code|already exists|23505/i);
  });
});

describe('PLATFORM_ENFORCED after an HQ change', () => {
  dbit('an override becomes PLATFORM_ENFORCED when HQ disallows it or tightens the bounds', async () => {
    const out = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${tenantId}::uuid, 'AUTH_IDLE_TIMEOUT_MIN', '300')`;
      // HQ tightens the max below the tenant's value.
      await tx.$executeRaw`UPDATE public.sys_auth_admin_config_cf SET max_value = 120 WHERE config_code = 'AUTH_IDLE_TIMEOUT_MIN'`;
      const tightened = await effective(tx, 'AUTH_IDLE_TIMEOUT_MIN');

      // Restore the bounds, then HQ disallows tenant changes entirely.
      await tx.$executeRaw`UPDATE public.sys_auth_admin_config_cf SET max_value = 480 WHERE config_code = 'AUTH_IDLE_TIMEOUT_MIN'`;
      await tx.$executeRaw`UPDATE public.sys_auth_admin_config_cf SET is_allow_tenant_change = false WHERE config_code = 'AUTH_IDLE_TIMEOUT_MIN'`;
      const disallowed = await effective(tx, 'AUTH_IDLE_TIMEOUT_MIN');
      return { tightened, disallowed };
    });
    expect(out.tightened.source).toBe('PLATFORM_ENFORCED');
    expect(out.tightened.effective_value).toBe('30');
    expect(out.disallowed.source).toBe('PLATFORM_ENFORCED');
    expect(out.disallowed.effective_value).toBe('30');
  });
});

describe('audit', () => {
  dbit('override changes log CONFIG_CHANGED with tenant, action and old/new values', async () => {
    const rows = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${tenantId}::uuid, 'AUTH_IDLE_WARNING_SEC', '90')`;
      await tx.$executeRaw`
        UPDATE public.org_auth_admin_config_cf SET config_value = '120'
        WHERE tenant_org_id = ${tenantId}::uuid AND config_code = 'AUTH_IDLE_WARNING_SEC'`;
      await tx.$executeRaw`
        UPDATE public.org_auth_admin_config_cf SET is_active = false, rec_status = 0
        WHERE tenant_org_id = ${tenantId}::uuid AND config_code = 'AUTH_IDLE_WARNING_SEC'`;
      return tx.$queryRaw<Array<{ tenant_org_id: string; details: Record<string, string | null> }>>`
        SELECT tenant_org_id::text, details
        FROM public.sys_auth_audit_log
        WHERE event_code = 'CONFIG_CHANGED' AND details->>'config_code' = 'AUTH_IDLE_WARNING_SEC'
          AND tenant_org_id = ${tenantId}::uuid
        ORDER BY created_at, id`;
    });
    // Rows written in one transaction share created_at (now() = transaction start), so assert as a set.
    expect(rows.map((r) => r.details.action).sort()).toEqual(['CHANGE', 'RESET', 'SET']);
    const change = rows.find((r) => r.details.action === 'CHANGE');
    expect(change?.details.old_value).toBe('90');
    expect(change?.details.new_value).toBe('120');
    expect(rows.every((r) => r.details.scope === 'TENANT' && r.tenant_org_id === tenantId)).toBe(true);
  });

  dbit('platform catalog changes log CONFIG_CHANGED with NULL tenant', async () => {
    const rows = await rolledBack(async (tx) => {
      await tx.$executeRaw`UPDATE public.sys_auth_admin_config_cf SET config_value = '20' WHERE config_code = 'AUTH_REMEMBER_ME_DAYS'`;
      return tx.$queryRaw<Array<{ tenant_org_id: string | null; details: Record<string, string> }>>`
        SELECT tenant_org_id::text, details FROM public.sys_auth_audit_log
        WHERE event_code = 'CONFIG_CHANGED' AND details->>'config_code' = 'AUTH_REMEMBER_ME_DAYS'
        ORDER BY created_at DESC LIMIT 1`;
    });
    expect(rows[0].tenant_org_id).toBeNull();
    expect(rows[0].details.scope).toBe('PLATFORM');
    expect(rows[0].details.old_value).toBe('7');
    expect(rows[0].details.new_value).toBe('20');
  });
});

describe('privileges and lockout wiring', () => {
  dbit('anon/authenticated cannot write config; resolver is service_role only', async () => {
    const r = await prisma.$queryRaw<Array<Record<string, boolean>>>`
      SELECT has_table_privilege('authenticated','public.sys_auth_admin_config_cf','UPDATE')  AS auth_upd_sys,
             has_table_privilege('authenticated','public.org_auth_admin_config_cf','INSERT')  AS auth_ins_org,
             has_table_privilege('anon','public.sys_auth_admin_config_cf','SELECT')           AS anon_sel_sys,
             has_table_privilege('anon','public.org_auth_admin_config_cf','SELECT')           AS anon_sel_org,
             has_function_privilege('authenticated','public.fn_auth_config_effective(uuid)','EXECUTE') AS auth_eff,
             has_function_privilege('anon','public.fn_auth_config_effective(uuid)','EXECUTE')          AS anon_eff,
             has_function_privilege('service_role','public.fn_auth_config_effective(uuid)','EXECUTE')  AS svc_eff`;
    expect(r[0]).toEqual({
      auth_upd_sys: false, auth_ins_org: false, anon_sel_sys: false, anon_sel_org: false,
      auth_eff: false, anon_eff: false, svc_eff: true,
    });
  });

  dbit('record_login_attempt honours AUTH_LOCKOUT_MAX_ATTEMPTS from the catalog', async () => {
    const m = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT au.email::text AS email FROM auth.users au
      JOIN public.org_users_mst ou ON ou.user_id = au.id LIMIT 1`;
    if (!m[0]) return;
    const email = m[0].email;
    const out = await rolledBack(async (tx) => {
      // Lower the threshold to 3 attempts; the third failure must lock.
      await tx.$executeRaw`UPDATE public.sys_auth_admin_config_cf SET config_value = '3' WHERE config_code = 'AUTH_LOCKOUT_MAX_ATTEMPTS'`;
      await tx.$executeRaw`UPDATE public.org_users_mst SET failed_login_attempts = 0, last_failed_login_at = NULL, locked_until = NULL
                           WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})`;
      const results: boolean[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await tx.$queryRaw<Array<{ is_locked: boolean }>>`
          SELECT is_locked FROM public.record_login_attempt(${email}, false, NULL, NULL, 'test')`;
        results.push(r[0].is_locked);
      }
      return results;
    });
    expect(out).toEqual([false, false, true]);
  });
});
