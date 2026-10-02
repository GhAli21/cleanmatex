/**
 * CLF-9 (plan §4B.14 "Tenant isolation") — every cash-ledger table is tenant-isolated by a real
 * RLS policy, and a second tenant can neither read nor write the first tenant's drawer ledger.
 *
 * Same mechanism as rls-tenant-isolation.db.test.ts: each probe runs in a transaction that drops
 * to the `authenticated` role and sets the `request.jwt.claims` PostgREST would set, then always
 * rolls back. The app's own Prisma path enforces tenancy with explicit `tenant_org_id` predicates
 * (covered by the service suites); this proves the database-side backstop.
 *
 * Local DB only — never remote. Skips gracefully when no DB, second tenant or role is available.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { postDrawerTrx } from '@/lib/services/cash-drawer-trx.service';
import { CASH_DRAWER_TRX_TYPES } from '@/lib/constants/cash-drawer';
import {
  resolveTestScope,
  createTestDrawer,
  openTestSession,
  closeTestSession,
  cleanupTestDrawers,
  stampTestCashLine,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

/** Every tenant-owned table the cash ledger program introduced or reshaped. */
const CASH_LEDGER_TABLES = [
  'org_cash_drawers_mst',
  'org_cash_drawer_sessions_mst',
  'org_cash_drawer_ses_bal_dtl',
  'org_cash_drawer_ses_post_tr',
  'org_cash_drawer_cnt_mst',
  'org_cash_drawer_cnt_denom_dtl',
  'org_cash_drawer_trx_mst',
  'org_cash_drawer_trx_dtl',
  'org_fin_cash_ctrl_stng_cf',
  'org_fin_cash_ctrl_audit_dtl',
] as const;

let ready = false;
let scope: DbTestScope | null = null;
let otherTenantId = '';
let drawerId = '';
let safeId = '';
let sessionId = '';
let trxId = '';
let lineId = '';

class RollbackMarker extends Error {}

async function asTenant<T>(
  tenantId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  let result!: T;
  await prisma
    .$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config(
        'request.jwt.claims',
        ${JSON.stringify({ role: 'authenticated', user_metadata: { tenant_org_id: tenantId } })},
        true
      )`;
      result = await fn(tx);
      throw new RollbackMarker();
    })
    .catch((err) => {
      if (!(err instanceof RollbackMarker)) throw err;
    });
  return result;
}

beforeAll(async () => {
  try {
    scope = await resolveTestScope();
    if (!scope) return;
    const role = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS ok`;
    const other = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst WHERE id <> ${scope.tenantId}::uuid LIMIT 1`;
    otherTenantId = other[0]?.id ?? '';
    if (!role[0]?.ok || !otherTenantId) return;

    const actor = randomUUID();
    drawerId = await createTestDrawer(scope, { codePrefix: 'CLF-ISO', name: 'CLF isolation drawer' });
    safeId = await createTestDrawer(scope, { codePrefix: 'CLF-ISO', name: 'CLF isolation safe', type: 'SAFE' });
    const session = await openTestSession(scope, actor, drawerId);
    sessionId = session.sessionId;
    lineId = (await stampTestCashLine(scope, { drawerId, amount: 7, mode: 'INTERACTIVE' })).lineId;
    trxId = (
      await postDrawerTrx(scope.tenantId, actor, {
        trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
        branchId: scope.branchId,
        lines: [
          { drawerId, direction: 'OUT', amount: 2, currencyCode: 'OMR' },
          { drawerId: safeId, direction: 'IN', amount: 2, currencyCode: 'OMR' },
        ],
      })
    ).trxId;
    await closeTestSession(scope, actor, drawerId, sessionId, { countedAmount: 5 });
    ready = true;
  } catch (err) {
    console.warn('[cash-drawer-tenant-isolation] setup failed — skipping:', err);
    ready = false;
  }
});

afterAll(async () => {
  try {
    if (scope && drawerId) await cleanupTestDrawers(scope, [drawerId, safeId].filter(Boolean));
  } finally {
    await prisma.$disconnect();
  }
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!ready) {
      console.warn(`[cash-drawer-tenant-isolation] prerequisites unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('cash ledger — tenant isolation (real Postgres, real authenticated role)', () => {
  dbit('every cash-ledger table has row-level security enabled with a tenant_org_id policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; rls: boolean; policies: bigint }>>`
      SELECT c.relname,
             c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname
                 AND p.qual ILIKE '%tenant_org_id%') AS policies
        FROM pg_class c
       WHERE c.relnamespace = 'public'::regnamespace
         AND c.relname = ANY(${[...CASH_LEDGER_TABLES]}::text[])`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...CASH_LEDGER_TABLES].sort());
    for (const r of rows) {
      expect({ table: r.relname, rls: r.rls }).toEqual({ table: r.relname, rls: true });
      expect({ table: r.relname, hasTenantPolicy: Number(r.policies) > 0 }).toEqual({
        table: r.relname,
        hasTenantPolicy: true,
      });
    }
  });

  dbit('the owning tenant sees its drawer ledger; another tenant sees none of it', async () => {
    const count = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) =>
      tx.$queryRaw<Array<Record<string, bigint>>>`
        SELECT
          (SELECT count(*) FROM public.org_cash_drawers_mst WHERE id = ${drawerId}::uuid) AS drawers,
          (SELECT count(*) FROM public.org_cash_drawer_sessions_mst WHERE id = ${sessionId}::uuid) AS sessions,
          (SELECT count(*) FROM public.org_cash_drawer_ses_bal_dtl WHERE cash_drawer_session_id = ${sessionId}::uuid) AS balances,
          (SELECT count(*) FROM public.org_cash_drawer_cnt_mst WHERE cash_drawer_id = ${drawerId}::uuid) AS counts,
          (SELECT count(*) FROM public.org_cash_drawer_trx_mst WHERE id = ${trxId}::uuid) AS trx,
          (SELECT count(*) FROM public.org_cash_drawer_trx_dtl WHERE trx_id = ${trxId}::uuid) AS trx_lines,
          (SELECT count(*) FROM public.org_fin_voucher_trx_lines_dtl WHERE id = ${lineId}::uuid) AS cash_lines`;

    const owner = (await asTenant(scope!.tenantId, count))[0];
    for (const key of ['drawers', 'sessions', 'balances', 'counts', 'trx', 'cash_lines']) {
      expect({ key, rows: Number(owner[key]) }).toEqual({ key, rows: expect.any(Number) });
      expect(Number(owner[key])).toBeGreaterThan(0);
    }
    expect(Number(owner.trx_lines)).toBe(2);

    const stranger = (await asTenant(otherTenantId, count))[0];
    for (const [key, value] of Object.entries(stranger)) {
      expect({ key, rows: Number(value) }).toEqual({ key, rows: 0 });
    }
  });

  dbit('another tenant cannot update or delete the ledger — zero rows affected, data provably unchanged', async () => {
    const updated = await asTenant(otherTenantId, async (tx) => {
      const drawers = await tx.$executeRaw`
        UPDATE public.org_cash_drawers_mst SET drawer_name = 'HIJACKED' WHERE id = ${drawerId}::uuid`;
      const sessions = await tx.$executeRaw`
        UPDATE public.org_cash_drawer_sessions_mst SET close_notes = 'HIJACKED' WHERE id = ${sessionId}::uuid`;
      const deleted = await tx.$executeRaw`DELETE FROM public.org_cash_drawer_sessions_mst WHERE id = ${sessionId}::uuid`;
      return { drawers, sessions, deleted };
    });
    expect(updated).toEqual({ drawers: 0, sessions: 0, deleted: 0 });

    const after = await prisma.org_cash_drawers_mst.findFirstOrThrow({
      where: { id: drawerId, tenant_org_id: scope!.tenantId },
      select: { drawer_name: true },
    });
    expect(after.drawer_name).toBe('CLF isolation drawer');
  });

  dbit('another tenant cannot plant a row in this tenant (WITH CHECK rejects the insert)', async () => {
    await expect(
      asTenant(otherTenantId, (tx) =>
        tx.$executeRaw`
          INSERT INTO public.org_cash_drawers_mst
            (tenant_org_id, branch_id, drawer_code, drawer_name, drawer_type, currency_code)
          VALUES (${scope!.tenantId}::uuid, ${scope!.branchId}::uuid, ${`CLF-ISO-${randomUUID().slice(0, 8)}`},
                  'planted', 'TEMPORARY', 'OMR')`,
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});
