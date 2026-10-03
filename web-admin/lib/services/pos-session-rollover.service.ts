import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import { emitNotificationEvent } from '@/lib/notifications/event-emitter';
import { WORKFLOW_SYSTEM_ACTOR } from '@/lib/constants/workflow-system-actor';
import { CASH_DRAWER_TERMINAL_SESSION_STATUSES } from '@/lib/constants/cash-drawer';
import {
  getCashControlSettings,
  withCashControlSettingsCache,
} from '@/lib/services/cash-control-settings.service';
import { recordEventTx } from '@/lib/services/pos-session.service';
import { generateShiftZReportTx } from '@/lib/services/pos-shift-report.service';
import {
  POS_SESSION_AUTO_CLOSE_REASON,
  POS_SESSION_EVENT_TYPE,
  POS_SESSION_NOTIFICATION_EVENT,
  POS_SESSION_ROLLOVER_REASON,
  POS_SESSION_STATUS,
  type PosSessionStatus,
} from '@/lib/constants/pos-session';
import {
  decideRollover,
  isSessionStale,
  openHours,
  ROLLOVER_ACTION,
  type RolloverVerdict,
} from '@/lib/services/pos-session-rollover-model';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Identity the job acts as; recorded in events and the `*_by` columns, never a person. */
const SYSTEM_ACTOR_ID = WORKFLOW_SYSTEM_ACTOR.userId;
const SWEEP_SOURCE = 'pos_session_rollover';

/** Optional narrowing of a sweep; the scheduled job passes none and sweeps everything. */
export interface PosSessionRolloverSweepOptions {
  now?: Date;
  tenantId?: string;
  sessionIds?: readonly string[];
}

/** What one sweep did, for the run log and the ops hub. */
export interface PosSessionRolloverOutcome {
  /** Sessions the job changed (paused, force-closed, marked rolled over, or flagged stale). */
  processedCount: number;
  /** Sessions it could not process (bad timezone, unexpected error). */
  failedCount: number;
}

interface LiveSessionRow {
  id: string;
  branch_id: string;
  user_id: string;
  session_no: string;
  business_date: Date | string;
  status: string;
  opened_at: Date | string;
  rollover_applied_at: Date | string | null;
  stale_flagged_at: Date | string | null;
  drawer_session_status: string | null;
  timezone: string | null;
  branch_name: string | null;
  operator_name: string | null;
}

interface PendingNotification {
  eventCode: string;
  tenantId: string;
  session: LiveSessionRow;
  sessionId: string;
  variables: Record<string, string>;
}

const dateOnly = (value: Date | string): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function listLiveSessions(tenantId: string): Promise<LiveSessionRow[]> {
  return prisma.$queryRaw<LiveSessionRow[]>(Prisma.sql`
    SELECT
      ps.id, ps.branch_id, ps.user_id, ps.session_no, ps.business_date, ps.status,
      ps.opened_at, ps.rollover_applied_at, ps.stale_flagged_at,
      cds.status AS drawer_session_status,
      COALESCE(b.timezone_code, t.timezone) AS timezone,
      COALESCE(b.name, b.branch_name) AS branch_name,
      COALESCE(u.display_name, u.name, u.email) AS operator_name
    FROM public.org_pos_sessions_mst ps
    JOIN public.org_tenants_mst t
      ON t.id = ps.tenant_org_id
    LEFT JOIN public.org_branches_mst b
      ON b.tenant_org_id = ps.tenant_org_id AND b.id = ps.branch_id
    LEFT JOIN public.org_cash_drawer_sessions_mst cds
      ON cds.tenant_org_id = ps.tenant_org_id AND cds.id = ps.cash_drawer_session_id
    LEFT JOIN public.org_users_mst u
      ON u.tenant_org_id = ps.tenant_org_id AND u.user_id = ps.user_id
    WHERE ps.tenant_org_id = ${tenantId}::uuid
      AND ps.status IN (${POS_SESSION_STATUS.OPEN}, ${POS_SESSION_STATUS.PAUSED})
      AND ps.is_active = TRUE
    ORDER BY ps.opened_at ASC
  `);
}

/**
 * Supervisors who should hear about a session of this branch: holders of the tenant-wide
 * `pos_session:force_close` permission who either work in that branch or oversee every branch.
 */
async function listSessionSupervisors(
  db: Pick<PrismaTx, '$queryRaw'>,
  tenantId: string,
  branchId: string
): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ user_id: string }>>(Prisma.sql`
    SELECT DISTINCT u.user_id
    FROM public.org_users_mst u
    JOIN public.cmx_effective_permissions p
      ON p.tenant_org_id = u.tenant_org_id
     AND p.user_id = u.user_id
    WHERE u.tenant_org_id = ${tenantId}::uuid
      AND COALESCE(u.is_active, TRUE) = TRUE
      AND p.permission_code = 'pos_session:force_close'
      AND p.allow = TRUE
      AND p.resource_type IS NULL
      AND (
        u.main_branch_id = ${branchId}::uuid
        OR EXISTS (
          SELECT 1 FROM public.cmx_effective_permissions a
          WHERE a.tenant_org_id = u.tenant_org_id
            AND a.user_id = u.user_id
            AND a.permission_code = 'cash_drawer:view_all_branches'
            AND a.allow = TRUE
            AND a.resource_type IS NULL
        )
      )
  `);
  return rows.map((row) => row.user_id);
}

/** Stamps the session and writes its timeline event; returns the notification to send after commit. */
async function applyRolloverTx(
  tx: PrismaTx,
  tenantId: string,
  session: LiveSessionRow,
  verdict: RolloverVerdict,
  currentBusinessDate: string,
  generateZReport: boolean
): Promise<PendingNotification | null> {
  const status = session.status as PosSessionStatus;
  const metadata = {
    system: true,
    job: SWEEP_SOURCE,
    sessionBusinessDate: dateOnly(session.business_date),
    currentBusinessDate,
    timezone: session.timezone,
    blockedByDrawer: verdict.blockedByDrawer,
  };

  if (verdict.action === ROLLOVER_ACTION.FORCE_CLOSE) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE public.org_pos_sessions_mst
      SET status = ${POS_SESSION_STATUS.FORCE_CLOSED},
          force_closed_at = NOW(),
          force_closed_by = ${SYSTEM_ACTOR_ID}::uuid,
          force_close_reason = ${POS_SESSION_ROLLOVER_REASON},
          auto_close_reason = ${POS_SESSION_AUTO_CLOSE_REASON.ROLLOVER},
          rollover_applied_at = NOW(),
          updated_at = NOW(),
          updated_by = ${SYSTEM_ACTOR_ID}
      WHERE tenant_org_id = ${tenantId}::uuid AND id = ${session.id}::uuid
    `);
    await recordEventTx(tx, {
      tenantId,
      sessionId: session.id,
      eventType: POS_SESSION_EVENT_TYPE.ROLLOVER_FORCE_CLOSE,
      previousStatus: status,
      newStatus: POS_SESSION_STATUS.FORCE_CLOSED,
      performedBy: SYSTEM_ACTOR_ID,
      reason: POS_SESSION_ROLLOVER_REASON,
      sourceChannel: SWEEP_SOURCE,
      metadata,
    });
    // The shift ended: freeze its Z-report in this same transaction when the tenant requires one.
    if (generateZReport) {
      await generateShiftZReportTx(tx, { tenantId, posSessionId: session.id, generatedBy: 'system' });
    }
  } else if (verdict.action === ROLLOVER_ACTION.PAUSE) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE public.org_pos_sessions_mst
      SET status = ${POS_SESSION_STATUS.PAUSED},
          paused_at = NOW(),
          paused_by = ${SYSTEM_ACTOR_ID}::uuid,
          pause_reason = ${POS_SESSION_ROLLOVER_REASON},
          rollover_applied_at = NOW(),
          updated_at = NOW(),
          updated_by = ${SYSTEM_ACTOR_ID}
      WHERE tenant_org_id = ${tenantId}::uuid AND id = ${session.id}::uuid
    `);
    await recordEventTx(tx, {
      tenantId,
      sessionId: session.id,
      eventType: POS_SESSION_EVENT_TYPE.ROLLOVER_PAUSE,
      previousStatus: status,
      newStatus: POS_SESSION_STATUS.PAUSED,
      performedBy: SYSTEM_ACTOR_ID,
      reason: POS_SESSION_ROLLOVER_REASON,
      sourceChannel: SWEEP_SOURCE,
      metadata,
    });
  } else if (verdict.action === ROLLOVER_ACTION.MARK_ONLY) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE public.org_pos_sessions_mst
      SET rollover_applied_at = NOW(), updated_at = NOW(), updated_by = ${SYSTEM_ACTOR_ID}
      WHERE tenant_org_id = ${tenantId}::uuid AND id = ${session.id}::uuid
    `);
    await recordEventTx(tx, {
      tenantId,
      sessionId: session.id,
      eventType: POS_SESSION_EVENT_TYPE.ROLLOVER_PAUSE,
      previousStatus: status,
      newStatus: status,
      performedBy: SYSTEM_ACTOR_ID,
      reason: POS_SESSION_ROLLOVER_REASON,
      sourceChannel: SWEEP_SOURCE,
      metadata,
    });
  } else {
    return null;
  }

  const forceClosed = verdict.action === ROLLOVER_ACTION.FORCE_CLOSE;
  return {
    eventCode: POS_SESSION_NOTIFICATION_EVENT.ROLLED_OVER,
    tenantId,
    session,
    sessionId: session.id,
    variables: {
      session_no: session.session_no,
      operator_name: session.operator_name ?? '',
      branch_name: session.branch_name ?? '',
      business_date: dateOnly(session.business_date),
      // The EN template reads {{action}}, the AR one {{action2}} (see POST-MIGRATION note of 0561).
      action: forceClosed ? 'force-closed' : 'paused',
      action2: forceClosed ? 'أُغلقت إجبارياً' : 'أُوقفت مؤقتاً',
    },
  };
}

async function applyStaleTx(
  tx: PrismaTx,
  tenantId: string,
  session: LiveSessionRow,
  now: Date
): Promise<PendingNotification> {
  const hours = openHours(session.opened_at, now);
  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_pos_sessions_mst
    SET stale_flagged_at = NOW(), updated_at = NOW(), updated_by = ${SYSTEM_ACTOR_ID}
    WHERE tenant_org_id = ${tenantId}::uuid AND id = ${session.id}::uuid
  `);
  await recordEventTx(tx, {
    tenantId,
    sessionId: session.id,
    eventType: POS_SESSION_EVENT_TYPE.STALE_FLAGGED,
    previousStatus: session.status as PosSessionStatus,
    newStatus: session.status as PosSessionStatus,
    performedBy: SYSTEM_ACTOR_ID,
    sourceChannel: SWEEP_SOURCE,
    metadata: { system: true, job: SWEEP_SOURCE, openHours: hours },
  });
  return {
    eventCode: POS_SESSION_NOTIFICATION_EVENT.STALE,
    tenantId,
    session,
    sessionId: session.id,
    variables: {
      session_no: session.session_no,
      operator_name: session.operator_name ?? '',
      branch_name: session.branch_name ?? '',
      open_hours: String(hours),
    },
  };
}

/**
 * Processes one live session in its own transaction. The row is re-read `FOR UPDATE` so a cashier
 * closing the session at the same moment wins and the job skips it — it never overrides a person.
 */
async function processSession(
  tenantId: string,
  listed: LiveSessionRow,
  now: Date
): Promise<PendingNotification | 'SKIPPED' | 'BAD_TIMEZONE' | null> {
  if (!isValidTimeZone(listed.timezone)) return 'BAD_TIMEZONE';

  const settings = await getCashControlSettings({
    tenantId,
    branchId: listed.branch_id,
    userId: listed.user_id,
  });
  const currentBusinessDate = businessDateForTimezone(listed.timezone, now);

  return withTenantContext(tenantId, () =>
    prisma.$transaction(async (tx) => {
      const fresh = await tx.$queryRaw<
        Array<Pick<LiveSessionRow, 'status' | 'rollover_applied_at' | 'stale_flagged_at'>>
      >(Prisma.sql`
        SELECT status, rollover_applied_at, stale_flagged_at
        FROM public.org_pos_sessions_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${listed.id}::uuid
          AND status IN (${POS_SESSION_STATUS.OPEN}, ${POS_SESSION_STATUS.PAUSED})
          AND is_active = TRUE
        FOR UPDATE
      `);
      if (!fresh[0]) return 'SKIPPED' as const;
      const session: LiveSessionRow = { ...listed, ...fresh[0] };

      const drawerStillOpen =
        session.drawer_session_status !== null &&
        !(CASH_DRAWER_TERMINAL_SESSION_STATUSES as readonly string[]).includes(
          session.drawer_session_status
        );

      const verdict = decideRollover({
        mode: settings.posSessionRolloverMode,
        status: session.status as PosSessionStatus,
        businessDate: dateOnly(session.business_date),
        currentBusinessDate,
        rolloverAppliedAt: session.rollover_applied_at,
        drawerStillOpen,
      });
      if (verdict.action !== ROLLOVER_ACTION.NONE) {
        return applyRolloverTx(
          tx,
          tenantId,
          session,
          verdict,
          currentBusinessDate,
          settings.shiftZReportRequired
        );
      }

      if (
        isSessionStale({
          status: session.status as PosSessionStatus,
          openedAt: session.opened_at,
          staleFlaggedAt: session.stale_flagged_at,
          staleHours: Number(settings.posSessionStaleHours),
          now,
        })
      ) {
        return applyStaleTx(tx, tenantId, session, now);
      }
      return null;
    })
  );
}

/** Sends the notification after the session change has committed; never throws. */
async function notify(pending: PendingNotification): Promise<void> {
  try {
    const supervisors = await withTenantContext(pending.tenantId, () =>
      listSessionSupervisors(prisma, pending.tenantId, pending.session.branch_id)
    );
    const recipients = [...new Set([pending.session.user_id, ...supervisors])];
    await emitNotificationEvent({
      code: pending.eventCode,
      tenantOrgId: pending.tenantId,
      recipientUserIds: recipients,
      sourceEntityType: 'pos_session',
      sourceEntityId: pending.sessionId,
      variables: pending.variables,
      actionUrl: '/dashboard/internal_fin/pos-sessions',
      actionLabel: 'Open POS Sessions',
      actionLabel2: 'فتح جلسات نقطة البيع',
    });
  } catch (err) {
    logger.error('POS session rollover notification failed', err as Error, {
      feature: 'pos-session-rollover',
      sessionId: pending.sessionId,
    });
  }
}

/**
 * The scheduled `pos_session_rollover` job: for every live POS session, apply the tenant's
 * rollover policy once the *branch* business day has moved past the session's business date, and
 * flag sessions that stayed live longer than the stale threshold.
 *
 * Idempotent and safe to run often (every 15 minutes): a session already rolled over or flagged is
 * left alone, a session closed by a person in the meantime is skipped, and one session's failure
 * never blocks the rest.
 *
 * @param options `now` is the sweep instant (injectable for tests, default the current time);
 *   `tenantId` and `sessionIds` narrow the sweep (a manual one-tenant run, or a test that must not
 *   touch anyone else's live sessions)
 * @returns counts of sessions changed and sessions that failed
 * @example
 * const { processedCount, failedCount } = await runPosSessionRolloverSweep();
 */
export async function runPosSessionRolloverSweep(
  options: PosSessionRolloverSweepOptions = {}
): Promise<PosSessionRolloverOutcome> {
  const now = options.now ?? new Date();
  const onlySessions = options.sessionIds ? new Set(options.sessionIds) : null;
  // Cross-tenant discovery only: which tenants have live sessions at all. Every query after this
  // is scoped to one tenant_org_id and runs under that tenant's context.
  const tenants = await prisma.$queryRaw<Array<{ tenant_org_id: string }>>(Prisma.sql`
    SELECT DISTINCT tenant_org_id
    FROM public.org_pos_sessions_mst
    WHERE status IN (${POS_SESSION_STATUS.OPEN}, ${POS_SESSION_STATUS.PAUSED}) AND is_active = TRUE
      ${options.tenantId ? Prisma.sql`AND tenant_org_id = ${options.tenantId}::uuid` : Prisma.empty}
  `);

  let processedCount = 0;
  let failedCount = 0;

  for (const { tenant_org_id: tenantId } of tenants) {
    try {
      await withCashControlSettingsCache(async () => {
        const sessions = await withTenantContext(tenantId, () => listLiveSessions(tenantId));
        for (const listed of sessions) {
          if (onlySessions && !onlySessions.has(listed.id)) continue;
          try {
            const result = await processSession(tenantId, listed, now);
            if (result === 'BAD_TIMEZONE') {
              failedCount += 1;
              logger.warn('POS session rollover skipped: no valid timezone', {
                feature: 'pos-session-rollover',
                tenantId,
                branchId: listed.branch_id,
                sessionId: listed.id,
              });
            } else if (result && result !== 'SKIPPED') {
              processedCount += 1;
              await notify(result);
            }
          } catch (err) {
            failedCount += 1;
            logger.error('POS session rollover failed for session', err as Error, {
              feature: 'pos-session-rollover',
              tenantId,
              sessionId: listed.id,
            });
          }
        }
      });
    } catch (err) {
      failedCount += 1;
      logger.error('POS session rollover failed for tenant', err as Error, {
        feature: 'pos-session-rollover',
        tenantId,
      });
    }
  }

  return { processedCount, failedCount };
}
