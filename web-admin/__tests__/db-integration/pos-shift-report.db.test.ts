/**
 * D2 — real-DB proof of the POS shift X/Z reports (migration 0559): closing a POS session freezes
 * its Z-report in the same transaction (when the tenant requires it), the figures match the drawer
 * ledger exactly, the report is immutable and hash-verified, generation is idempotent, an on-demand
 * Z works for tenants that do not auto-generate, and a rollover force-close freezes one too.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { closePosSession } from '@/lib/services/pos-session.service';
import {
  generateShiftZReport,
  getLivePosShiftReport,
  getShiftZReport,
} from '@/lib/services/pos-shift-report.service';
import { runPosSessionRolloverSweep } from '@/lib/services/pos-session-rollover.service';
import { POS_SHIFT_REPORT_ERROR } from '@/lib/constants/pos-shift-report';
import {
  cleanupTestDrawers,
  closeTestSession,
  createTestDrawer,
  openTestSession,
  resolveTestScope,
  stampTestCashLine,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

jest.mock('@/lib/notifications/event-emitter', () => ({ emitNotificationEvent: jest.fn() }));

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
        console.warn(`[pos-shift-report] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    120_000,
  );
}

interface Shift {
  userId: string;
  posSessionId: string;
  drawerId: string | null;
  drawerSessionId: string | null;
}

/** A live POS session for a throw-away operator, optionally linked to an open drawer session. */
async function createShift(opts: { withDrawer: boolean; zRequired: boolean; rolloverMode?: string; businessDate?: string }): Promise<Shift> {
  const userId = randomUUID();
  const posSessionId = randomUUID();
  await updateCashControlSettings(
    { tenantId: scope!.tenantId, userId },
    {
      shiftZReportRequired: opts.zRequired,
      ...(opts.rolloverMode ? { posSessionRolloverMode: opts.rolloverMode as 'OFF' } : {}),
    },
    { userId: realUserId, reason: 'D2 shift report proof' },
  );

  let drawerId: string | null = null;
  let drawerSessionId: string | null = null;
  if (opts.withDrawer) {
    drawerId = await createTestDrawer(scope!, { codePrefix: 'D2-TEST', name: 'D2 shift report' });
    drawerSessionId = (await openTestSession(scope!, userId, drawerId)).sessionId;
  }
  await prisma.$executeRaw`
    INSERT INTO public.org_pos_sessions_mst (
      id, tenant_org_id, branch_id, user_id, session_no, business_date, business_timezone,
      status, opened_at, opened_by, created_by, cash_drawer_id, cash_drawer_session_id
    ) VALUES (
      ${posSessionId}::uuid, ${scope!.tenantId}::uuid, ${scope!.branchId}::uuid, ${userId}::uuid,
      ${`D2-TEST-${posSessionId.slice(0, 8)}`}, ${opts.businessDate ?? new Date().toISOString().slice(0, 10)}::date, ${tenantTz},
      'OPEN', NOW() - INTERVAL '2 hours', ${userId}::uuid, 'd2-test',
      ${drawerId}::uuid, ${drawerSessionId}::uuid
    )`;
  return { userId, posSessionId, drawerId, drawerSessionId };
}

/** Posts one drawer cash line through the production gate and attributes it to the POS session. */
async function postCash(shift: Shift, amount: string, direction: 'IN' | 'OUT') {
  const { lineId } = await stampTestCashLine(scope!, {
    drawerId: shift.drawerId!,
    amount,
    mode: 'INTERACTIVE',
    direction,
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_posted_line_edit = 'on'`);
    await tx.$executeRaw`
      UPDATE public.org_fin_voucher_trx_lines_dtl SET pos_session_id = ${shift.posSessionId}::uuid
      WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${lineId}::uuid`;
  });
}

async function cleanup(shifts: Shift[]): Promise<void> {
  for (const s of shifts) {
    // Drawer first: its cleanup removes the voucher lines that still point at the POS session.
    if (s.drawerId) await cleanupTestDrawers(scope!, [s.drawerId]);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_ledger_edit = 'on'`);
      await tx.$executeRaw`
        DELETE FROM public.org_pos_shift_z_rpt_tr
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${s.posSessionId}::uuid`;
      await tx.$executeRaw`
        DELETE FROM public.org_pos_session_events_dtl
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${s.posSessionId}::uuid`;
      await tx.$executeRaw`
        DELETE FROM public.org_pos_sessions_mst
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${s.posSessionId}::uuid`;
    });
    await prisma.org_fin_cash_ctrl_stng_cf.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: s.userId } });
    await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: s.userId } });
  }
}

describe('POS shift X/Z reports (D2)', () => {
  dbit('closing a session freezes an immutable, hash-verified Z-report whose figures match the drawer ledger', async () => {
    const shift = await createShift({ withDrawer: true, zRequired: true });
    try {
      await postCash(shift, '10.000', 'IN');
      await postCash(shift, '2.500', 'OUT');

      // The live X-report shows the figures while the shift is open, and stores nothing.
      const x = await getLivePosShiftReport({
        tenantId: scope!.tenantId,
        userId: shift.userId,
        posSessionId: shift.posSessionId,
      });
      expect(x.kind).toBe('X');
      expect(x.cash.byCurrency[0]).toMatchObject({ currencyCode: 'OMR', cashIn: '10.0000', cashOut: '2.5000', net: '7.5000' });
      expect(await getShiftZReport({ tenantId: scope!.tenantId, userId: shift.userId, posSessionId: shift.posSessionId })).toBeNull();

      // Drawer first (cash custody), then the POS session — the Z is created inside that close.
      await closeTestSession(scope!, shift.userId, shift.drawerId!, shift.drawerSessionId!, { countedAmount: 7.5 });
      await closePosSession({ tenantId: scope!.tenantId, userId: shift.userId });

      const z = await getShiftZReport({ tenantId: scope!.tenantId, userId: shift.userId, posSessionId: shift.posSessionId });
      expect(z).not.toBeNull();
      expect(z!.sessionStatus).toBe('CLOSED');
      expect(z!.reportNo).toMatch(/^Z-D2-TEST-/);
      expect(z!.hashVerified).toBe(true);
      expect(z!.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
      expect(z!.snapshot.kind).toBe('Z');
      expect(z!.snapshot.cash.byCurrency[0]).toMatchObject({ net: '7.5000', lineCount: 2 });
      expect(z!.snapshot.drawer?.balances[0]).toMatchObject({ closingExpected: '7.5000', closingCounted: '7.5000', closingVariance: '0.0000' });
      expect(z!.snapshot.drawer?.variancePending).toBe(false);

      // Immutable: the database refuses edits and deletes.
      await expect(
        prisma.$executeRaw`UPDATE public.org_pos_shift_z_rpt_tr SET report_no = 'tampered' WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${z!.id}::uuid`,
      ).rejects.toThrow(/Z_REPORT_IMMUTABLE/);
      await expect(
        prisma.$executeRaw`DELETE FROM public.org_pos_shift_z_rpt_tr WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${z!.id}::uuid`,
      ).rejects.toThrow(/Z_REPORT_IMMUTABLE/);

      // Idempotent: a second generation returns the same single report.
      const again = await generateShiftZReport({ tenantId: scope!.tenantId, posSessionId: shift.posSessionId, actorUserId: realUserId });
      expect(again).toEqual({ reportId: z!.id, created: false });
    } finally {
      await cleanup([shift]);
    }
  });

  dbit('a tenant that does not auto-generate gets no Z at close, but can generate one on demand', async () => {
    const shift = await createShift({ withDrawer: false, zRequired: false });
    try {
      // Cannot freeze a shift that is still live.
      await expect(
        generateShiftZReport({ tenantId: scope!.tenantId, posSessionId: shift.posSessionId, actorUserId: realUserId }),
      ).rejects.toMatchObject({ code: POS_SHIFT_REPORT_ERROR.SESSION_NOT_FINISHED });

      await closePosSession({ tenantId: scope!.tenantId, userId: shift.userId });
      expect(await getShiftZReport({ tenantId: scope!.tenantId, userId: shift.userId, posSessionId: shift.posSessionId })).toBeNull();

      const made = await generateShiftZReport({ tenantId: scope!.tenantId, posSessionId: shift.posSessionId, actorUserId: realUserId });
      expect(made.created).toBe(true);
      const z = await getShiftZReport({ tenantId: scope!.tenantId, userId: shift.userId, posSessionId: shift.posSessionId });
      expect(z).toMatchObject({ generatedBy: realUserId, hashVerified: true, sessionStatus: 'CLOSED' });
    } finally {
      await cleanup([shift]);
    }
  });

  dbit('a session of another operator is invisible without view-all, and a rollover force-close freezes a Z', async () => {
    const shift = await createShift({ withDrawer: false, zRequired: true, rolloverMode: 'FORCE_CLOSE_AT_ROLLOVER', businessDate: '2000-01-01' });
    try {
      await expect(
        getLivePosShiftReport({ tenantId: scope!.tenantId, userId: randomUUID(), posSessionId: shift.posSessionId }),
      ).rejects.toMatchObject({ code: 'POS_SESSION_NOT_FOUND' });
      // view-all sees it
      const seen = await getLivePosShiftReport({
        tenantId: scope!.tenantId,
        userId: randomUUID(),
        posSessionId: shift.posSessionId,
        canViewAll: true,
      });
      expect(seen.session.id).toBe(shift.posSessionId);

      const outcome = await runPosSessionRolloverSweep({ tenantId: scope!.tenantId, sessionIds: [shift.posSessionId] });
      expect(outcome).toEqual({ processedCount: 1, failedCount: 0 });

      const z = await getShiftZReport({ tenantId: scope!.tenantId, userId: shift.userId, posSessionId: shift.posSessionId });
      expect(z).toMatchObject({ sessionStatus: 'FORCE_CLOSED', generatedBy: 'system', hashVerified: true });
      expect(z!.snapshot.session.autoCloseReason).toBe('ROLLOVER');
    } finally {
      await cleanup([shift]);
    }
  });
});
