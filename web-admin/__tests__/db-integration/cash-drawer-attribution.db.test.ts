/**
 * E2 — real-DB proof of per-cashier attribution inside a shared drawer session: cash is grouped by
 * POS session with unattributed cash on its own line (E2-1), the Z-report carries the same breakdown
 * (E2-3), and `shared_session_mode = EXCLUSIVE` refuses a second POS session on the same drawer
 * session while SHARED allows it (E2-2).
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { loadDrawerCashAttribution } from '@/lib/services/cash-drawer-attribution';
import { autoLinkDrawer } from '@/lib/services/pos-session.service';
import { buildPosShiftSnapshot } from '@/lib/services/pos-shift-report.service';
import { POS_SESSION_SHARING_ERROR } from '@/lib/constants/pos-session';
import {
  cleanupTestDrawers,
  createTestDrawer,
  openTestSession,
  resolveTestScope,
  stampTestCashLine,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
let tenantTz = '';
let realUserId = '';

beforeAll(async () => {
  scope = await resolveTestScope();
  if (!scope) return;
  const [tenant] = await prisma.$queryRaw<Array<{ timezone: string }>>`
    SELECT timezone FROM public.org_tenants_mst WHERE id = ${scope.tenantId}::uuid`;
  tenantTz = tenant.timezone;
  const [user] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM public.org_users_mst WHERE tenant_org_id = ${scope.tenantId}::uuid ORDER BY created_at LIMIT 1`;
  realUserId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!scope) {
        console.warn(`[cash-drawer-attribution] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    180_000,
  );
}

async function insertPosSession(userId: string, drawerId: string | null, drawerSessionId: string | null): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO public.org_pos_sessions_mst (
      id, tenant_org_id, branch_id, user_id, session_no, business_date, business_timezone,
      status, opened_at, opened_by, created_by, cash_drawer_id, cash_drawer_session_id
    ) VALUES (
      ${id}::uuid, ${scope!.tenantId}::uuid, ${scope!.branchId}::uuid, ${userId}::uuid,
      ${`E2-TEST-${id.slice(0, 8)}`}, CURRENT_DATE, ${tenantTz},
      'OPEN', NOW() - INTERVAL '1 hour', ${userId}::uuid, 'e2-test', ${drawerId}::uuid, ${drawerSessionId}::uuid
    )`;
  return id;
}

async function postCash(drawerId: string, posSessionId: string | null, amount: string, direction: 'IN' | 'OUT') {
  const { lineId } = await stampTestCashLine(scope!, { drawerId, amount, mode: 'INTERACTIVE', direction });
  if (!posSessionId) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_posted_line_edit = 'on'`);
    await tx.$executeRaw`
      UPDATE public.org_fin_voucher_trx_lines_dtl SET pos_session_id = ${posSessionId}::uuid
      WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${lineId}::uuid`;
  });
}

describe('per-cashier attribution in a shared drawer session (E2)', () => {
  dbit('groups cash by POS session with unattributed cash on its own line, and the Z snapshot carries it', async () => {
    const userA = randomUUID();
    const userB = randomUUID();
    const drawerId = await createTestDrawer(scope!, { codePrefix: 'E2-TEST', name: 'E2 attribution' });
    const { sessionId: drawerSessionId } = await openTestSession(scope!, userA, drawerId);
    const posA = await insertPosSession(userA, drawerId, drawerSessionId);
    const posB = await insertPosSession(userB, drawerId, drawerSessionId);
    try {
      await postCash(drawerId, posA, '10.000', 'IN');
      await postCash(drawerId, posA, '2.000', 'OUT');
      await postCash(drawerId, posB, '5.000', 'IN');
      await postCash(drawerId, null, '1.000', 'IN'); // no POS session attached

      const rows = await loadDrawerCashAttribution(prisma, scope!.tenantId, drawerSessionId);
      const byKey = new Map(rows.map((r) => [r.posSessionId, r]));
      expect(byKey.get(posA)).toMatchObject({ cashIn: '10.0000', cashOut: '2.0000', net: '8.0000', lineCount: 2 });
      expect(byKey.get(posB)).toMatchObject({ cashIn: '5.0000', cashOut: '0', net: '5.0000', lineCount: 1 });
      expect(byKey.get(null)).toMatchObject({ posSessionNo: null, net: '1.0000', lineCount: 1 });
      expect(rows).toHaveLength(3);

      // The shift report of cashier B carries the whole drawer's breakdown (E2-3).
      const snapshot = await buildPosShiftSnapshot(prisma, { tenantId: scope!.tenantId, posSessionId: posB, kind: 'X' });
      expect(snapshot.drawer?.attribution?.map((a) => a.net).sort()).toEqual(['1.0000', '5.0000', '8.0000']);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
      await prisma.$executeRaw`
        DELETE FROM public.org_pos_session_events_dtl
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id IN (${posA}::uuid, ${posB}::uuid)`;
      await prisma.$executeRaw`
        DELETE FROM public.org_pos_sessions_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id IN (${posA}::uuid, ${posB}::uuid)`;
    }
  });

  dbit('EXCLUSIVE refuses a second POS session on the drawer session; SHARED allows it', async () => {
    const userA = randomUUID();
    const userC = randomUUID();
    const drawerId = await createTestDrawer(scope!, { codePrefix: 'E2-TEST', name: 'E2 exclusive' });
    const { sessionId: drawerSessionId } = await openTestSession(scope!, userA, drawerId);
    const posA = await insertPosSession(userA, drawerId, drawerSessionId);
    const posC = await insertPosSession(userC, null, null);
    const link = () =>
      autoLinkDrawer({
        tenantId: scope!.tenantId,
        userId: userC,
        posSessionId: posC,
        branchId: scope!.branchId,
        cashDrawerSessionId: drawerSessionId,
      });
    try {
      await updateCashControlSettings(
        { tenantId: scope!.tenantId, drawerId },
        { sharedSessionMode: 'EXCLUSIVE' },
        { userId: realUserId, reason: 'E2 exclusive proof' },
      );
      await expect(link()).rejects.toMatchObject({
        code: POS_SESSION_SHARING_ERROR.DRAWER_SESSION_EXCLUSIVE,
        httpStatus: 409,
        details: { otherPosSessionId: posA },
      });

      await updateCashControlSettings(
        { tenantId: scope!.tenantId, drawerId },
        { sharedSessionMode: 'SHARED' },
        { userId: realUserId },
      );
      const linked = await link();
      expect(linked?.type).toBe('UPDATED');
    } finally {
      await prisma.org_fin_cash_ctrl_stng_cf.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
      await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
      await prisma.$executeRaw`
        DELETE FROM public.org_pos_session_events_dtl
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id IN (${posA}::uuid, ${posC}::uuid)`;
      await prisma.$executeRaw`
        DELETE FROM public.org_pos_sessions_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id IN (${posA}::uuid, ${posC}::uuid)`;
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });
});
