/**
 * Real-Postgres proof for migration 0581 (password management): the auth.users trigger records the replaced hash,
 * fn_auth_pwd_reuse_check blocks reuse within the configured depth only, the new PASSWORD config items are seeded
 * with the intended tenant-override flags, and the history table is closed to API roles.
 *
 * Writes happen inside a transaction that is always rolled back.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

let ready = false;
// 0585 makes history timestamps wall-clock; the ordering assertions need it when several changes share a transaction.
let hasClockDefault = false;

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_pwd_capture') AS ok`;
    ready = Boolean(rows[0]?.ok);
    const def = await prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sys_auth_pwd_history_dtl' AND column_name = 'created_at'`;
    hasClockDefault = (def[0]?.column_default ?? '').includes('clock_timestamp');
  } catch {
    ready = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const dbit = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!ready) return; // 0581 not applied on this database yet
    await fn();
  });

class Rollback extends Error {}

/** Run `work` inside a transaction and roll it back whatever happens. */
async function inRolledBackTx(work: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

describe('0581 — password history and reuse check', () => {
  dbit('records each replaced hash and blocks reuse only within the requested depth', async () => {
    if (!hasClockDefault) return; // needs 0585 (ordering of several changes inside one transaction)
    await inRolledBackTx(async (tx) => {
      const id = '00000000-0000-4000-8000-0000000000a1';
      await tx.$executeRawUnsafe(
        `INSERT INTO auth.users (id, aud, role, email, encrypted_password)
         VALUES ($1::uuid, 'authenticated', 'authenticated', 'pwd-history-test@example.invalid', extensions.crypt('Pass-One-1', extensions.gen_salt('bf')))`,
        id
      );
      for (const next of ['Pass-Two-2', 'Pass-Three-3', 'Pass-Four-4']) {
        await tx.$executeRawUnsafe(
          `UPDATE auth.users SET encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) WHERE id = $1::uuid`,
          id,
          next
        );
      }

      const history = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*)::bigint AS n FROM public.sys_auth_pwd_history_dtl WHERE auth_user_id = $1::uuid`,
        id
      );
      expect(Number(history[0].n)).toBe(3); // One, Two, Three were replaced; Four is current

      const reused = async (pw: string, depth: number) =>
        (await tx.$queryRawUnsafe<Array<{ r: boolean }>>(`SELECT public.fn_auth_pwd_reuse_check($1::uuid, $2::text, $3::integer) AS r`, id, pw, depth))[0].r;

      expect(await reused('Pass-Four-4', 1)).toBe(true); // current password, depth 1
      expect(await reused('Pass-Three-3', 1)).toBe(false); // previous one is outside depth 1
      expect(await reused('Pass-Three-3', 2)).toBe(true); // ...but inside depth 2
      expect(await reused('Pass-One-1', 3)).toBe(false); // oldest is outside depth 3 (current + 2 previous)
      expect(await reused('Pass-One-1', 4)).toBe(true);
      expect(await reused('Pass-Four-4', 0)).toBe(false); // depth 0 disables the rule
      expect(await reused('Brand-New-9', 24)).toBe(false);
    });
  });

  dbit('keeps no more than 24 history rows per user', async () => {
    await inRolledBackTx(async (tx) => {
      const id = '00000000-0000-4000-8000-0000000000a2';
      await tx.$executeRawUnsafe(
        `INSERT INTO auth.users (id, aud, role, email, encrypted_password)
         VALUES ($1::uuid, 'authenticated', 'authenticated', 'pwd-history-cap@example.invalid', extensions.crypt('Start-0', extensions.gen_salt('bf')))`,
        id
      );
      for (let i = 1; i <= 30; i++) {
        await tx.$executeRawUnsafe(
          `UPDATE auth.users SET encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) WHERE id = $1::uuid`,
          id,
          `Pass-${i}`
        );
      }
      const rows = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*)::bigint AS n FROM public.sys_auth_pwd_history_dtl WHERE auth_user_id = $1::uuid`,
        id
      );
      expect(Number(rows[0].n)).toBe(24);
    });
  });
});

describe('0581 — config items, events and grants', () => {
  dbit('seeds the four PASSWORD items with the intended tenant-override flags', async () => {
    const rows = await prisma.$queryRaw<Array<{ config_code: string; config_value: string; is_allow_tenant_change: boolean }>>`
      SELECT config_code, config_value, is_allow_tenant_change
        FROM public.sys_auth_admin_config_cf WHERE config_group = 'PASSWORD' ORDER BY config_code`;
    expect(rows).toEqual([
      { config_code: 'AUTH_PWD_BREACH_CHECK', config_value: 'true', is_allow_tenant_change: false },
      { config_code: 'AUTH_PWD_FRESH_SIGNIN_MIN', config_value: '15', is_allow_tenant_change: true },
      { config_code: 'AUTH_PWD_HISTORY_COUNT', config_value: '5', is_allow_tenant_change: true },
      { config_code: 'AUTH_PWD_REQUIRE_CURRENT', config_value: 'true', is_allow_tenant_change: true },
    ]);
  });

  dbit('registers the new audit events', async () => {
    const rows = await prisma.$queryRaw<Array<{ code: string }>>`
      SELECT code FROM public.sys_auth_event_cd
       WHERE code IN ('PASSWORD_RESET_BY_ADMIN', 'PASSWORD_RESET_LINK_SENT', 'ACCOUNT_UNLOCKED') ORDER BY code`;
    expect(rows.map((r) => r.code)).toEqual(['ACCOUNT_UNLOCKED', 'PASSWORD_RESET_BY_ADMIN', 'PASSWORD_RESET_LINK_SENT']);
  });

  dbit('closes the history table and the reuse check to API roles', async () => {
    const rows = await prisma.$queryRaw<Array<{ anon_tbl: boolean; auth_tbl: boolean; anon_fn: boolean; auth_fn: boolean; svc_fn: boolean }>>`
      SELECT has_table_privilege('anon', 'public.sys_auth_pwd_history_dtl', 'SELECT')          AS anon_tbl,
             has_table_privilege('authenticated', 'public.sys_auth_pwd_history_dtl', 'SELECT') AS auth_tbl,
             has_function_privilege('anon', 'public.fn_auth_pwd_reuse_check(uuid,text,integer)', 'EXECUTE')          AS anon_fn,
             has_function_privilege('authenticated', 'public.fn_auth_pwd_reuse_check(uuid,text,integer)', 'EXECUTE') AS auth_fn,
             has_function_privilege('service_role', 'public.fn_auth_pwd_reuse_check(uuid,text,integer)', 'EXECUTE')  AS svc_fn`;
    expect(rows[0]).toEqual({ anon_tbl: false, auth_tbl: false, anon_fn: false, auth_fn: false, svc_fn: true });
  });

  dbit('admin role holds users:reset_password', async () => {
    const rows = await prisma.$queryRaw<Array<{ role_code: string }>>`
      SELECT role_code FROM public.sys_auth_role_default_permissions
       WHERE permission_code = 'users:reset_password' AND is_enabled = true AND role_code IN ('super_admin', 'tenant_admin', 'admin')`;
    expect(rows.map((r) => r.role_code).sort()).toEqual(['admin', 'super_admin', 'tenant_admin']);
  });

  dbit('fn_auth_session_validate reports must_change_password for a user without a session (NO_SESSION shape)', async () => {
    const rows = await prisma.$queryRaw<Array<{ state: string; must_change_password: boolean }>>`
      SELECT state, must_change_password FROM public.fn_auth_session_validate(false, NULL)`;
    expect(rows[0]).toEqual({ state: 'NO_SESSION', must_change_password: false });
  });
});
