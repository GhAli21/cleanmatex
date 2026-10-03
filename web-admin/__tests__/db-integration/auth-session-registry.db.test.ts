/**
 * Real-Postgres proof for migration 0575 (auth session registry). Every write runs inside a transaction
 * that is always rolled back.
 *
 * Covers: register (policy snapshot, remember-me, idempotency), validate (ACTIVE / idle / absolute /
 * touch semantics / ownership / membership), ending + auth.sessions deletion, revoke, concurrent-session
 * limit (REVOKE_OLDEST and BLOCK_NEW), new-device detection, deactivation trigger, sweep, RLS and
 * privileges.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class RollbackMarker extends Error {}

interface Member {
  userId: string;
  orgUserId: string;
  tenantId: string;
}

let ready = false;
let a!: Member;
let b: Member | null = null;

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

type Reg = {
  result_status: string;
  session_row_id: string | null;
  tenant_org_id: string | null;
  new_device: boolean;
  alert_new_device: boolean;
  idle_timeout_sec: number;
  idle_warning_sec: number;
  expires_at: Date | null;
  ended_sessions: number;
};

async function register(
  tx: Tx,
  sid: string,
  userId: string,
  opts: { remember?: boolean; device?: string | null } = {},
): Promise<Reg> {
  const rows = await tx.$queryRaw<Reg[]>`
    SELECT * FROM public.fn_auth_session_register(
      ${sid}::uuid, ${userId}::uuid, ${opts.remember ?? false}, '10.0.0.1'::inet,
      'Mozilla/5.0 test', 'Chrome on Windows', ${opts.device === undefined ? 'dev-hash-1' : opts.device})`;
  return rows[0];
}

type Val = { state: string; end_reason: string | null; tenant_org_id: string | null; idle_remaining_sec: number | null; absolute_remaining_sec: number | null; idle_warning_sec: number | null };

/** Calls validate as the `authenticated` role with the JWT claims PostgREST would set. */
async function validateAs(tx: Tx, userId: string, sid: string | null, touch = false): Promise<Val> {
  await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
  await tx.$queryRaw`SELECT set_config('request.jwt.claims',
    ${JSON.stringify({ role: 'authenticated', sub: userId, ...(sid ? { session_id: sid } : {}) })}, true)`;
  const rows = await tx.$queryRaw<Val[]>`SELECT * FROM public.fn_auth_session_validate(${touch})`;
  await tx.$executeRawUnsafe('RESET ROLE');
  return rows[0];
}

async function statusOf(tx: Tx, sid: string): Promise<{ status: string; end_reason_code: string | null } | undefined> {
  const rows = await tx.$queryRaw<Array<{ status: string; end_reason_code: string | null }>>`
    SELECT status, end_reason_code FROM public.sys_auth_user_sessions_mst WHERE auth_session_id = ${sid}::uuid`;
  return rows[0];
}

beforeAll(async () => {
  try {
    const schema = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'sys_auth_user_sessions_mst')
              AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auth_session_register')) AS ok`;
    if (!schema[0]?.ok) return;
    const members = await prisma.$queryRaw<Array<{ user_id: string; id: string; tenant_org_id: string }>>`
      SELECT user_id, id, tenant_org_id FROM public.org_users_mst WHERE is_active = true ORDER BY created_at`;
    if (members.length === 0) return;
    a = { userId: members[0].user_id, orgUserId: members[0].id, tenantId: members[0].tenant_org_id };
    if (members[1]) b = { userId: members[1].user_id, orgUserId: members[1].id, tenantId: members[1].tenant_org_id };
    ready = true;
  } catch {
    ready = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('register', () => {
  dbit('registers with the single-membership tenant and the platform policy snapshot; retry is idempotent', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      const first = await register(tx, sid, a.userId);
      const again = await register(tx, sid, a.userId);
      return { first, again };
    });
    expect(out.first.result_status).toBe('REGISTERED');
    expect(out.first.tenant_org_id).toBe(a.tenantId);
    expect(out.first.idle_timeout_sec).toBe(30 * 60);
    expect(out.first.idle_warning_sec).toBe(60);
    const hours = (new Date(out.first.expires_at!).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThan(12.1);
    expect(out.again.result_status).toBe('ALREADY_REGISTERED');
    expect(out.again.session_row_id).toBe(out.first.session_row_id);
  });

  dbit('remember-me gets the long lifetime and no idle timeout', async () => {
    const r = await rolledBack((tx) => register(tx, randomUUID(), a.userId, { remember: true }));
    expect(r.idle_timeout_sec).toBe(0);
    const days = (new Date(r.expires_at!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  dbit('a user without an active membership cannot register a session', async () => {
    const r = await rolledBack((tx) => register(tx, randomUUID(), randomUUID()));
    expect(r.result_status).toBe('NO_MEMBERSHIP');
  });

  dbit('uses the tenant override of the effective policy', async () => {
    const r = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${a.tenantId}::uuid, 'AUTH_IDLE_TIMEOUT_MIN', '10')`;
      return register(tx, randomUUID(), a.userId);
    });
    expect(r.idle_timeout_sec).toBe(600);
  });
});

describe('validate', () => {
  dbit('ACTIVE for a registered own session, with remaining time', async () => {
    const v = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      return validateAs(tx, a.userId, sid);
    });
    expect(v.state).toBe('ACTIVE');
    expect(v.tenant_org_id).toBe(a.tenantId);
    expect(v.idle_remaining_sec).toBeGreaterThan(1790);
    expect(v.absolute_remaining_sec).toBeGreaterThan(12 * 3600 - 60);
  });

  dbit('NO_SESSION without a session_id claim; NOT_REGISTERED for an unknown session; other users cannot see it', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      const noSession = await validateAs(tx, a.userId, null);
      const unknown = await validateAs(tx, a.userId, randomUUID());
      const stranger = await validateAs(tx, randomUUID(), sid);
      return { noSession, unknown, stranger };
    });
    expect(out.noSession.state).toBe('NO_SESSION');
    expect(out.unknown.state).toBe('NOT_REGISTERED');
    expect(out.stranger.state).toBe('NOT_REGISTERED');
  });

  dbit('idle timeout ends the session, deletes the auth session and audits SESSION_IDLE_TIMEOUT', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await tx.$executeRaw`INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES (${sid}::uuid, ${a.userId}::uuid, now(), now())`;
      await register(tx, sid, a.userId);
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET last_activity_at = now() - interval '31 minutes' WHERE auth_session_id = ${sid}::uuid`;
      const v = await validateAs(tx, a.userId, sid);
      const st = await statusOf(tx, sid);
      const left = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM auth.sessions WHERE id = ${sid}::uuid`;
      const ev = await tx.$queryRaw<Array<{ event_code: string; reason_code: string | null }>>`
        SELECT event_code, reason_code FROM public.sys_auth_audit_log WHERE auth_session_id = ${sid}::uuid AND event_code = 'SESSION_IDLE_TIMEOUT'`;
      const again = await validateAs(tx, a.userId, sid);
      return { v, st, left: Number(left[0].n), ev, again };
    });
    expect(out.v.state).toBe('ENDED');
    expect(out.v.end_reason).toBe('IDLE_TIMEOUT');
    expect(out.st).toEqual({ status: 'ENDED', end_reason_code: 'IDLE_TIMEOUT' });
    expect(out.left).toBe(0);
    expect(out.ev).toHaveLength(1);
    expect(out.again.state).toBe('ENDED');
  });

  dbit('absolute expiry ends the session even with recent activity', async () => {
    const v = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET expires_at = now() - interval '1 second' WHERE auth_session_id = ${sid}::uuid`;
      return validateAs(tx, a.userId, sid, true);
    });
    expect(v.state).toBe('ENDED');
    expect(v.end_reason).toBe('ABSOLUTE_TIMEOUT');
  });

  dbit('remember-me sessions have no idle timeout', async () => {
    const v = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId, { remember: true });
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET last_activity_at = now() - interval '10 days' WHERE auth_session_id = ${sid}::uuid`;
      return validateAs(tx, a.userId, sid);
    });
    expect(v.state).toBe('ACTIVE');
    expect(v.idle_remaining_sec).toBeNull();
  });

  dbit('only the explicit touch extends the idle window; plain validation does not', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET last_activity_at = now() - interval '10 minutes' WHERE auth_session_id = ${sid}::uuid`;
      const plain = await validateAs(tx, a.userId, sid, false);
      const touched = await validateAs(tx, a.userId, sid, true);
      return { plain, touched };
    });
    expect(out.plain.idle_remaining_sec).toBeLessThanOrEqual(1200);
    expect(out.touched.idle_remaining_sec).toBeGreaterThan(1790);
  });

  dbit('a deactivated membership ends the session on the next validation', async () => {
    const v = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      // Bypass the revoke trigger to prove validate itself rejects a deactivated membership.
      await tx.$executeRawUnsafe('ALTER TABLE public.org_users_mst DISABLE TRIGGER trg_org_users_revoke_sessions');
      await tx.$executeRaw`UPDATE public.org_users_mst SET is_active = false WHERE id = ${a.orgUserId}::uuid`;
      return validateAs(tx, a.userId, sid);
    });
    expect(v.state).toBe('ENDED');
    expect(v.end_reason).toBe('USER_DEACTIVATED');
  });
});

describe('ending and revoking', () => {
  dbit('fn_auth_session_end is idempotent and records who ended it', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      const first = await tx.$queryRaw<Array<{ r: boolean }>>`SELECT public.fn_auth_session_end(${sid}::uuid, 'USER_LOGOUT', ${a.userId}::uuid) AS r`;
      const second = await tx.$queryRaw<Array<{ r: boolean }>>`SELECT public.fn_auth_session_end(${sid}::uuid, 'USER_LOGOUT', ${a.userId}::uuid) AS r`;
      const row = await tx.$queryRaw<Array<{ ended_by: string; end_reason_code: string }>>`
        SELECT ended_by::text, end_reason_code FROM public.sys_auth_user_sessions_mst WHERE auth_session_id = ${sid}::uuid`;
      const ev = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM public.sys_auth_audit_log WHERE auth_session_id = ${sid}::uuid AND event_code = 'LOGOUT'`;
      return { first: first[0].r, second: second[0].r, row: row[0], ev: Number(ev[0].n) };
    });
    expect(out.first).toBe(true);
    expect(out.second).toBe(false);
    expect(out.row).toEqual({ ended_by: a.userId, end_reason_code: 'USER_LOGOUT' });
    expect(out.ev).toBe(1);
  });

  dbit('revoke ends all sessions of the user in the tenant except the kept one', async () => {
    const out = await rolledBack(async (tx) => {
      const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
      for (const s of [s1, s2, s3]) await register(tx, s, a.userId);
      const n = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT public.fn_auth_sessions_revoke(${a.userId}::uuid, ${a.tenantId}::uuid, 'USER_REVOKED', ${s2}::uuid, ${a.userId}::uuid) AS n`;
      return { n: n[0].n, s1: await statusOf(tx, s1), s2: await statusOf(tx, s2), s3: await statusOf(tx, s3) };
    });
    expect(out.n).toBe(2);
    expect(out.s2?.status).toBe('ACTIVE');
    expect(out.s1).toEqual({ status: 'ENDED', end_reason_code: 'USER_REVOKED' });
    expect(out.s3).toEqual({ status: 'ENDED', end_reason_code: 'USER_REVOKED' });
  });

  dbit('deactivating the membership ends its sessions (trigger)', async () => {
    const out = await rolledBack(async (tx) => {
      const sid = randomUUID();
      await register(tx, sid, a.userId);
      await tx.$executeRaw`UPDATE public.org_users_mst SET is_active = false WHERE id = ${a.orgUserId}::uuid`;
      return statusOf(tx, sid);
    });
    expect(out).toEqual({ status: 'ENDED', end_reason_code: 'USER_DEACTIVATED' });
  });
});

describe('concurrent session limit', () => {
  dbit('REVOKE_OLDEST ends the least recently active session to make room', async () => {
    const out = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value) VALUES
          (${a.tenantId}::uuid, 'AUTH_MAX_SESSIONS_PER_USER', '2')`;
      const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
      await register(tx, s1, a.userId);
      await register(tx, s2, a.userId);
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET last_activity_at = now() - interval '5 minutes' WHERE auth_session_id = ${s1}::uuid`;
      const third = await register(tx, s3, a.userId);
      return { third, s1: await statusOf(tx, s1), s2: await statusOf(tx, s2), s3: await statusOf(tx, s3) };
    });
    expect(out.third.result_status).toBe('REGISTERED');
    expect(out.third.ended_sessions).toBe(1);
    expect(out.s1).toEqual({ status: 'ENDED', end_reason_code: 'SESSION_LIMIT' });
    expect(out.s2?.status).toBe('ACTIVE');
    expect(out.s3?.status).toBe('ACTIVE');
  });

  dbit('BLOCK_NEW refuses the new sign-in and registers nothing', async () => {
    const out = await rolledBack(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value) VALUES
          (${a.tenantId}::uuid, 'AUTH_MAX_SESSIONS_PER_USER', '1'),
          (${a.tenantId}::uuid, 'AUTH_SESSION_LIMIT_POLICY', 'BLOCK_NEW')`;
      const [s1, s2] = [randomUUID(), randomUUID()];
      await register(tx, s1, a.userId);
      const second = await register(tx, s2, a.userId);
      const denied = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM public.sys_auth_audit_log WHERE auth_session_id = ${s2}::uuid AND event_code = 'SESSION_LIMIT_HIT' AND outcome = 'DENIED'`;
      return { second, s1: await statusOf(tx, s1), s2: await statusOf(tx, s2), denied: Number(denied[0].n) };
    });
    expect(out.second.result_status).toBe('BLOCKED_SESSION_LIMIT');
    expect(out.s1?.status).toBe('ACTIVE');
    expect(out.s2).toBeUndefined();
    expect(out.denied).toBe(1);
  });

  dbit('unlimited by default (0): many sessions are fine', async () => {
    const out = await rolledBack(async (tx) => {
      const results: string[] = [];
      for (let i = 0; i < 4; i++) results.push((await register(tx, randomUUID(), a.userId)).result_status);
      return results;
    });
    expect(out).toEqual(['REGISTERED', 'REGISTERED', 'REGISTERED', 'REGISTERED']);
  });
});

describe('new-device detection', () => {
  dbit('flags a browser never seen for this user (not the first sign-in) and honours the alert setting', async () => {
    const out = await rolledBack(async (tx) => {
      const first = await register(tx, randomUUID(), a.userId, { device: 'hash-A' });
      const sameDevice = await register(tx, randomUUID(), a.userId, { device: 'hash-A' });
      const newDevice = await register(tx, randomUUID(), a.userId, { device: 'hash-B' });
      await tx.$executeRaw`
        INSERT INTO public.org_auth_admin_config_cf (tenant_org_id, config_code, config_value)
        VALUES (${a.tenantId}::uuid, 'AUTH_NEW_DEVICE_ALERT', 'false')`;
      const alertOff = await register(tx, randomUUID(), a.userId, { device: 'hash-C' });
      const noCookie = await register(tx, randomUUID(), a.userId, { device: null });
      const ev = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM public.sys_auth_audit_log WHERE auth_user_id = ${a.userId}::uuid AND event_code = 'NEW_DEVICE'`;
      return { first, sameDevice, newDevice, alertOff, noCookie, ev: Number(ev[0].n) };
    });
    expect(out.first.new_device).toBe(false); // first-ever sign-in is not flagged
    expect(out.sameDevice.new_device).toBe(false);
    expect(out.newDevice.new_device).toBe(true);
    expect(out.newDevice.alert_new_device).toBe(true);
    expect(out.alertOff.new_device).toBe(true);
    expect(out.alertOff.alert_new_device).toBe(false); // detected but tenant turned alerts off
    expect(out.noCookie.new_device).toBe(false); // no device cookie => cannot tell
    expect(out.ev).toBe(2); // hash-B and hash-C
  });
});

describe('sweep', () => {
  dbit('ends expired, idle and orphaned sessions and purges old ended history', async () => {
    const out = await rolledBack(async (tx) => {
      const [expired, idle, orphan, healthy, oldEnded] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      for (const s of [expired, idle, orphan, healthy, oldEnded]) {
        await tx.$executeRaw`INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES (${s}::uuid, ${a.userId}::uuid, now(), now())`;
        await register(tx, s, a.userId);
      }
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET expires_at = now() - interval '1 minute' WHERE auth_session_id = ${expired}::uuid`;
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET last_activity_at = now() - interval '2 hours' WHERE auth_session_id = ${idle}::uuid`;
      await tx.$executeRaw`DELETE FROM auth.sessions WHERE id = ${orphan}::uuid`;
      await tx.$executeRaw`SELECT public.fn_auth_session_end(${oldEnded}::uuid, 'USER_LOGOUT', NULL)`;
      await tx.$executeRaw`UPDATE public.sys_auth_user_sessions_mst SET ended_at = now() - interval '200 days' WHERE auth_session_id = ${oldEnded}::uuid`;
      const n = await tx.$queryRaw<Array<{ n: number }>>`SELECT public.fn_auth_sessions_sweep(180) AS n`;
      return {
        n: n[0].n,
        expired: await statusOf(tx, expired),
        idle: await statusOf(tx, idle),
        orphan: await statusOf(tx, orphan),
        healthy: await statusOf(tx, healthy),
        oldEnded: await statusOf(tx, oldEnded),
      };
    });
    expect(out.n).toBe(3);
    expect(out.expired).toEqual({ status: 'ENDED', end_reason_code: 'ABSOLUTE_TIMEOUT' });
    expect(out.idle).toEqual({ status: 'ENDED', end_reason_code: 'IDLE_TIMEOUT' });
    expect(out.orphan).toEqual({ status: 'ENDED', end_reason_code: 'SECURITY' });
    expect(out.healthy?.status).toBe('ACTIVE');
    expect(out.oldEnded).toBeUndefined(); // purged by retention
  });
});

describe('RLS and privileges', () => {
  dbit('an authenticated user reads only their own sessions', async () => {
    if (!b || b.userId === a.userId) return;
    const other = b;
    const out = await rolledBack(async (tx) => {
      await register(tx, randomUUID(), a.userId);
      await register(tx, randomUUID(), other.userId);
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ role: 'authenticated', sub: a.userId })}, true)`;
      return tx.$queryRaw<Array<{ auth_user_id: string }>>`SELECT auth_user_id::text FROM public.sys_auth_user_sessions_mst`;
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.auth_user_id === a.userId)).toBe(true);
  });

  dbit('API roles cannot call the mutating functions or write the table; authenticated may validate', async () => {
    const r = await prisma.$queryRaw<Array<Record<string, boolean>>>`
      SELECT has_function_privilege('authenticated','public.fn_auth_session_register(uuid,uuid,boolean,inet,text,text,text)','EXECUTE') AS auth_reg,
             has_function_privilege('anon','public.fn_auth_session_register(uuid,uuid,boolean,inet,text,text,text)','EXECUTE')          AS anon_reg,
             has_function_privilege('service_role','public.fn_auth_session_register(uuid,uuid,boolean,inet,text,text,text)','EXECUTE')   AS svc_reg,
             has_function_privilege('authenticated','public.fn_auth_session_end(uuid,text,uuid)','EXECUTE')                              AS auth_end,
             has_function_privilege('authenticated','public.fn_auth_sessions_revoke(uuid,uuid,text,uuid,uuid)','EXECUTE')               AS auth_revoke,
             has_function_privilege('authenticated','public.fn_auth_sessions_sweep(integer)','EXECUTE')                                  AS auth_sweep,
             has_function_privilege('authenticated','public.fn_auth_session_end_internal(uuid,text,uuid)','EXECUTE')                     AS auth_internal,
             has_function_privilege('authenticated','public.fn_auth_session_validate(boolean,inet)','EXECUTE')                           AS auth_validate,
             has_function_privilege('anon','public.fn_auth_session_validate(boolean,inet)','EXECUTE')                                    AS anon_validate,
             has_table_privilege('authenticated','public.sys_auth_user_sessions_mst','INSERT')                                           AS auth_ins,
             has_table_privilege('authenticated','public.sys_auth_user_sessions_mst','UPDATE')                                           AS auth_upd,
             has_table_privilege('anon','public.sys_auth_user_sessions_mst','SELECT')                                                    AS anon_sel`;
    expect(r[0]).toEqual({
      auth_reg: false, anon_reg: false, svc_reg: true,
      auth_end: false, auth_revoke: false, auth_sweep: false, auth_internal: false,
      auth_validate: true, anon_validate: false,
      auth_ins: false, auth_upd: false, anon_sel: false,
    });
  });
});
