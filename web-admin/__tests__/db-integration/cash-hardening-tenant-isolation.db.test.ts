/**
 * E5-4 — tenant isolation of everything the POS Session & Cash Drawer Hardening program added:
 * the Z-report, in-transit transfer and tenant-denomination tables (real RLS under the
 * `authenticated` role), and every new service/API entry point called with another tenant's id
 * (an explicit `tenant_org_id` predicate, not just RLS).
 *
 * Local DB only — never remote. Skips gracefully when no DB, second tenant or role is available.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { closePosSession } from '@/lib/services/pos-session.service';
import { cancelTransit, getTransitBranchId, listTransits, receiveTransit, sendTransit } from '@/lib/services/cash-transit.service';
import { generateShiftZReport, getLivePosShiftReport, getShiftZReport } from '@/lib/services/pos-shift-report.service';
import { rejectVariance, approveVariance } from '@/lib/services/cash-drawer-session.service';
import { listVarianceDecisionQueue } from '@/lib/services/cash-drawer-variance-queue.service';
import { getVarianceByCashierReport } from '@/lib/services/cash-drawer-variance-report.service';
import { listEffectiveDenominations, saveDenominationOverrides } from '@/lib/services/cash-denomination-control.service';
import { loadDrawerCashAttribution } from '@/lib/services/cash-drawer-attribution';
import { getDrawerCountPolicy } from '@/lib/services/cash-drawer-count-policy.service';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import {
  cleanupTestDrawers,
  closeTestSession,
  createTestDrawer,
  openTestSession,
  resolveTestScope,
  stampTestCashLine,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const NEW_TABLES = ['org_pos_shift_z_rpt_tr', 'org_cash_drawer_transit_tr', 'org_currency_denom_cf'] as const;

let ready = false;
let scope: DbTestScope | null = null;
let otherTenantId = '';
let sourceDrawerId = '';
let safeDrawerId = '';
let drawerSessionId = '';
let posSessionId = '';
let transitId = '';
let posUserId = '';

class RollbackMarker extends Error {}

async function asTenant<T>(
  tenantId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  let result!: T;
  await prisma
    .$transaction(async (tx) => {
      const member = await tx.$queryRaw<Array<{ user_id: string }>>`
        SELECT user_id FROM public.org_users_mst
        WHERE tenant_org_id = ${tenantId}::uuid AND is_active = true ORDER BY created_at LIMIT 1`;
      const sub = member[0]?.user_id ?? randomUUID();
      await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
      await tx.$queryRaw`SELECT set_config(
        'request.jwt.claims',
        ${JSON.stringify({ role: 'authenticated', sub, user_metadata: { tenant_org_id: tenantId } })},
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
      SELECT t.id FROM public.org_tenants_mst t
      WHERE t.id <> ${scope.tenantId}::uuid
        AND EXISTS (SELECT 1 FROM public.org_users_mst u WHERE u.tenant_org_id = t.id AND u.is_active)
      LIMIT 1`;
    otherTenantId = other[0]?.id ?? '';
    if (!role[0]?.ok || !otherTenantId) return;

    posUserId = randomUUID();
    sourceDrawerId = await createTestDrawer(scope, { codePrefix: 'HRD-ISO', name: 'hardening isolation drawer' });
    safeDrawerId = await createTestDrawer(scope, { codePrefix: 'HRD-ISO', name: 'hardening isolation safe', type: 'SAFE' });
    drawerSessionId = (await openTestSession(scope, posUserId, sourceDrawerId)).sessionId;

    posSessionId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO public.org_pos_sessions_mst (
        id, tenant_org_id, branch_id, user_id, session_no, business_date, business_timezone,
        status, opened_at, opened_by, created_by, cash_drawer_id, cash_drawer_session_id
      ) VALUES (
        ${posSessionId}::uuid, ${scope.tenantId}::uuid, ${scope.branchId}::uuid, ${posUserId}::uuid,
        ${`HRD-ISO-${posSessionId.slice(0, 8)}`}, CURRENT_DATE, 'UTC',
        'OPEN', NOW() - INTERVAL '1 hour', ${posUserId}::uuid, 'hrd-iso', ${sourceDrawerId}::uuid, ${drawerSessionId}::uuid
      )`;

    await stampTestCashLine(scope, { drawerId: sourceDrawerId, amount: 5, mode: 'INTERACTIVE', direction: 'IN' });
    transitId = (await sendTransit(scope.tenantId, posUserId, { sourceDrawerId, destDrawerId: safeDrawerId, amount: '1.000' })).transitId;
    await closeTestSession(scope, posUserId, sourceDrawerId, drawerSessionId, { countedAmount: 4 });
    await closePosSession({ tenantId: scope.tenantId, userId: posUserId }); // freezes the Z-report
    const [tenantCurrency] = await prisma.$queryRaw<Array<{ currency_code: string }>>`
      SELECT currency_code FROM public.org_currency_cf WHERE tenant_org_id = ${scope.tenantId}::uuid AND currency_code = 'OMR'`;
    if (tenantCurrency) {
      const effective = await listEffectiveDenominations(scope.tenantId, 'OMR');
      await saveDenominationOverrides(scope.tenantId, posUserId, 'OMR', [{ denominationCode: effective[0].denominationCode, isEnabled: false }]);
    }
    ready = true;
  } catch (err) {
    // A broken fixture must fail the suite loudly: a silently skipped isolation proof is worse than none.
    throw err;
  }
}, 180_000);

afterAll(async () => {
  try {
    if (scope) {
      await prisma.$executeRaw`DELETE FROM public.org_currency_denom_cf WHERE tenant_org_id = ${scope.tenantId}::uuid AND currency_code = 'OMR'`;
      if (posSessionId) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_ledger_edit = 'on'`);
          await tx.$executeRaw`DELETE FROM public.org_cash_drawer_transit_tr WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${transitId}::uuid`;
          await tx.$executeRaw`DELETE FROM public.org_pos_shift_z_rpt_tr WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${posSessionId}::uuid`;
          await tx.$executeRaw`DELETE FROM public.org_pos_session_events_dtl WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${posSessionId}::uuid`;
        });
      }
      if (sourceDrawerId) await cleanupTestDrawers(scope, [sourceDrawerId, safeDrawerId].filter(Boolean));
      if (posSessionId) {
        await prisma.$executeRaw`DELETE FROM public.org_pos_sessions_mst WHERE tenant_org_id = ${scope.tenantId}::uuid AND id = ${posSessionId}::uuid`;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}, 120_000);

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!ready) {
        console.warn(`[cash-hardening-tenant-isolation] prerequisites unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    120_000,
  );
}

describe('hardening program — tenant isolation (RLS and explicit tenant predicates)', () => {
  dbit('every new table has row-level security with a tenant_org_id policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; rls: boolean; policies: bigint }>>`
      SELECT c.relname, c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.qual ILIKE '%tenant_org_id%') AS policies
        FROM pg_class c
       WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY(${[...NEW_TABLES]}::text[])`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...NEW_TABLES].sort());
    for (const r of rows) {
      expect({ table: r.relname, rls: r.rls, policy: Number(r.policies) > 0 }).toEqual({ table: r.relname, rls: true, policy: true });
    }
  });

  dbit('the owner sees its Z-report, transfer and overrides; another tenant sees none, and cannot change them', async () => {
    const probe = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) =>
      tx.$queryRaw<Array<Record<string, bigint>>>`
        SELECT
          (SELECT count(*) FROM public.org_pos_shift_z_rpt_tr WHERE pos_session_id = ${posSessionId}::uuid) AS z,
          (SELECT count(*) FROM public.org_cash_drawer_transit_tr WHERE id = ${transitId}::uuid) AS transit`;
    const owner = (await asTenant(scope!.tenantId, probe))[0];
    expect(Number(owner.z)).toBe(1);
    expect(Number(owner.transit)).toBe(1);
    const stranger = (await asTenant(otherTenantId, probe))[0];
    expect({ z: Number(stranger.z), transit: Number(stranger.transit) }).toEqual({ z: 0, transit: 0 });

    const changed = await asTenant(otherTenantId, async (tx) => ({
      transit: await tx.$executeRaw`UPDATE public.org_cash_drawer_transit_tr SET notes = 'HIJACKED' WHERE id = ${transitId}::uuid`,
      transitDelete: await tx.$executeRaw`DELETE FROM public.org_cash_drawer_transit_tr WHERE id = ${transitId}::uuid`,
      denomDelete: await tx.$executeRaw`DELETE FROM public.org_currency_denom_cf WHERE tenant_org_id = ${scope!.tenantId}::uuid`,
    }));
    expect(changed).toEqual({ transit: 0, transitDelete: 0, denomDelete: 0 });
  });

  dbit('transit services refuse another tenant: not found, never another tenant\'s transfer', async () => {
    await expect(receiveTransit(otherTenantId, randomUUID(), transitId)).rejects.toMatchObject({
      code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_FOUND,
    });
    await expect(cancelTransit(otherTenantId, randomUUID(), transitId, 'nope')).rejects.toMatchObject({
      code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_FOUND,
    });
    expect(await getTransitBranchId(otherTenantId, transitId)).toBeNull();
    const theirs = await listTransits(otherTenantId, { status: 'ALL', page: 1, pageSize: 100 });
    expect(theirs.rows.map((r) => r.id)).not.toContain(transitId);
    // And a send naming another tenant's drawers cannot reach them.
    await expect(
      sendTransit(otherTenantId, randomUUID(), { sourceDrawerId, destDrawerId: safeDrawerId, amount: '1.000' }),
    ).rejects.toMatchObject({ code: CASH_LEDGER_ERRORS.CASH_TRX_SAME_DRAWER });
  });

  dbit('shift reports and the drawer attribution refuse another tenant', async () => {
    await expect(
      getLivePosShiftReport({ tenantId: otherTenantId, userId: posUserId, posSessionId, canViewAll: true }),
    ).rejects.toMatchObject({ code: 'POS_SESSION_NOT_FOUND' });
    await expect(
      getShiftZReport({ tenantId: otherTenantId, userId: posUserId, posSessionId, canViewAll: true }),
    ).rejects.toMatchObject({ code: 'POS_SESSION_NOT_FOUND' });
    await expect(
      generateShiftZReport({ tenantId: otherTenantId, posSessionId, actorUserId: posUserId }),
    ).rejects.toMatchObject({ code: 'POS_SESSION_NOT_FOUND' });
    expect(await loadDrawerCashAttribution(prisma, otherTenantId, drawerSessionId)).toEqual([]);
    expect(await getDrawerCountPolicy(otherTenantId, posUserId, sourceDrawerId)).toBeNull();
  });

  dbit('variance decisions, the queue and the cashier report refuse another tenant', async () => {
    await expect(rejectVariance(otherTenantId, randomUUID(), drawerSessionId, { reason: 'x' })).rejects.toThrow(/not found/);
    await expect(approveVariance(otherTenantId, randomUUID(), drawerSessionId, { reason: 'x' })).rejects.toThrow(/not found/);
    const queue = await listVarianceDecisionQueue(otherTenantId, { decision: 'ALL', page: 1, pageSize: 100 });
    expect(queue.rows.map((r) => r.sessionId)).not.toContain(drawerSessionId);
    const today = new Date().toISOString().slice(0, 10);
    const report = await getVarianceByCashierReport(otherTenantId, { dateFrom: '2000-01-01', dateTo: today });
    expect(report.rows.map((r) => r.cashierId)).not.toContain(posUserId);
  });

  dbit('denomination overrides of one tenant never leak into another tenant\'s grid', async () => {
    const mine = await listEffectiveDenominations(scope!.tenantId, 'OMR');
    expect(mine.some((d) => !d.isEnabled)).toBe(true);
    const theirs = await listEffectiveDenominations(otherTenantId, 'OMR');
    expect(theirs.every((d) => d.isEnabled)).toBe(true);
  });
});
