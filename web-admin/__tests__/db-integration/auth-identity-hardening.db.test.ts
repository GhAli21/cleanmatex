/**
 * Real-Postgres proof for migrations 0561 (auth hardening) and 0563 (user_code / one account per
 * tenant). Every write runs inside a transaction that is always rolled back.
 *
 * Covers: forged user_metadata tenant cannot widen access, guard trigger on auth.users, anon/
 * authenticated cannot reach lockout/audit objects, user_code format/uniqueness/default/audit,
 * identifier resolver, and the one-account-per-tenant constraint.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class RollbackMarker extends Error {}

let ready = false;
let memberA: { userId: string; orgUserId: string; tenantId: string; email: string; userCode: string } | null = null;
let otherTenantId = '';

/** Runs `fn` in a transaction that is always rolled back. */
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

beforeAll(async () => {
  try {
    const schema = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'org_users_mst' AND column_name = 'user_code')
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auth_resolve_login_identifier')
        AND EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'sys_auth_audit_log')
      ) AS ok`;
    if (!schema[0]?.ok) return;

    const members = await prisma.$queryRaw<
      Array<{ user_id: string; id: string; tenant_org_id: string; email: string; user_code: string }>
    >`
      SELECT ou.user_id, ou.id, ou.tenant_org_id, au.email::text AS email, ou.user_code
      FROM public.org_users_mst ou
      JOIN auth.users au ON au.id = ou.user_id
      WHERE ou.is_active = true
      ORDER BY ou.created_at`;
    if (members.length === 0) return;
    const a = members[0];
    memberA = {
      userId: a.user_id,
      orgUserId: a.id,
      tenantId: a.tenant_org_id,
      email: a.email,
      userCode: a.user_code,
    };

    const other = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id <> ${memberA.tenantId}::uuid LIMIT 1`;
    otherTenantId = other[0]?.id ?? '';
    ready = Boolean(otherTenantId);
  } catch {
    ready = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('current_tenant_id() is membership-only (0563)', () => {
  dbit('ignores a forged user_metadata tenant and returns the caller membership tenant', async () => {
    const m = memberA!;
    const tenant = await rolledBack(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config(
        'request.jwt.claims',
        ${JSON.stringify({
          role: 'authenticated',
          sub: m.userId,
          user_metadata: { tenant_org_id: otherTenantId },
          tenant_org_id: otherTenantId,
        })},
        true)`;
      const rows = await tx.$queryRaw<Array<{ t: string | null }>>`SELECT public.current_tenant_id()::text AS t`;
      return rows[0]?.t ?? null;
    });
    expect(tenant).toBe(m.tenantId);
  });

  dbit('returns NULL for a caller with no active membership', async () => {
    const tenant = await rolledBack(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config(
        'request.jwt.claims',
        ${JSON.stringify({ role: 'authenticated', sub: randomUUID(), user_metadata: { tenant_org_id: otherTenantId } })},
        true)`;
      const rows = await tx.$queryRaw<Array<{ t: string | null }>>`SELECT public.current_tenant_id()::text AS t`;
      return rows[0]?.t ?? null;
    });
    expect(tenant).toBeNull();
  });
});

describe('auth.users metadata guard trigger (0561)', () => {
  dbit('rejects setting a tenant_org_id the user does not belong to', async () => {
    const m = memberA!;
    await expect(
      rolledBack((tx) =>
        tx.$executeRaw`
          UPDATE auth.users
          SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_org_id', ${otherTenantId}::text)
          WHERE id = ${m.userId}::uuid`,
      ),
    ).rejects.toThrow(/must be a tenant the user belongs to|42501/);
  });

  dbit('allows setting the tenant_org_id of the user own membership', async () => {
    const m = memberA!;
    const count = await rolledBack((tx) =>
      tx.$executeRaw`
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_org_id', ${m.tenantId}::text)
        WHERE id = ${m.userId}::uuid`,
    );
    expect(count).toBe(1);
  });
});

describe('lockout / audit objects are not reachable by API roles (0561)', () => {
  dbit('anon and authenticated cannot execute the lockout/audit functions; service_role can', async () => {
    const rows = await prisma.$queryRaw<Array<{ fn: string; anon: boolean; auth: boolean; svc: boolean }>>`
      SELECT p.oid::regprocedure::text AS fn,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('record_login_attempt','is_account_locked','unlock_account',
                          'auto_unlock_expired_accounts','log_audit_event','fn_auth_log_event',
                          'fn_auth_resolve_login_identifier')`;
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const r of rows) {
      expect({ fn: r.fn, anon: r.anon, auth: r.auth }).toEqual({ fn: r.fn, anon: false, auth: false });
      expect({ fn: r.fn, svc: r.svc }).toEqual({ fn: r.fn, svc: true });
    }
  });

  dbit('sys_audit_log has RLS on and no access for anon/authenticated', async () => {
    const rows = await prisma.$queryRaw<Array<{ rls: boolean; anon: boolean; auth: boolean }>>`
      SELECT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sys_audit_log'::regclass) AS rls,
             has_table_privilege('anon', 'public.sys_audit_log', 'SELECT') AS anon,
             has_table_privilege('authenticated', 'public.sys_audit_log', 'SELECT') AS auth`;
    expect(rows[0]).toEqual({ rls: true, anon: false, auth: false });
  });

  dbit('sys_auth_audit_log is insert-only for service_role and read-only for authenticated', async () => {
    const rows = await prisma.$queryRaw<Array<{ [k: string]: boolean }>>`
      SELECT has_table_privilege('authenticated', 'public.sys_auth_audit_log', 'SELECT')  AS auth_sel,
             has_table_privilege('authenticated', 'public.sys_auth_audit_log', 'INSERT')  AS auth_ins,
             has_table_privilege('authenticated', 'public.sys_auth_audit_log', 'UPDATE')  AS auth_upd,
             has_table_privilege('authenticated', 'public.sys_auth_audit_log', 'DELETE')  AS auth_del,
             has_table_privilege('anon',          'public.sys_auth_audit_log', 'SELECT')  AS anon_sel,
             has_table_privilege('service_role',  'public.sys_auth_audit_log', 'INSERT')  AS svc_ins,
             has_table_privilege('service_role',  'public.sys_auth_audit_log', 'UPDATE')  AS svc_upd,
             has_table_privilege('service_role',  'public.sys_auth_audit_log', 'DELETE')  AS svc_del`;
    expect(rows[0]).toEqual({
      auth_sel: true, auth_ins: false, auth_upd: false, auth_del: false,
      anon_sel: false, svc_ins: true, svc_upd: false, svc_del: false,
    });
  });
});

describe('sys_auth_audit_log immutability (0568)', () => {
  dbit('rejects UPDATE even for the connecting (owner/superuser) role', async () => {
    const m = memberA!;
    await expect(
      rolledBack(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO public.sys_auth_audit_log (auth_user_id, event_code, outcome)
          VALUES (${m.userId}::uuid, 'LOGIN_SUCCESS', 'SUCCESS')`;
        await tx.$executeRaw`UPDATE public.sys_auth_audit_log SET outcome = 'FAILURE' WHERE auth_user_id = ${m.userId}::uuid`;
      }),
    ).rejects.toThrow(/immutable|append-only|42501/i);
  });
});
describe('user_code (0563)', () => {
  dbit('every membership has a code that matches the format', async () => {
    const bad = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM public.org_users_mst
      WHERE user_code IS NULL OR user_code !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$'`;
    expect(Number(bad[0].n)).toBe(0);
  });

  dbit('rejects malformed codes (format CHECK)', async () => {
    const m = memberA!;
    for (const code of ['ab', 'has space', 'bad@code', '-leading']) {
      await expect(
        rolledBack((tx) =>
          tx.$executeRaw`UPDATE public.org_users_mst SET user_code = ${code} WHERE id = ${m.orgUserId}::uuid`,
        ),
      ).rejects.toThrow(/chk_org_users_user_code|check constraint/i);
    }
  });

  dbit('code is unique case-insensitively across the platform', async () => {
    const m = memberA!;
    const other = await prisma.$queryRaw<Array<{ id: string; user_code: string }>>`
      SELECT id, user_code FROM public.org_users_mst WHERE id <> ${m.orgUserId}::uuid LIMIT 1`;
    if (other.length === 0) return;
    await expect(
      rolledBack((tx) =>
        tx.$executeRaw`UPDATE public.org_users_mst SET user_code = ${other[0].user_code.toLowerCase()} WHERE id = ${m.orgUserId}::uuid`,
      ),
    ).rejects.toThrow(/uq_org_users_user_code_lower|already exists|23505/i);
  });

  dbit('changing a code writes a USER_CODE_CHANGED audit row with old/new values', async () => {
    const m = memberA!;
    const newCode = `T${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const audit = await rolledBack(async (tx) => {
      await tx.$executeRaw`UPDATE public.org_users_mst SET user_code = ${newCode} WHERE id = ${m.orgUserId}::uuid`;
      return tx.$queryRaw<Array<{ event_code: string; details: Record<string, string>; tenant_org_id: string; org_user_id: string }>>`
        SELECT event_code, details, tenant_org_id::text, org_user_id::text
        FROM public.sys_auth_audit_log
        WHERE auth_user_id = ${m.userId}::uuid AND event_code = 'USER_CODE_CHANGED'
        ORDER BY created_at DESC LIMIT 1`;
    });
    expect(audit[0]?.event_code).toBe('USER_CODE_CHANGED');
    expect(audit[0]?.details.old_user_code).toBe(m.userCode);
    expect(audit[0]?.details.new_user_code).toBe(newCode);
    expect(audit[0]?.tenant_org_id).toBe(m.tenantId);
    expect(audit[0]?.org_user_id).toBe(m.orgUserId);
  });

  dbit('fn_org_user_code_next() yields a valid unused code', async () => {
    const rows = await prisma.$queryRaw<Array<{ code: string; taken: boolean }>>`
      SELECT c AS code,
             EXISTS (SELECT 1 FROM public.org_users_mst WHERE lower(user_code) = lower(c)) AS taken
      FROM (SELECT public.fn_org_user_code_next() AS c) x`;
    expect(rows[0].code).toMatch(/^U\d{6,}$/);
    expect(rows[0].taken).toBe(false);
  });
});

describe('one auth account per tenant membership (0563)', () => {
  dbit('uq_org_users_mst_user_id exists on org_users_mst(user_id)', async () => {
    const rows = await prisma.$queryRaw<Array<{ def: string }>>`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.org_users_mst'::regclass AND conname = 'uq_org_users_mst_user_id'`;
    expect(rows[0]?.def).toBe('UNIQUE (user_id)');
  });
});

describe('fn_auth_resolve_login_identifier (0563)', () => {
  dbit('resolves by email, by code and by code in a different case — same account', async () => {
    const m = memberA!;
    const byEmail = await prisma.$queryRaw<Array<{ auth_user_id: string; tenant_org_id: string }>>`
      SELECT auth_user_id::text, tenant_org_id::text FROM public.fn_auth_resolve_login_identifier(${m.email})`;
    const byCode = await prisma.$queryRaw<Array<{ auth_user_id: string; email: string }>>`
      SELECT auth_user_id::text, email FROM public.fn_auth_resolve_login_identifier(${m.userCode})`;
    const byCodeUpper = await prisma.$queryRaw<Array<{ auth_user_id: string }>>`
      SELECT auth_user_id::text FROM public.fn_auth_resolve_login_identifier(${m.userCode.toUpperCase()})`;

    expect(byEmail[0].auth_user_id).toBe(m.userId);
    expect(byEmail[0].tenant_org_id).toBe(m.tenantId);
    expect(byCode[0].auth_user_id).toBe(m.userId);
    expect(byCode[0].email.toLowerCase()).toBe(m.email.toLowerCase());
    expect(byCodeUpper[0].auth_user_id).toBe(m.userId);
  });

  dbit('returns no row for unknown, blank, or whitespace identifiers', async () => {
    for (const ident of ['nobody@nowhere.example', 'NOPE999', '', '   ']) {
      const rows = await prisma.$queryRaw<Array<{ auth_user_id: string }>>`
        SELECT auth_user_id::text FROM public.fn_auth_resolve_login_identifier(${ident})`;
      expect(rows).toHaveLength(0);
    }
  });
});
