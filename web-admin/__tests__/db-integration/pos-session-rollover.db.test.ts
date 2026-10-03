/**
 * B2 — real-DB proof of the POS-session rollover job (migration 0558): a session whose branch
 * business day has ended is paused or force-closed per policy, can no longer be resumed, a stale
 * session is flagged exactly once, the sweep is idempotent, and it never touches other sessions.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { runPosSessionRolloverSweep } from '@/lib/services/pos-session-rollover.service';
import { resumePosSession } from '@/lib/services/pos-session.service';
import { businessDateForTimezone } from '@/lib/utils/business-date';
import { POS_SESSION_NOTIFICATION_EVENT, POS_SESSION_ROLLOVER_ERROR } from '@/lib/constants/pos-session';
import { resolveTestScope, type DbTestScope } from './helpers/cash-drawer-fixtures';

const mockEmit = jest.fn();
jest.mock('@/lib/notifications/event-emitter', () => ({
  emitNotificationEvent: (...a: unknown[]) => mockEmit(...a),
}));

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

beforeEach(() => mockEmit.mockClear());

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!scope) {
      console.warn(`[pos-session-rollover] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

interface Fixture {
  userId: string;
  sessionId: string;
}

/** A live POS session for a throw-away operator; its policy lives in a USER-scope override. */
async function createLiveSession(opts: {
  businessDate: string;
  openedHoursAgo?: number;
  status?: 'OPEN' | 'PAUSED';
  rolloverMode: 'OFF' | 'PAUSE_AT_ROLLOVER' | 'FORCE_CLOSE_AT_ROLLOVER';
  staleHours?: number;
}): Promise<Fixture> {
  const userId = randomUUID();
  const sessionId = randomUUID();
  await updateCashControlSettings(
    { tenantId: scope!.tenantId, userId },
    { posSessionRolloverMode: opts.rolloverMode, ...(opts.staleHours ? { posSessionStaleHours: opts.staleHours } : {}) },
    { userId: realUserId, reason: 'B2 rollover proof' },
  );
  await prisma.$executeRaw`
    INSERT INTO public.org_pos_sessions_mst (
      id, tenant_org_id, branch_id, user_id, session_no, business_date, business_timezone,
      status, opened_at, opened_by, created_by
    ) VALUES (
      ${sessionId}::uuid, ${scope!.tenantId}::uuid, ${scope!.branchId}::uuid, ${userId}::uuid,
      ${`B2-TEST-${sessionId.slice(0, 8)}`}, ${opts.businessDate}::date, ${tenantTz},
      ${opts.status ?? 'OPEN'},
      NOW() - (${opts.openedHoursAgo ?? 1} * INTERVAL '1 hour'),
      ${userId}::uuid, 'b2-test'
    )`;
  return { userId, sessionId };
}

async function readSession(sessionId: string) {
  const [row] = await prisma.$queryRaw<
    Array<{
      status: string;
      rollover_applied_at: Date | null;
      stale_flagged_at: Date | null;
      auto_close_reason: string | null;
      pause_reason: string | null;
      force_close_reason: string | null;
    }>
  >`SELECT status, rollover_applied_at, stale_flagged_at, auto_close_reason, pause_reason, force_close_reason
    FROM public.org_pos_sessions_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sessionId}::uuid`;
  return row;
}

async function eventTypes(sessionId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ event_type: string }>>`
    SELECT event_type FROM public.org_pos_session_events_dtl
    WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${sessionId}::uuid ORDER BY created_at`;
  return rows.map((r) => r.event_type);
}

async function cleanup(fixtures: Fixture[]): Promise<void> {
  for (const f of fixtures) {
    // A force-closed session also froze a Z-report (immutable: needs the documented maintenance bypass).
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_ledger_edit = 'on'`);
      await tx.$executeRaw`
        DELETE FROM public.org_pos_shift_z_rpt_tr
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${f.sessionId}::uuid`;
      await tx.$executeRaw`
        DELETE FROM public.org_pos_session_events_dtl
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND pos_session_id = ${f.sessionId}::uuid`;
      await tx.$executeRaw`
        DELETE FROM public.org_pos_sessions_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${f.sessionId}::uuid`;
    });
    await prisma.org_fin_cash_ctrl_stng_cf.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: f.userId } });
    await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: f.userId } });
  }
}

const sweep = (sessionIds: string[]) =>
  runPosSessionRolloverSweep({ tenantId: scope!.tenantId, sessionIds });

describe('POS session rollover job (B2)', () => {
  dbit('PAUSE_AT_ROLLOVER pauses a session from a past business day, blocks resume, and is idempotent', async () => {
    const past = await createLiveSession({ businessDate: '2000-01-01', rolloverMode: 'PAUSE_AT_ROLLOVER' });
    const today = await createLiveSession({
      businessDate: businessDateForTimezone(tenantTz),
      rolloverMode: 'PAUSE_AT_ROLLOVER',
    });
    try {
      const first = await sweep([past.sessionId, today.sessionId]);
      expect(first).toEqual({ processedCount: 1, failedCount: 0 });

      const rolled = await readSession(past.sessionId);
      expect(rolled.status).toBe('PAUSED');
      expect(rolled.rollover_applied_at).not.toBeNull();
      expect(rolled.pause_reason).toBe('ROLLOVER');
      expect(await eventTypes(past.sessionId)).toEqual(['ROLLOVER_PAUSE']);

      // A same-day session is left completely alone.
      expect((await readSession(today.sessionId)).status).toBe('OPEN');
      expect(await eventTypes(today.sessionId)).toEqual([]);

      // The supervisors and owner are told, once.
      expect(mockEmit).toHaveBeenCalledTimes(1);
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
        code: POS_SESSION_NOTIFICATION_EVENT.ROLLED_OVER,
        tenantOrgId: scope!.tenantId,
        sourceEntityId: past.sessionId,
      });
      expect(mockEmit.mock.calls[0][0].recipientUserIds).toContain(past.userId);

      // Resuming a rolled-over session is refused — no payment can be booked into a past day.
      await expect(
        resumePosSession({ tenantId: scope!.tenantId, userId: past.userId }),
      ).rejects.toMatchObject({ code: POS_SESSION_ROLLOVER_ERROR.ROLLED_OVER, httpStatus: 409 });

      // A second sweep finds nothing left to do.
      mockEmit.mockClear();
      expect(await sweep([past.sessionId, today.sessionId])).toEqual({ processedCount: 0, failedCount: 0 });
      expect(mockEmit).not.toHaveBeenCalled();
    } finally {
      await cleanup([past, today]);
    }
  });

  dbit('an already-paused session is only stamped, so it can no longer be resumed', async () => {
    const f = await createLiveSession({ businessDate: '2000-01-01', status: 'PAUSED', rolloverMode: 'PAUSE_AT_ROLLOVER' });
    try {
      expect(await sweep([f.sessionId])).toEqual({ processedCount: 1, failedCount: 0 });
      const row = await readSession(f.sessionId);
      expect(row.status).toBe('PAUSED');
      expect(row.rollover_applied_at).not.toBeNull();
      await expect(resumePosSession({ tenantId: scope!.tenantId, userId: f.userId })).rejects.toMatchObject({
        code: POS_SESSION_ROLLOVER_ERROR.ROLLED_OVER,
      });
    } finally {
      await cleanup([f]);
    }
  });

  dbit('FORCE_CLOSE_AT_ROLLOVER force-closes a session with no cash in play and records why', async () => {
    const f = await createLiveSession({ businessDate: '2000-01-01', rolloverMode: 'FORCE_CLOSE_AT_ROLLOVER' });
    try {
      expect(await sweep([f.sessionId])).toEqual({ processedCount: 1, failedCount: 0 });
      const row = await readSession(f.sessionId);
      expect(row.status).toBe('FORCE_CLOSED');
      expect(row.auto_close_reason).toBe('ROLLOVER');
      expect(row.force_close_reason).toBe('ROLLOVER');
      expect(row.rollover_applied_at).not.toBeNull();
      expect(await eventTypes(f.sessionId)).toEqual(['ROLLOVER_FORCE_CLOSE']);
    } finally {
      await cleanup([f]);
    }
  });

  dbit('mode OFF leaves a past-day session untouched', async () => {
    const f = await createLiveSession({ businessDate: '2000-01-01', rolloverMode: 'OFF' });
    try {
      expect(await sweep([f.sessionId])).toEqual({ processedCount: 0, failedCount: 0 });
      expect((await readSession(f.sessionId)).status).toBe('OPEN');
    } finally {
      await cleanup([f]);
    }
  });

  dbit('a session open past the stale threshold is flagged exactly once and the owner is notified', async () => {
    const f = await createLiveSession({
      businessDate: businessDateForTimezone(tenantTz),
      openedHoursAgo: 5.5, // half an hour of slack: the clock the DB stamps with and the one the sweep reads are not the same
      rolloverMode: 'OFF',
      staleHours: 2,
    });
    try {
      expect(await sweep([f.sessionId])).toEqual({ processedCount: 1, failedCount: 0 });
      const row = await readSession(f.sessionId);
      expect(row.stale_flagged_at).not.toBeNull();
      expect(row.status).toBe('OPEN');
      expect(await eventTypes(f.sessionId)).toEqual(['STALE_FLAGGED']);
      expect(mockEmit.mock.calls[0][0]).toMatchObject({ code: POS_SESSION_NOTIFICATION_EVENT.STALE });
      expect(mockEmit.mock.calls[0][0].variables.open_hours).toBe('5');

      mockEmit.mockClear();
      expect(await sweep([f.sessionId])).toEqual({ processedCount: 0, failedCount: 0 });
      expect(mockEmit).not.toHaveBeenCalled();
      expect(await eventTypes(f.sessionId)).toEqual(['STALE_FLAGGED']);
    } finally {
      await cleanup([f]);
    }
  });
});
