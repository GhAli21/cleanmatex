import 'server-only';

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import { toMoneyString } from '@/lib/utils/money';
import { getCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { sumLedgerWindow } from '@/lib/services/cash-drawer-ledger/cash-drawer-ledger.repository';
import { CASH_DRAWER_TERMINAL_SESSION_STATUSES } from '@/lib/constants/cash-drawer';
import {
  POS_SESSION_EVENT_TYPE,
  POS_SESSION_IDEMPOTENCY_RESOURCE,
  POS_SESSION_ROLLOVER_ERROR,
  POS_SESSION_SHARING_ERROR,
  POS_SESSION_STATUS,
  isPosSessionRequired,
  type FinanceTenderScope,
  type PosSessionEventType,
  type PosSessionStatus,
  type PosSessionSurface,
} from '@/lib/constants/pos-session';
import { CASH_CONTROL_SHARED_SESSION_MODE, POS_SESSION_SURFACE_SETTING_FIELD } from '@/lib/constants/cash-control';
import type {
  GetMyActivePosSessionResult,
  OpenPosSessionResult,
  PosSessionIdempotentResult,
  PosSessionEventListResult,
  PosSessionEventListRow,
  PosSessionFilterOption,
  PosSessionFilterOptionsResult,
  PosSessionFilterOptionType,
  PosSessionLifecycleResult,
  PosSessionListResult,
  PosSessionListRow,
  PosSessionMetadata,
  PosSessionRecordState,
  PosSessionRow,
  PosSessionDrawerCashStatement,
  PosSessionSummary,
  PosSessionWithContext,
} from '@/lib/types/pos-session';

import { PosSessionError } from '@/lib/services/pos-session-error';
import { loadPosSessionOrdersCreated, loadPosSessionRollup } from '@/lib/services/pos-session-rollup';
import { generateShiftZReportTx } from '@/lib/services/pos-shift-report.service';

export { PosSessionError, loadPosSessionOrdersCreated, loadPosSessionRollup };

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface OpenPosSessionInput {
  tenantId: string;
  /** Session owner — whose active-session slot this consumes. */
  userId: string;
  /** Actor actually performing the open. Defaults to `userId` for self-service opens. */
  performedBy?: string;
  branchId: string;
  terminalId?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
  autoOpen?: boolean;
}

interface LifecycleInput {
  tenantId: string;
  /** Session owner — whose active session this transition targets. */
  userId: string;
  /** Actor actually performing the transition. Defaults to `userId` for self-service calls. */
  performedBy?: string;
  reason?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
  /**
   * Admin override (close_others/full_manage_others paths only): skip the
   * linked-cash-drawer-must-be-closed check for a stuck/abandoned session.
   * Never set for a user's own close/force-close.
   */
  bypassDrawerCheck?: boolean;
}

interface PosSessionFinanceContextInput {
  tenantId: string;
  userId: string;
  posSessionId?: string | null;
  branchId?: string | null;
}

interface ResolvePosSessionForFinanceInput extends PosSessionFinanceContextInput {
  /** The finance screen doing the write; its policy decides whether a session is mandatory. */
  surface: PosSessionSurface;
  tenderScope: FinanceTenderScope;
}

interface AutoLinkDrawerInput extends PosSessionFinanceContextInput {
  cashDrawerSessionId?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
}

/** States that still reserve an operator's one active-session slot. */
const ACTIVE_STATUSES = [POS_SESSION_STATUS.OPEN, POS_SESSION_STATUS.PAUSED] as const;
// Seven days retains retries across transient client failures without indefinitely retaining response payloads.
const IDEMPOTENCY_TTL_DAYS = 7;

function serializeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function normalizeDateOnly(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function normalizeDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeSession(row: PosSessionRow): PosSessionRow {
  return {
    ...row,
    business_date: normalizeDateOnly(row.business_date),
    opened_at: normalizeDateTime(row.opened_at) ?? '',
    paused_at: normalizeDateTime(row.paused_at),
    closed_at: normalizeDateTime(row.closed_at),
    force_closed_at: normalizeDateTime(row.force_closed_at),
    created_at: normalizeDateTime(row.created_at) ?? '',
    updated_at: normalizeDateTime(row.updated_at),
  };
}

function normalizeSessionListRow(row: PosSessionListRow): PosSessionListRow {
  return normalizeSessionWithContext(row);
}

function normalizeCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOptionalAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSessionWithContext(row: PosSessionWithContext): PosSessionWithContext {
  return {
    ...row,
    ...normalizeSession(row),
    orders_created_count: normalizeCount(row.orders_created_count),
    cash_drawer_opening_balance: normalizeOptionalAmount(row.cash_drawer_opening_balance),
    cash_drawer_total_in: normalizeOptionalAmount(row.cash_drawer_total_in),
    cash_drawer_total_out: normalizeOptionalAmount(row.cash_drawer_total_out),
    cash_drawer_current_balance: normalizeOptionalAmount(row.cash_drawer_current_balance),
  };
}

/** Live drawer cash since open. Stored balance columns stay 0 until the session is closed. */
async function attachDrawerCashPosition(
  db: Pick<typeof prisma, '$queryRaw'>,
  tenantId: string,
  session: PosSessionWithContext,
): Promise<PosSessionWithContext> {
  const empty = {
    cash_drawer_total_in: null,
    cash_drawer_total_out: null,
    cash_drawer_current_balance: null,
  };
  if (!session.cash_drawer_id || !session.cash_drawer_session_id) {
    return { ...session, ...empty };
  }

  const seqRows = await db.$queryRaw<Array<{ open_ledger_seq: bigint | number | string | null }>>(Prisma.sql`
    SELECT open_ledger_seq
    FROM public.org_cash_drawer_sessions_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id = ${session.cash_drawer_session_id}::uuid
      AND cash_drawer_id = ${session.cash_drawer_id}::uuid
    LIMIT 1
  `);
  const rawSeq = seqRows[0]?.open_ledger_seq;
  if (rawSeq == null) return { ...session, ...empty };

  const windows = await sumLedgerWindow(
    db as Prisma.TransactionClient,
    tenantId,
    session.cash_drawer_id,
    BigInt(rawSeq),
    null,
  );
  const currency = session.cash_drawer_currency_code;
  const match = currency ? windows.find((window) => window.currencyCode === currency) : undefined;
  const totalIn = (match?.finIn ?? new Decimal(0)).plus(match?.trxIn ?? 0);
  const totalOut = (match?.finOut ?? new Decimal(0)).plus(match?.trxOut ?? 0);
  const current = new Decimal(session.cash_drawer_opening_balance ?? 0).plus(totalIn).minus(totalOut);

  return {
    ...session,
    cash_drawer_total_in: totalIn.toNumber(),
    cash_drawer_total_out: totalOut.toNumber(),
    cash_drawer_current_balance: current.toNumber(),
  };
}

function sessionNoForDate(businessDate: string): string {
  return `POS-${businessDate.replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function lockUserSessionScope(tx: PrismaTx, tenantId: string, userId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${userId}:pos_session`}))
  `);
}

async function getActiveSessionForUser(
  db: Pick<typeof prisma, '$queryRaw'>,
  tenantId: string,
  userId: string
): Promise<PosSessionRow | null> {
  const rows = await db.$queryRaw<PosSessionRow[]>(Prisma.sql`
    SELECT *
    FROM public.org_pos_sessions_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND user_id = ${userId}::uuid
      AND status IN (${Prisma.join([...ACTIVE_STATUSES])})
      AND is_active = TRUE
    ORDER BY opened_at DESC
    LIMIT 1
  `);
  return rows[0] ? normalizeSession(rows[0]) : null;
}

async function getActiveSessionForUserWithContext(
  db: Pick<typeof prisma, '$queryRaw'>,
  tenantId: string,
  userId: string,
  includeDrawerContext: boolean
): Promise<PosSessionWithContext | null> {
  const drawerNameSql = includeDrawerContext
    ? Prisma.sql`cd.drawer_name AS cash_drawer_name`
    : Prisma.sql`NULL::text AS cash_drawer_name`;
  const drawerSessionNoSql = includeDrawerContext
    ? Prisma.sql`cds.session_no AS cash_drawer_session_no`
    : Prisma.sql`NULL::text AS cash_drawer_session_no`;
  const drawerSessionStatusSql = includeDrawerContext
    ? Prisma.sql`cds.status AS cash_drawer_session_status`
    : Prisma.sql`NULL::text AS cash_drawer_session_status`;
  const drawerOpeningBalanceSql = includeDrawerContext
    ? Prisma.sql`COALESCE(cdb.opening_counted, cds.opening_float_amount) AS cash_drawer_opening_balance`
    : Prisma.sql`NULL::numeric AS cash_drawer_opening_balance`;
  const drawerCurrencySql = includeDrawerContext
    ? Prisma.sql`cd.currency_code AS cash_drawer_currency_code`
    : Prisma.sql`NULL::text AS cash_drawer_currency_code`;

  const rows = await db.$queryRaw<PosSessionWithContext[]>(Prisma.sql`
    SELECT
      ps.*,
      COALESCE(b.name, b.branch_name) AS branch_name,
      b.name2 AS branch_name2,
      pt.terminal_name,
      pt.terminal_code,
      ${drawerNameSql},
      ${drawerSessionNoSql},
      ${drawerSessionStatusSql},
      ${drawerOpeningBalanceSql},
      ${drawerCurrencySql},
      (
        SELECT COUNT(*)::int
        FROM public.org_orders_mst o
        WHERE o.tenant_org_id = ps.tenant_org_id
          AND o.created_pos_session_id = ps.id
          AND COALESCE(o.rec_status, 1) <> 0
      ) AS orders_created_count,
      NULL::text AS user_display_name,
      NULL::text AS opened_by_display_name,
      NULL::text AS paused_by_display_name,
      NULL::text AS closed_by_display_name,
      NULL::text AS force_closed_by_display_name,
      NULL::text AS created_by_display_name,
      NULL::text AS updated_by_display_name
    FROM public.org_pos_sessions_mst ps
    LEFT JOIN public.org_branches_mst b
      ON b.tenant_org_id = ps.tenant_org_id
     AND b.id = ps.branch_id
    LEFT JOIN public.org_payment_terminals_cf pt
      ON pt.tenant_org_id = ps.tenant_org_id
     AND pt.id = ps.terminal_id
    LEFT JOIN public.org_cash_drawers_mst cd
      ON cd.tenant_org_id = ps.tenant_org_id
     AND cd.id = ps.cash_drawer_id
    LEFT JOIN public.org_cash_drawer_sessions_mst cds
      ON cds.tenant_org_id = ps.tenant_org_id
     AND cds.id = ps.cash_drawer_session_id
    LEFT JOIN public.org_cash_drawer_ses_bal_dtl cdb
      ON cdb.tenant_org_id = cds.tenant_org_id
     AND cdb.cash_drawer_session_id = cds.id
     AND cdb.currency_code = cd.currency_code
     AND cdb.is_active = TRUE
    WHERE ps.tenant_org_id = ${tenantId}::uuid
      AND ps.user_id = ${userId}::uuid
      AND ps.status IN (${Prisma.join([...ACTIVE_STATUSES])})
      AND ps.is_active = TRUE
    ORDER BY ps.opened_at DESC
    LIMIT 1
  `);
  const row = rows[0] ? normalizeSessionWithContext(rows[0]) : null;
  if (!row || !includeDrawerContext) return row;
  return attachDrawerCashPosition(db, tenantId, row);
}

async function getActiveSessionForUserForUpdate(
  tx: PrismaTx,
  tenantId: string,
  userId: string
): Promise<PosSessionRow | null> {
  const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
    SELECT *
    FROM public.org_pos_sessions_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND user_id = ${userId}::uuid
      AND status IN (${Prisma.join([...ACTIVE_STATUSES])})
      AND is_active = TRUE
    ORDER BY opened_at DESC
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] ? normalizeSession(rows[0]) : null;
}

async function assertBranchExists(tx: PrismaTx, tenantId: string, branchId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.org_branches_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id = ${branchId}::uuid
      AND COALESCE(is_active, TRUE) = TRUE
      AND COALESCE(rec_status, 1) = 1
    LIMIT 1
  `);
  if (!rows[0]) {
    throw new PosSessionError('POS_SESSION_BRANCH_NOT_FOUND', 'Branch was not found for this tenant.', 404);
  }
}

async function assertTerminalIsUsable(
  tx: PrismaTx,
  tenantId: string,
  branchId: string,
  terminalId?: string | null
): Promise<void> {
  if (!terminalId) return;

  const rows = await tx.$queryRaw<Array<{ id: string; branch_id: string | null }>>(Prisma.sql`
    SELECT id, branch_id
    FROM public.org_payment_terminals_cf
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id = ${terminalId}::uuid
      AND is_active = TRUE
      AND rec_status = 1
    LIMIT 1
  `);
  const terminal = rows[0];
  if (!terminal) {
    throw new PosSessionError('POS_SESSION_TERMINAL_NOT_FOUND', 'Terminal was not found for this tenant.', 404);
  }
  if (terminal.branch_id && terminal.branch_id !== branchId) {
    throw new PosSessionError(
      'POS_SESSION_TERMINAL_BRANCH_MISMATCH',
      'Terminal belongs to a different branch.',
      409
    );
  }
}

async function assertUserExists(tx: PrismaTx, tenantId: string, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ user_id: string }>>(Prisma.sql`
    SELECT user_id
    FROM public.org_users_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND user_id = ${userId}::uuid
      AND COALESCE(is_active, TRUE) = TRUE
    LIMIT 1
  `);
  if (!rows[0]) {
    throw new PosSessionError('POS_SESSION_TARGET_USER_NOT_FOUND', 'Target user was not found for this tenant.', 404);
  }
}

/**
 * The IANA timezone that decides a branch's business date: the branch's own `timezone_code`,
 * else the tenant's. There is deliberately no fallback zone — a branch and tenant with no valid
 * timezone is a configuration error, reported instead of silently booking into the wrong day.
 */
export async function resolveBranchBusinessTimezone(
  db: Pick<PrismaTx, '$queryRaw'>,
  tenantId: string,
  branchId: string
): Promise<string> {
  const rows = await db.$queryRaw<Array<{ timezone: string | null }>>(Prisma.sql`
    SELECT COALESCE(b.timezone_code, t.timezone) AS timezone
    FROM public.org_tenants_mst t
    LEFT JOIN public.org_branches_mst b
      ON b.tenant_org_id = t.id
     AND b.id = ${branchId}::uuid
    WHERE t.id = ${tenantId}::uuid
    LIMIT 1
  `);
  const timezone = rows[0]?.timezone ?? null;
  if (!isValidTimeZone(timezone)) {
    throw new PosSessionError(
      POS_SESSION_ROLLOVER_ERROR.TENANT_TIMEZONE_NOT_CONFIGURED,
      'No valid timezone is configured for this branch or organization. Set one before opening a POS session.',
      409,
      { branchId }
    );
  }
  return timezone;
}

export async function recordEventTx(
  tx: PrismaTx,
  input: {
    tenantId: string;
    sessionId: string;
    eventType: PosSessionEventType;
    previousStatus?: PosSessionStatus | null;
    newStatus?: PosSessionStatus | null;
    performedBy: string;
    reason?: string | null;
    idempotencyKey?: string | null;
    sourceChannel?: string | null;
    metadata?: PosSessionMetadata;
  }
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO public.org_pos_session_events_dtl (
      tenant_org_id, pos_session_id, event_type,
      previous_status, new_status, performed_by,
      reason, idempotency_key, source_channel, metadata,
      created_by
    )
    VALUES (
      ${input.tenantId}::uuid, ${input.sessionId}::uuid, ${input.eventType},
      ${input.previousStatus ?? null}, ${input.newStatus ?? null}, ${input.performedBy}::uuid,
      ${input.reason ?? null}, ${input.idempotencyKey ?? null}, ${input.sourceChannel ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      ${input.performedBy}
    )
  `);
}

async function readIdempotencyResult<T extends PosSessionIdempotentResult>(
  tx: PrismaTx,
  tenantId: string,
  key: string | null | undefined,
  resourceType: string
): Promise<T | null> {
  if (!key) return null;
  const existing = await tx.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key,
      resource_type: resourceType,
    },
    select: { response_cache: true },
  });
  return existing?.response_cache ? (existing.response_cache as unknown as T) : null;
}

async function storeIdempotencyResult(
  tx: PrismaTx,
  input: {
    tenantId: string;
    key?: string | null;
    resourceType: string;
    resourceId?: string | null;
    result: PosSessionIdempotentResult;
  }
): Promise<void> {
  if (!input.key) return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000);
  await tx.org_idempotency_keys.upsert({
    where: {
      tenant_org_id_key_resource_type: {
        tenant_org_id: input.tenantId,
        key: input.key,
        resource_type: input.resourceType,
      },
    },
    create: {
      tenant_org_id: input.tenantId,
      key: input.key,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      response_cache: serializeJson(input.result),
      created_at: now,
      expires_at: expiresAt,
    },
    update: {
      resource_id: input.resourceId ?? null,
      response_cache: serializeJson(input.result),
      expires_at: expiresAt,
    },
  });
}

async function assertLinkedDrawerIsClosed(tx: PrismaTx, session: PosSessionRow): Promise<void> {
  if (!session.cash_drawer_session_id) return;

  const rows = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`
    SELECT status
    FROM public.org_cash_drawer_sessions_mst
    WHERE tenant_org_id = ${session.tenant_org_id}::uuid
      AND id = ${session.cash_drawer_session_id}::uuid
    LIMIT 1
  `);
  // Allow-list (CLF-4-5): any non-terminal status — OPEN, CLOSING — still has cash in play,
  // so a status added later can never silently let the POS session close first.
  const drawerStatus = rows[0]?.status;
  if (drawerStatus && !(CASH_DRAWER_TERMINAL_SESSION_STATUSES as readonly string[]).includes(drawerStatus)) {
    throw new PosSessionError(
      'POS_SESSION_DRAWER_STILL_OPEN',
      'Linked cash drawer session must be closed before closing the POS session.',
      409
    );
  }
}

async function getPosSessionForUpdateById(
  tx: PrismaTx,
  input: Required<Pick<PosSessionFinanceContextInput, 'tenantId' | 'userId'>> & {
    posSessionId: string;
  }
): Promise<PosSessionRow> {
  const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
    SELECT *
    FROM public.org_pos_sessions_mst
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${input.posSessionId}::uuid
      AND user_id = ${input.userId}::uuid
      AND status = ${POS_SESSION_STATUS.OPEN}
      AND is_active = TRUE
    LIMIT 1
    FOR UPDATE
  `);
  const session = rows[0] ? normalizeSession(rows[0]) : null;
  if (!session) {
    throw new PosSessionError(
      'POS_SESSION_OPEN_NOT_FOUND',
      'Open POS session was not found for the current user.',
      409
    );
  }
  return session;
}

/**
 * Resolves the owning user and status of a POS session for authorization
 * decisions (own-session vs. acting-on-another-user's-session) before a
 * lifecycle action is attempted. Tenant-scoped.
 *
 * @param input - Tenant and session to look up.
 * @returns The session's owner `userId` and current status, or null if not found.
 *
 * @example
 * const owner = await getPosSessionOwner({ tenantId: 'tenant-uuid', posSessionId: 'session-uuid' });
 */
export async function getPosSessionOwner(input: {
  tenantId: string;
  posSessionId: string;
}): Promise<{ userId: string; status: PosSessionStatus; branchId: string } | null> {
  return withTenantContext(input.tenantId, async () => {
    const rows = await prisma.$queryRaw<Array<{ user_id: string; status: PosSessionStatus; branch_id: string }>>(Prisma.sql`
      SELECT user_id, status, branch_id
      FROM public.org_pos_sessions_mst
      WHERE tenant_org_id = ${input.tenantId}::uuid
        AND id = ${input.posSessionId}::uuid
        AND is_active = TRUE
      LIMIT 1
    `);
    const row = rows[0];
    return row ? { userId: row.user_id, status: row.status, branchId: row.branch_id } : null;
  });
}

/**
 * Locks and validates a POS session before a financial write can reference it.
 *
 * @param tx - Existing tenant-scoped transaction that owns the financial write.
 * @param input - Tenant, actor, session, and optional branch context.
 * @returns The locked open session, or null when the write is not POS-linked.
 * @throws PosSessionError when ownership, state, or branch lineage is invalid.
 *
 * @example
 * const session = await assertOpenPosSessionForFinanceTx(tx, { tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid' });
 */
export async function assertOpenPosSessionForFinanceTx(
  tx: PrismaTx,
  input: PosSessionFinanceContextInput
): Promise<PosSessionRow | null> {
  if (!input.posSessionId) return null;

  const session = await getPosSessionForUpdateById(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    posSessionId: input.posSessionId,
  });

  if (input.branchId && session.branch_id !== input.branchId) {
    throw new PosSessionError(
      'POS_SESSION_BRANCH_CONFLICT',
      'POS session branch does not match the current finance write branch.',
      409
    );
  }

  return session;
}

/**
 * B1 — the server decides which POS session a finance write belongs to.
 *
 * The session is the actor's own OPEN session (locked for the transaction). A client-sent
 * `posSessionId` is only a cross-check: when it names a different session the write is refused
 * (`POS_SESSION_MISMATCH`) rather than trusted. With no session, the write is refused with
 * `POS_SESSION_REQUIRED` (carrying what the UI can offer) when the surface's resolved policy
 * (`pos_session_mode_*`, per finance screen) requires one for this tender; otherwise it proceeds
 * unlinked (`null`). Cash custody is a separate invariant enforced by the drawer ledger gate.
 *
 * @param tx - The finance write's own transaction.
 * @param input - Tenant, session owner, branch, optional client hint and tender scope.
 * @returns The locked open session, or null when none exists and none is required.
 * @throws PosSessionError POS_SESSION_MISMATCH / POS_SESSION_REQUIRED / POS_SESSION_BRANCH_CONFLICT /
 *   POS_SESSION_OPEN_NOT_FOUND.
 *
 * @example
 * const session = await resolvePosSessionForFinanceTx(tx, { tenantId, userId, branchId, posSessionId, surface: 'ORDER_ENTRY', tenderScope: 'CASH' });
 */
export async function resolvePosSessionForFinanceTx(
  tx: PrismaTx,
  input: ResolvePosSessionForFinanceInput
): Promise<PosSessionRow | null> {
  const active = input.userId ? await getActiveSessionForUserForUpdate(tx, input.tenantId, input.userId) : null;

  if (input.posSessionId) {
    if (active && active.id !== input.posSessionId) {
      throw new PosSessionError(
        'POS_SESSION_MISMATCH',
        "The POS session sent with this request is not the current user's active session.",
        409,
        { requestedSessionId: input.posSessionId, activeSessionId: active.id }
      );
    }
    return assertOpenPosSessionForFinanceTx(tx, input);
  }

  if (active && active.status === POS_SESSION_STATUS.OPEN) {
    if (input.branchId && active.branch_id !== input.branchId) {
      throw new PosSessionError(
        'POS_SESSION_BRANCH_CONFLICT',
        'POS session branch does not match the current finance write branch.',
        409
      );
    }
    return active;
  }

  if (input.tenderScope === 'NONE') return null;
  const settings = await getCashControlSettings({
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    userId: input.userId || null,
  });
  const mode = settings[POS_SESSION_SURFACE_SETTING_FIELD[input.surface]];
  if (!isPosSessionRequired(mode, input.tenderScope)) return null;

  // The branch the UI should open the session in: the write's own branch, else the user's home
  // branch (screens such as customer receipts carry no branch of their own).
  const homeBranch = input.branchId
    ? null
    : await tx.org_users_mst.findFirst({
        where: { tenant_org_id: input.tenantId, user_id: input.userId, is_active: true },
        select: { main_branch_id: true },
      });

  throw new PosSessionError(
    'POS_SESSION_REQUIRED',
    'An open POS session is required to take this payment.',
    409,
    {
      surface: input.surface,
      branchId: input.branchId ?? homeBranch?.main_branch_id ?? null,
      reason: active ? 'PAUSED' : 'NONE',
      pausedSessionId: active?.id ?? null,
      canOpenInline: true,
    }
  );
}

/**
 * Links a selected open drawer session within the caller's existing transaction.
 *
 * @param tx - Existing tenant-scoped transaction shared with the drawer flow.
 * @param input - Tenant, actor, POS session, and drawer-session context.
 * @returns Lifecycle result, or null when no POS/drawer link is required.
 * @throws PosSessionError when the selected drawer is unavailable or incompatible.
 *
 * @example
 * await autoLinkDrawerTx(tx, { tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid', cashDrawerSessionId: 'drawer-session-uuid' });
 */
export async function autoLinkDrawerTx(
  tx: PrismaTx,
  input: AutoLinkDrawerInput
): Promise<PosSessionLifecycleResult | null> {
  if (!input.posSessionId || !input.cashDrawerSessionId) return null;

  const idempotencyKey = input.idempotencyKey
    ? `${input.idempotencyKey}:drawer:${input.cashDrawerSessionId}`
    : null;

  const cached = await readIdempotencyResult<PosSessionLifecycleResult>(
    tx,
    input.tenantId,
    idempotencyKey,
    POS_SESSION_IDEMPOTENCY_RESOURCE.AUTO_LINK_DRAWER
  );
  if (cached) return cached;

  const session = await assertOpenPosSessionForFinanceTx(tx, input);
  if (!session) return null;

  const drawerRows = await tx.$queryRaw<Array<{
    id: string;
    cash_drawer_id: string;
    branch_id: string | null;
  }>>(Prisma.sql`
    SELECT id, cash_drawer_id, branch_id
    FROM public.org_cash_drawer_sessions_mst
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${input.cashDrawerSessionId}::uuid
      AND status = 'OPEN'
      AND is_active = TRUE
    LIMIT 1
  `);

  const drawerSession = drawerRows[0];
  if (!drawerSession) {
    throw new PosSessionError(
      'POS_SESSION_DRAWER_NOT_OPEN',
      'Cash drawer session was not found or is not open.',
      409
    );
  }

  if (input.branchId && drawerSession.branch_id && drawerSession.branch_id !== input.branchId) {
    throw new PosSessionError(
      'POS_SESSION_DRAWER_BRANCH_CONFLICT',
      'Cash drawer session branch does not match the current finance write branch.',
      409
    );
  }

  if (session.cash_drawer_session_id) {
    if (session.cash_drawer_session_id === input.cashDrawerSessionId) {
      const result: PosSessionLifecycleResult = { type: 'NOOP', session };
      await storeIdempotencyResult(tx, {
        tenantId: input.tenantId,
        key: idempotencyKey,
        resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.AUTO_LINK_DRAWER,
        resourceId: session.id,
        result,
      });
      return result;
    }

    // A different drawer session is currently linked. Relinking is only safe
    // once that prior link is terminal (CLOSED/FORCE_CLOSED) — a POS session
    // whose drawer is still OPEN/CLOSING genuinely has cash in play under the
    // old link, and swapping it silently would orphan that custody trail.
    const priorRows = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status
      FROM public.org_cash_drawer_sessions_mst
      WHERE tenant_org_id = ${input.tenantId}::uuid
        AND id = ${session.cash_drawer_session_id}::uuid
      LIMIT 1
    `);
    const priorStatus = priorRows?.[0]?.status;
    const priorIsTerminal =
      !!priorStatus && (CASH_DRAWER_TERMINAL_SESSION_STATUSES as readonly string[]).includes(priorStatus);

    if (!priorIsTerminal) {
      throw new PosSessionError(
        'POS_SESSION_DRAWER_ALREADY_LINKED',
        'POS session is already linked to a different cash drawer session.',
        409
      );
    }
    // Fall through: prior drawer session is terminal, so the UPDATE below
    // replaces the stale link with the newly chosen/opened drawer session.
  }

  // E2-2: under shared_session_mode = EXCLUSIVE a drawer session belongs to one POS session at a time, so
  // every cash line in it has exactly one cashier. Another live POS session on it blocks this link.
  const sharing = await getCashControlSettings({
    tenantId: input.tenantId,
    branchId: drawerSession.branch_id ?? session.branch_id,
    userId: session.user_id,
    drawerId: drawerSession.cash_drawer_id,
  });
  if (sharing.sharedSessionMode === CASH_CONTROL_SHARED_SESSION_MODE.EXCLUSIVE) {
    const others = await tx.$queryRaw<Array<{ id: string; session_no: string }>>(Prisma.sql`
      SELECT id, session_no
      FROM public.org_pos_sessions_mst
      WHERE tenant_org_id = ${input.tenantId}::uuid
        AND cash_drawer_session_id = ${input.cashDrawerSessionId}::uuid
        AND id <> ${session.id}::uuid
        AND status IN (${Prisma.join([...ACTIVE_STATUSES])})
        AND is_active = TRUE
      LIMIT 1
    `);
    if (others[0]) {
      throw new PosSessionError(
        POS_SESSION_SHARING_ERROR.DRAWER_SESSION_EXCLUSIVE,
        'This cash drawer session is already in use by another POS session and sharing is turned off.',
        409,
        { otherPosSessionId: others[0].id, otherSessionNo: others[0].session_no }
      );
    }
  }

  const priorCashDrawerSessionId = session.cash_drawer_session_id ?? null;

  const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
    UPDATE public.org_pos_sessions_mst
    SET cash_drawer_session_id = ${input.cashDrawerSessionId}::uuid,
        cash_drawer_id = ${drawerSession.cash_drawer_id}::uuid,
        updated_at = NOW(),
        updated_by = ${input.userId}
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${session.id}::uuid
    RETURNING *
  `);
  const updated = normalizeSession(rows[0]);

  await recordEventTx(tx, {
    tenantId: input.tenantId,
    sessionId: updated.id,
    eventType: POS_SESSION_EVENT_TYPE.AUTO_LINK_DRAWER,
    previousStatus: POS_SESSION_STATUS.OPEN,
    newStatus: POS_SESSION_STATUS.OPEN,
    performedBy: input.userId,
    idempotencyKey,
    sourceChannel: input.sourceChannel,
    metadata: {
      ...(input.metadata ?? {}),
      cashDrawerSessionId: input.cashDrawerSessionId,
      cashDrawerId: drawerSession.cash_drawer_id,
      ...(priorCashDrawerSessionId ? { replacedCashDrawerSessionId: priorCashDrawerSessionId } : {}),
    },
  });

  const result: PosSessionLifecycleResult = { type: 'UPDATED', session: updated };
  await storeIdempotencyResult(tx, {
    tenantId: input.tenantId,
    key: idempotencyKey,
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.AUTO_LINK_DRAWER,
    resourceId: updated.id,
    result,
  });
  return result;
}

/**
 * Links an existing OPEN cash drawer session to an OPEN POS session.
 *
 * Why:
 * Cash drawer ownership stays in the cash-drawer domain; this wrapper only
 * records POS operational lineage after the drawer API has chosen/opened a
 * drawer session.
 *
 * @param input Tenant/user/session context plus the cash drawer session to attach.
 * @returns Updated POS session lifecycle result, or null when required IDs are missing.
 *
 * @example
 * await autoLinkDrawer({
 *   tenantId: 'tenant-uuid',
 *   userId: 'user-uuid',
 *   posSessionId: 'pos-session-uuid',
 *   branchId: 'branch-uuid',
 *   cashDrawerSessionId: 'drawer-session-uuid',
 * });
 */
export async function autoLinkDrawer(input: AutoLinkDrawerInput): Promise<PosSessionLifecycleResult | null> {
  return withTenantContext(input.tenantId, () =>
    prisma.$transaction((tx) => autoLinkDrawerTx(tx, input))
  );
}

/**
 * Attaches an authorized open POS session to an order payment in the same transaction.
 *
 * @param tx - Existing tenant-scoped financial transaction.
 * @param input - Tenant, actor, POS session, and order-payment ID.
 * @returns Resolves when the payment lineage is recorded.
 * @throws PosSessionError when the POS session cannot authorize the write.
 *
 * @example
 * await setOrderPaymentPosSessionTx(tx, { tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid', orderPaymentId: 'payment-uuid' });
 */
export async function setOrderPaymentPosSessionTx(
  tx: PrismaTx,
  input: PosSessionFinanceContextInput & { orderPaymentId: string }
): Promise<void> {
  if (!input.posSessionId) return;
  await assertOpenPosSessionForFinanceTx(tx, input);
  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_order_payments_dtl
    SET pos_session_id = ${input.posSessionId}::uuid,
        updated_at = NOW(),
        updated_by = ${input.userId}
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${input.orderPaymentId}::uuid
  `);
}

/**
 * Attaches an authorized open POS session to a voucher line in the same transaction.
 *
 * @param tx - Existing tenant-scoped financial transaction.
 * @param input - Tenant, actor, POS session, and voucher-line ID.
 * @returns Resolves when the voucher lineage is recorded.
 * @throws PosSessionError when the POS session cannot authorize the write.
 *
 * @example
 * await setVoucherLinePosSessionTx(tx, { tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid', voucherLineId: 'line-uuid' });
 */
export async function setVoucherLinePosSessionTx(
  tx: PrismaTx,
  input: PosSessionFinanceContextInput & { voucherLineId: string }
): Promise<void> {
  if (!input.posSessionId) return;
  await assertOpenPosSessionForFinanceTx(tx, input);
  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_fin_voucher_trx_lines_dtl
    SET pos_session_id = ${input.posSessionId}::uuid,
        updated_at = NOW(),
        updated_by = ${input.userId}
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${input.voucherLineId}::uuid
  `);
}

/**
 * Attaches an authorized open POS session to a refund in the same transaction.
 *
 * @param tx - Existing tenant-scoped financial transaction.
 * @param input - Tenant, actor, POS session, and refund ID.
 * @returns Resolves when the refund lineage is recorded.
 * @throws PosSessionError when the POS session cannot authorize the write.
 *
 * @example
 * await setRefundPosSessionTx(tx, { tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid', refundId: 'refund-uuid' });
 */
export async function setRefundPosSessionTx(
  tx: PrismaTx,
  input: PosSessionFinanceContextInput & { refundId: string }
): Promise<void> {
  if (!input.posSessionId) return;
  await assertOpenPosSessionForFinanceTx(tx, input);
  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_order_refunds_dtl
    SET pos_session_id = ${input.posSessionId}::uuid,
        updated_at = NOW(),
        updated_by = ${input.userId}
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND id = ${input.refundId}::uuid
  `);
}

/**
 * Builds exact, currency-separated financial totals for one authorized POS session.
 * All Prisma queries are scoped to the tenant through withTenantContext.
 *
 * @param input - Tenant, actor, session, and all-session visibility context.
 * @returns Payment, refund, and voucher-line totals without float conversion.
 * @throws PosSessionError when the session is unavailable to the caller.
 *
 * @example
 * const summary = await getPosSessionSummary({ tenantId: 'tenant-uuid', userId: 'user-uuid', posSessionId: 'session-uuid' });
 */
export async function getPosSessionSummary(input: {
  tenantId: string;
  userId: string;
  posSessionId: string;
  canViewAll?: boolean;
}): Promise<PosSessionSummary> {
  return withTenantContext(input.tenantId, async () => {
    const userScopeSql = input.canViewAll
      ? Prisma.empty
      : Prisma.sql`AND user_id = ${input.userId}::uuid`;
    const sessionRows = await prisma.$queryRaw<PosSessionRow[]>(Prisma.sql`
      SELECT *
      FROM public.org_pos_sessions_mst
      WHERE tenant_org_id = ${input.tenantId}::uuid
        AND id = ${input.posSessionId}::uuid
        AND is_active = TRUE
        ${userScopeSql}
      LIMIT 1
    `);
    const session = sessionRows[0] ? normalizeSession(sessionRows[0]) : null;
    if (!session) {
      throw new PosSessionError('POS_SESSION_NOT_FOUND', 'POS session was not found.', 404);
    }

    const [rollup, drawerCash, ordersCreated] = await Promise.all([
      loadPosSessionRollup(prisma, input.tenantId, input.posSessionId),
      loadPosSessionDrawerCash(prisma, input.tenantId, session),
      loadPosSessionOrdersCreated(prisma, input.tenantId, input.posSessionId),
    ]);
    return { session, drawerCash, ordersCreated, ...rollup };
  });
}

/**
 * Opening and final drawer cash for the session linked to this POS session.
 * Final is the counted close when one exists; otherwise opening plus the live ledger window.
 */
async function loadPosSessionDrawerCash(
  db: Pick<typeof prisma, '$queryRaw'>,
  tenantId: string,
  session: PosSessionRow,
): Promise<PosSessionDrawerCashStatement | null> {
  if (!session.cash_drawer_id || !session.cash_drawer_session_id) return null;

  const rows = await db.$queryRaw<Array<{
    currency_code: string | null;
    open_ledger_seq: bigint | number | string | null;
    close_ledger_seq: bigint | number | string | null;
    opening_balance: string | null;
    closing_counted: string | null;
  }>>(Prisma.sql`
    SELECT
      cd.currency_code,
      cds.open_ledger_seq,
      cds.close_ledger_seq,
      COALESCE(cdb.opening_counted, cds.opening_float_amount)::text AS opening_balance,
      cdb.closing_counted::text AS closing_counted
    FROM public.org_cash_drawer_sessions_mst cds
    JOIN public.org_cash_drawers_mst cd
      ON cd.tenant_org_id = cds.tenant_org_id
     AND cd.id = cds.cash_drawer_id
    LEFT JOIN public.org_cash_drawer_ses_bal_dtl cdb
      ON cdb.tenant_org_id = cds.tenant_org_id
     AND cdb.cash_drawer_session_id = cds.id
     AND cdb.currency_code = cd.currency_code
     AND cdb.is_active = TRUE
    WHERE cds.tenant_org_id = ${tenantId}::uuid
      AND cds.id = ${session.cash_drawer_session_id}::uuid
      AND cds.cash_drawer_id = ${session.cash_drawer_id}::uuid
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;

  const openingBalance = row.opening_balance == null ? null : toMoneyString(row.opening_balance);
  if (row.closing_counted != null) {
    return {
      currencyCode: row.currency_code,
      openingBalance,
      finalBalance: toMoneyString(row.closing_counted),
    };
  }
  if (row.open_ledger_seq == null) {
    return { currencyCode: row.currency_code, openingBalance, finalBalance: openingBalance };
  }

  const windows = await sumLedgerWindow(
    db as Prisma.TransactionClient,
    tenantId,
    session.cash_drawer_id,
    BigInt(row.open_ledger_seq),
    row.close_ledger_seq == null ? null : BigInt(row.close_ledger_seq),
  );
  const match = row.currency_code
    ? windows.find((window) => window.currencyCode === row.currency_code)
    : undefined;
  const totalIn = (match?.finIn ?? new Decimal(0)).plus(match?.trxIn ?? 0);
  const totalOut = (match?.finOut ?? new Decimal(0)).plus(match?.trxOut ?? 0);
  const finalBalance = new Decimal(openingBalance ?? 0).plus(totalIn).minus(totalOut);

  return {
    currencyCode: row.currency_code,
    openingBalance,
    finalBalance: toMoneyString(finalBalance.toString()),
  };
}

/**
 * Lists tenant users for the "open session on behalf of" picker. Intentionally
 * independent of POS session history (unlike `listPosSessionFilterOptions`'s
 * `operator` dimension) so a cashier who has never opened a session yet can
 * still be selected.
 *
 * @param input - Tenant, optional search query, and paging.
 * @returns A page of tenant users matching the query.
 *
 * @example
 * await listTenantUsersForPosSessionOpen({ tenantId: 'tenant-uuid', query: 'ali', page: 1, pageSize: 25 });
 */
export async function listTenantUsersForPosSessionOpen(input: {
  tenantId: string;
  query?: string | null;
  page: number;
  pageSize: number;
}): Promise<{ items: Array<{ id: string; label: string; secondaryLabel: string | null }>; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const searchSql = input.query
    ? Prisma.sql`AND (
        u.display_name ILIKE ${`%${input.query}%`}
        OR u.name ILIKE ${`%${input.query}%`}
        OR u.email ILIKE ${`%${input.query}%`}
      )`
    : Prisma.empty;

  return withTenantContext(input.tenantId, async () => {
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM public.org_users_mst u
        WHERE u.tenant_org_id = ${input.tenantId}::uuid
          AND COALESCE(u.is_active, TRUE) = TRUE
          ${searchSql}
      `),
      prisma.$queryRaw<Array<{ id: string; label: string; secondary_label: string | null }>>(Prisma.sql`
        SELECT
          u.user_id::text AS id,
          COALESCE(u.display_name, u.name, u.email) AS label,
          u.email AS secondary_label
        FROM public.org_users_mst u
        WHERE u.tenant_org_id = ${input.tenantId}::uuid
          AND COALESCE(u.is_active, TRUE) = TRUE
          ${searchSql}
        ORDER BY label ASC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, label: row.label, secondaryLabel: row.secondary_label })),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize,
    };
  });
}

async function createOpenSessionTx(
  tx: PrismaTx,
  input: OpenPosSessionInput,
  eventType: PosSessionEventType
): Promise<{ type: 'CREATED'; session: PosSessionRow }> {
  await assertBranchExists(tx, input.tenantId, input.branchId);
  await assertTerminalIsUsable(tx, input.tenantId, input.branchId, input.terminalId);

  const performedBy = input.performedBy ?? input.userId;
  if (performedBy !== input.userId) {
    await assertUserExists(tx, input.tenantId, input.userId);
  }

  const businessTimezone = await resolveBranchBusinessTimezone(tx, input.tenantId, input.branchId);
  const businessDate = businessDateForTimezone(businessTimezone);
  const sessionNo = sessionNoForDate(businessDate);

  const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
    INSERT INTO public.org_pos_sessions_mst (
      tenant_org_id, branch_id, user_id, terminal_id,
      session_no, business_date, business_timezone, status,
      opened_by, created_by, metadata
    )
    VALUES (
      ${input.tenantId}::uuid, ${input.branchId}::uuid, ${input.userId}::uuid, ${input.terminalId ?? null}::uuid,
      ${sessionNo}, ${businessDate}::date, ${businessTimezone}, ${POS_SESSION_STATUS.OPEN},
      ${performedBy}::uuid, ${performedBy}, ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `);

  const session = normalizeSession(rows[0]);
  await recordEventTx(tx, {
    tenantId: input.tenantId,
    sessionId: session.id,
    eventType,
    previousStatus: null,
    newStatus: POS_SESSION_STATUS.OPEN,
    performedBy,
    idempotencyKey: input.idempotencyKey,
    sourceChannel: input.sourceChannel,
    metadata:
      performedBy !== input.userId
        ? { ...(input.metadata ?? {}), openedOnBehalfOfUserId: input.userId }
        : input.metadata,
  });

  return { type: 'CREATED', session };
}

async function openPosSessionInternal(
  input: OpenPosSessionInput,
  resourceType: string,
  eventType: PosSessionEventType
): Promise<OpenPosSessionResult> {
  return withTenantContext(input.tenantId, () =>
    prisma.$transaction(async (tx) => {
      await lockUserSessionScope(tx, input.tenantId, input.userId);

      const cached = await readIdempotencyResult<OpenPosSessionResult>(
        tx,
        input.tenantId,
        input.idempotencyKey,
        resourceType
      );
      if (cached) return cached;

      const active = await getActiveSessionForUserForUpdate(tx, input.tenantId, input.userId);
      if (active) {
        const result: OpenPosSessionResult =
          active.branch_id === input.branchId
            ? { type: 'CURRENT', session: active }
            : {
                type: 'BRANCH_CONFLICT',
                requestedBranchId: input.branchId,
                activeBranchId: active.branch_id,
                activeSession: active,
              };

        await storeIdempotencyResult(tx, {
          tenantId: input.tenantId,
          key: input.idempotencyKey,
          resourceType,
          resourceId: active.id,
          result,
        });
        return result;
      }

      const result = await createOpenSessionTx(tx, input, eventType);
      await storeIdempotencyResult(tx, {
        tenantId: input.tenantId,
        key: input.idempotencyKey,
        resourceType,
        resourceId: result.session.id,
        result,
      });
      return result;
    })
  );
}

/**
 * Resolves the caller's active session, optionally enriched for the POS workspace.
 * All Prisma queries are scoped to the tenant through withTenantContext.
 *
 * @param input - Authenticated tenant, user, optional branch, and context flags.
 * @returns Active session, no-session result, or branch-conflict result.
 *
 * @example
 * const active = await getMyActivePosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid', includeContext: true });
 */
export async function getMyActivePosSession(input: {
  tenantId: string;
  userId: string;
  branchId?: string | null;
  includeContext?: boolean;
  includeDrawerContext?: boolean;
}): Promise<GetMyActivePosSessionResult> {
  const active = await withTenantContext(input.tenantId, () =>
    input.includeContext
      ? getActiveSessionForUserWithContext(
          prisma,
          input.tenantId,
          input.userId,
          input.includeDrawerContext === true
        )
      : getActiveSessionForUser(prisma, input.tenantId, input.userId)
  );
  if (!active) return { type: 'NONE' };
  if (input.branchId && active.branch_id !== input.branchId) {
    return {
      type: 'BRANCH_CONFLICT',
      requestedBranchId: input.branchId,
      activeBranchId: active.branch_id,
      activeSession: active,
    };
  }
  return { type: 'ACTIVE', session: active };
}

/**
 * Lists POS sessions using bounded filters and permission-derived own/all scope.
 * All Prisma queries are scoped to the tenant through withTenantContext.
 *
 * @param input - Tenant, actor, visibility permission, paging, and filter context.
 * @returns Server-paged operational rows with tenant-scoped display names.
 *
 * @example
 * const page = await listPosSessions({ tenantId: 'tenant-uuid', userId: 'user-uuid', canViewAll: false, page: 1, pageSize: 20, scope: 'own' });
 */
export async function listPosSessions(input: {
  tenantId: string;
  userId: string;
  canViewAll: boolean;
  page: number;
  pageSize: number;
  branchId?: string | null;
  /**
   * B3 branch scope: when set, other users' sessions are limited to these branches (the actor's own
   * sessions stay visible). `undefined` = every branch; an empty list = own sessions only.
   */
  branchIds?: readonly string[];
  /**
   * Optional "sessions of this operator" filter. Distinct from `userId` (the
   * acting user, which drives the own-scope restriction) — the two used to
   * share one name, so the filter silently replaced the actor id.
   */
  filterUserId?: string | null;
  operatorQuery?: string | null;
  terminalQuery?: string | null;
  cashDrawerQuery?: string | null;
  terminalId?: string | null;
  cashDrawerId?: string | null;
  cashDrawerSessionId?: string | null;
  sessionNo?: string | null;
  businessDateFrom?: Date | null;
  businessDateTo?: Date | null;
  openedAtFrom?: Date | null;
  openedAtTo?: Date | null;
  status?: PosSessionStatus | null;
  scope?: 'own' | 'all';
  recordState?: PosSessionRecordState;
}): Promise<PosSessionListResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const showAll = input.canViewAll && input.scope === 'all';
  // Inactive is a soft-record state, not a lifecycle status. Defaulting here
  // protects direct service callers that do not pass the API schema default.
  const recordStateSql = input.recordState === 'all'
    ? Prisma.empty
    : Prisma.sql`AND ps.is_active = TRUE`;

  const userScopeSql = showAll
    ? Prisma.empty
    : Prisma.sql`AND ps.user_id = ${input.userId}::uuid`;
  const branchSql = input.branchId
    ? Prisma.sql`AND ps.branch_id = ${input.branchId}::uuid`
    : Prisma.empty;
  const branchScopeSql = input.branchIds
    ? Prisma.sql`AND (ps.user_id = ${input.userId}::uuid OR ps.branch_id = ANY(${[...input.branchIds]}::uuid[]))`
    : Prisma.empty;
  const userSql = input.filterUserId
    ? Prisma.sql`AND ps.user_id = ${input.filterUserId}::uuid`
    : Prisma.empty;
  const operatorQuerySql = input.operatorQuery
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM public.org_users_mst operator_user
        WHERE operator_user.tenant_org_id = ps.tenant_org_id
          AND operator_user.user_id = ps.user_id
          AND (
            operator_user.display_name ILIKE ${`%${input.operatorQuery}%`}
            OR operator_user.name ILIKE ${`%${input.operatorQuery}%`}
            OR operator_user.email ILIKE ${`%${input.operatorQuery}%`}
          )
      )`
    : Prisma.empty;
  const terminalQuerySql = input.terminalQuery
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM public.org_payment_terminals_cf filter_terminal
        WHERE filter_terminal.tenant_org_id = ps.tenant_org_id
          AND filter_terminal.id = ps.terminal_id
          AND (
            filter_terminal.terminal_name ILIKE ${`%${input.terminalQuery}%`}
            OR filter_terminal.terminal_code ILIKE ${`%${input.terminalQuery}%`}
          )
      )`
    : Prisma.empty;
  const cashDrawerQuerySql = input.cashDrawerQuery
    ? Prisma.sql`AND (
        EXISTS (
          SELECT 1
          FROM public.org_cash_drawers_mst filter_drawer
          WHERE filter_drawer.tenant_org_id = ps.tenant_org_id
            AND filter_drawer.id = ps.cash_drawer_id
            AND filter_drawer.drawer_name ILIKE ${`%${input.cashDrawerQuery}%`}
        )
        OR EXISTS (
          SELECT 1
          FROM public.org_cash_drawer_sessions_mst filter_drawer_session
          WHERE filter_drawer_session.tenant_org_id = ps.tenant_org_id
            AND filter_drawer_session.id = ps.cash_drawer_session_id
            AND filter_drawer_session.session_no ILIKE ${`%${input.cashDrawerQuery}%`}
        )
      )`
    : Prisma.empty;
  const terminalSql = input.terminalId ? Prisma.sql`AND ps.terminal_id = ${input.terminalId}::uuid` : Prisma.empty;
  const cashDrawerSql = input.cashDrawerId ? Prisma.sql`AND ps.cash_drawer_id = ${input.cashDrawerId}::uuid` : Prisma.empty;
  const cashDrawerSessionSql = input.cashDrawerSessionId ? Prisma.sql`AND ps.cash_drawer_session_id = ${input.cashDrawerSessionId}::uuid` : Prisma.empty;
  const sessionNoSql = input.sessionNo ? Prisma.sql`AND ps.session_no ILIKE ${`%${input.sessionNo}%`}` : Prisma.empty;
  const businessDateFromSql = input.businessDateFrom ? Prisma.sql`AND ps.business_date >= ${input.businessDateFrom.toISOString().slice(0, 10)}::date` : Prisma.empty;
  const businessDateToSql = input.businessDateTo ? Prisma.sql`AND ps.business_date <= ${input.businessDateTo.toISOString().slice(0, 10)}::date` : Prisma.empty;
  const openedAtFromSql = input.openedAtFrom ? Prisma.sql`AND ps.opened_at >= ${input.openedAtFrom}` : Prisma.empty;
  const openedAtToSql = input.openedAtTo ? Prisma.sql`AND ps.opened_at <= ${input.openedAtTo}` : Prisma.empty;
  const statusSql = input.status
    ? Prisma.sql`AND ps.status = ${input.status}`
    : Prisma.empty;

  return withTenantContext(input.tenantId, async () => {
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM public.org_pos_sessions_mst ps
        WHERE ps.tenant_org_id = ${input.tenantId}::uuid
          ${recordStateSql}
          ${userScopeSql}
          ${branchSql}
          ${branchScopeSql}
          ${userSql}
          ${operatorQuerySql}
          ${terminalQuerySql}
          ${cashDrawerQuerySql}
          ${terminalSql}
          ${cashDrawerSql}
          ${cashDrawerSessionSql}
          ${sessionNoSql}
          ${businessDateFromSql}
          ${businessDateToSql}
          ${openedAtFromSql}
          ${openedAtToSql}
          ${statusSql}
      `),
      prisma.$queryRaw<PosSessionListRow[]>(Prisma.sql`
        SELECT
          ps.*,
          COALESCE(b.name, b.branch_name) AS branch_name,
          b.name2 AS branch_name2,
          pt.terminal_name,
          pt.terminal_code,
          cd.drawer_name AS cash_drawer_name,
          cds.session_no AS cash_drawer_session_no,
          cds.status AS cash_drawer_session_status,
          COALESCE(cdb.opening_counted, cds.opening_float_amount) AS cash_drawer_opening_balance,
          cd.currency_code AS cash_drawer_currency_code,
          (
            SELECT COUNT(*)::int
            FROM public.org_orders_mst o
            WHERE o.tenant_org_id = ps.tenant_org_id
              AND o.created_pos_session_id = ps.id
              AND COALESCE(o.rec_status, 1) <> 0
          ) AS orders_created_count
          , COALESCE(u.display_name, u.name, u.email) AS user_display_name
          , COALESCE(opened_by_user.display_name, opened_by_user.name, opened_by_user.email) AS opened_by_display_name
          , COALESCE(paused_by_user.display_name, paused_by_user.name, paused_by_user.email) AS paused_by_display_name
          , COALESCE(closed_by_user.display_name, closed_by_user.name, closed_by_user.email) AS closed_by_display_name
          , COALESCE(force_closed_by_user.display_name, force_closed_by_user.name, force_closed_by_user.email) AS force_closed_by_display_name
          , COALESCE(created_by_user.display_name, created_by_user.name, created_by_user.email) AS created_by_display_name
          , COALESCE(updated_by_user.display_name, updated_by_user.name, updated_by_user.email) AS updated_by_display_name
        FROM public.org_pos_sessions_mst ps
        LEFT JOIN public.org_branches_mst b
          ON b.tenant_org_id = ps.tenant_org_id
         AND b.id = ps.branch_id
        LEFT JOIN public.org_payment_terminals_cf pt
          ON pt.tenant_org_id = ps.tenant_org_id
         AND pt.id = ps.terminal_id
        LEFT JOIN public.org_cash_drawers_mst cd
          ON cd.tenant_org_id = ps.tenant_org_id
         AND cd.id = ps.cash_drawer_id
        LEFT JOIN public.org_cash_drawer_sessions_mst cds
          ON cds.tenant_org_id = ps.tenant_org_id
         AND cds.id = ps.cash_drawer_session_id
        LEFT JOIN public.org_cash_drawer_ses_bal_dtl cdb
          ON cdb.tenant_org_id = cds.tenant_org_id
         AND cdb.cash_drawer_session_id = cds.id
         AND cdb.currency_code = cd.currency_code
         AND cdb.is_active = TRUE
        LEFT JOIN public.org_users_mst u ON u.tenant_org_id = ps.tenant_org_id AND u.user_id = ps.user_id
        LEFT JOIN public.org_users_mst opened_by_user ON opened_by_user.tenant_org_id = ps.tenant_org_id AND opened_by_user.user_id = ps.opened_by
        LEFT JOIN public.org_users_mst paused_by_user ON paused_by_user.tenant_org_id = ps.tenant_org_id AND paused_by_user.user_id = ps.paused_by
        LEFT JOIN public.org_users_mst closed_by_user ON closed_by_user.tenant_org_id = ps.tenant_org_id AND closed_by_user.user_id = ps.closed_by
        LEFT JOIN public.org_users_mst force_closed_by_user ON force_closed_by_user.tenant_org_id = ps.tenant_org_id AND force_closed_by_user.user_id = ps.force_closed_by
        LEFT JOIN public.org_users_mst created_by_user ON created_by_user.tenant_org_id = ps.tenant_org_id AND created_by_user.user_id::text = ps.created_by
        LEFT JOIN public.org_users_mst updated_by_user ON updated_by_user.tenant_org_id = ps.tenant_org_id AND updated_by_user.user_id::text = ps.updated_by
        WHERE ps.tenant_org_id = ${input.tenantId}::uuid
          ${recordStateSql}
          ${userScopeSql}
          ${branchSql}
          ${branchScopeSql}
          ${userSql}
          ${operatorQuerySql}
          ${terminalQuerySql}
          ${cashDrawerQuerySql}
          ${terminalSql}
          ${cashDrawerSql}
          ${cashDrawerSessionSql}
          ${sessionNoSql}
          ${businessDateFromSql}
          ${businessDateToSql}
          ${openedAtFromSql}
          ${openedAtToSql}
          ${statusSql}
        ORDER BY ps.opened_at DESC, ps.created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);

    return {
      items: rows.map(normalizeSessionListRow),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize,
    };
  });
}

interface PosSessionFilterOptionQueryRow extends Omit<PosSessionFilterOption, 'secondaryLabel'> {
  secondary_label: string | null;
  total: number;
}

/**
 * Lists one visible POS-session dimension for a reusable list-of-values picker.
 *
 * The option set deliberately comes from POS session history instead of each
 * master catalogue. That prevents the picker from offering a value which the
 * caller cannot use to find an authorized session in the current own/all scope.
 *
 * @param input Tenant-scoped, authorization-aware lookup criteria.
 * @returns A page of values represented by sessions visible to the caller.
 * @example
 * await listPosSessionFilterOptions({
 *   tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 *   userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 *   canViewAll: false,
 *   type: 'operator',
 *   page: 1,
 *   pageSize: 25,
 *   recordState: 'active',
 * });
 */
export async function listPosSessionFilterOptions(input: {
  tenantId: string;
  userId: string;
  canViewAll: boolean;
  type: PosSessionFilterOptionType;
  query?: string | null;
  page: number;
  pageSize: number;
  /** B3 branch scope for other users' sessions (undefined = every branch). */
  branchIds?: readonly string[];
  scope?: 'own' | 'all';
  recordState?: PosSessionRecordState;
}): Promise<PosSessionFilterOptionsResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const showAll = input.canViewAll && input.scope === 'all';
  const userScopeSql = showAll
    ? Prisma.empty
    : Prisma.sql`AND ps.user_id = ${input.userId}::uuid`;
  const branchScopeSql = input.branchIds
    ? Prisma.sql`AND (ps.user_id = ${input.userId}::uuid OR ps.branch_id = ANY(${[...input.branchIds]}::uuid[]))`
    : Prisma.empty;
  // Keep deactivated records out of lookup values by default, while allowing
  // an explicit audit view to use the same dimension and visibility boundary.
  const recordStateSql = input.recordState === 'all'
    ? Prisma.empty
    : Prisma.sql`AND ps.is_active = TRUE`;
  const searchSql = input.query
    ? Prisma.sql`WHERE (
        options.label ILIKE ${`%${input.query}%`}
        OR COALESCE(options.label2, '') ILIKE ${`%${input.query}%`}
        OR COALESCE(options.secondary_label, '') ILIKE ${`%${input.query}%`}
      )`
    : Prisma.empty;

  // Keep the primary visibility predicate in the CTE so every option source
  // inherits the same tenant and own/all authorization boundary.
  const visibleSessionsSql = Prisma.sql`
    WITH visible_sessions AS (
      SELECT
        ps.branch_id,
        ps.user_id,
        ps.terminal_id,
        ps.cash_drawer_id,
        ps.cash_drawer_session_id
      FROM public.org_pos_sessions_mst ps
      WHERE ps.tenant_org_id = ${input.tenantId}::uuid
        ${recordStateSql}
        ${userScopeSql}
        ${branchScopeSql}
    )`;

  let rows!: PosSessionFilterOptionQueryRow[];
  await withTenantContext(input.tenantId, async () => {
    switch (input.type) {
      case 'branch':
        rows = await prisma.$queryRaw<PosSessionFilterOptionQueryRow[]>(Prisma.sql`
          ${visibleSessionsSql},
          options AS (
            SELECT DISTINCT
              branch.id::text AS id,
              COALESCE(branch.name, branch.branch_name, branch.id::text) AS label,
              branch.name2 AS label2,
              NULL::text AS secondary_label
            FROM visible_sessions ps
            INNER JOIN public.org_branches_mst branch
              ON branch.tenant_org_id = ${input.tenantId}::uuid
             AND branch.id = ps.branch_id
          )
          SELECT options.*, COUNT(*) OVER()::int AS total
          FROM options
          ${searchSql}
          ORDER BY options.label ASC, options.id ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        break;
      case 'operator':
        rows = await prisma.$queryRaw<PosSessionFilterOptionQueryRow[]>(Prisma.sql`
          ${visibleSessionsSql},
          options AS (
            SELECT DISTINCT
              operator_user.user_id::text AS id,
              COALESCE(
                operator_user.display_name,
                operator_user.name,
                operator_user.email,
                operator_user.user_id::text
              ) AS label,
              operator_user.name2 AS label2,
              operator_user.email AS secondary_label
            FROM visible_sessions ps
            INNER JOIN public.org_users_mst operator_user
              ON operator_user.tenant_org_id = ${input.tenantId}::uuid
             AND operator_user.user_id = ps.user_id
          )
          SELECT options.*, COUNT(*) OVER()::int AS total
          FROM options
          ${searchSql}
          ORDER BY options.label ASC, options.id ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        break;
      case 'terminal':
        rows = await prisma.$queryRaw<PosSessionFilterOptionQueryRow[]>(Prisma.sql`
          ${visibleSessionsSql},
          options AS (
            SELECT DISTINCT
              terminal.id::text AS id,
              COALESCE(terminal.terminal_name, terminal.terminal_code, terminal.id::text) AS label,
              terminal.terminal_name2 AS label2,
              terminal.terminal_code AS secondary_label
            FROM visible_sessions ps
            INNER JOIN public.org_payment_terminals_cf terminal
              ON terminal.tenant_org_id = ${input.tenantId}::uuid
             AND terminal.id = ps.terminal_id
          )
          SELECT options.*, COUNT(*) OVER()::int AS total
          FROM options
          ${searchSql}
          ORDER BY options.label ASC, options.id ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        break;
      case 'cashDrawer':
        rows = await prisma.$queryRaw<PosSessionFilterOptionQueryRow[]>(Prisma.sql`
          ${visibleSessionsSql},
          options AS (
            SELECT DISTINCT
              drawer.id::text AS id,
              COALESCE(drawer.drawer_name, drawer.drawer_code, drawer.id::text) AS label,
              drawer.drawer_name2 AS label2,
              drawer.drawer_code AS secondary_label
            FROM visible_sessions ps
            INNER JOIN public.org_cash_drawers_mst drawer
              ON drawer.tenant_org_id = ${input.tenantId}::uuid
             AND drawer.id = ps.cash_drawer_id
          )
          SELECT options.*, COUNT(*) OVER()::int AS total
          FROM options
          ${searchSql}
          ORDER BY options.label ASC, options.id ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        break;
      case 'cashDrawerSession':
        rows = await prisma.$queryRaw<PosSessionFilterOptionQueryRow[]>(Prisma.sql`
          ${visibleSessionsSql},
          options AS (
            SELECT DISTINCT
              drawer_session.id::text AS id,
              COALESCE(drawer_session.session_no, drawer_session.id::text) AS label,
              NULL::text AS label2,
              drawer_session.status AS secondary_label
            FROM visible_sessions ps
            INNER JOIN public.org_cash_drawer_sessions_mst drawer_session
              ON drawer_session.tenant_org_id = ${input.tenantId}::uuid
             AND drawer_session.id = ps.cash_drawer_session_id
          )
          SELECT options.*, COUNT(*) OVER()::int AS total
          FROM options
          ${searchSql}
          ORDER BY options.label ASC, options.id ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        break;
    }
  });

  const results = rows!;
  return {
    type: input.type,
    items: results.map(({ id, label, label2, secondary_label }) => ({
      id,
      label,
      label2,
      secondaryLabel: secondary_label,
    })),
    total: results[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/**
 * Lists immutable lifecycle events for a POS session the caller may view.
 * All Prisma queries are scoped to the tenant through withTenantContext.
 *
 * @param input - Tenant, actor, visibility permission, target session, and paging.
 * @returns Server-paged event rows with tenant-scoped actor display names.
 * @throws PosSessionError when the target session is outside the caller's scope.
 *
 * @example
 * const page = await listPosSessionEvents({ tenantId: 'tenant-uuid', userId: 'user-uuid', canViewAll: false, posSessionId: 'session-uuid', page: 1, pageSize: 50 });
 */
export async function listPosSessionEvents(input: {
  tenantId: string;
  userId: string;
  canViewAll: boolean;
  posSessionId: string;
  page: number;
  pageSize: number;
}): Promise<PosSessionEventListResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const userScopeSql = input.canViewAll ? Prisma.empty : Prisma.sql`AND ps.user_id = ${input.userId}::uuid`;

  return withTenantContext(input.tenantId, async () => {
    const sessionRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT ps.id
      FROM public.org_pos_sessions_mst ps
      WHERE ps.tenant_org_id = ${input.tenantId}::uuid
        AND ps.id = ${input.posSessionId}::uuid
        ${userScopeSql}
      LIMIT 1
    `);
    if (!sessionRows[0]) {
      throw new PosSessionError('POS_SESSION_NOT_FOUND', 'POS session was not found.', 404);
    }
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM public.org_pos_session_events_dtl e
        WHERE e.tenant_org_id = ${input.tenantId}::uuid
          AND e.pos_session_id = ${input.posSessionId}::uuid
      `),
      prisma.$queryRaw<PosSessionEventListRow[]>(Prisma.sql`
        SELECT e.*,
          COALESCE(performed_by_user.display_name, performed_by_user.name, performed_by_user.email) AS performed_by_display_name,
          COALESCE(created_by_user.display_name, created_by_user.name, created_by_user.email) AS created_by_display_name,
          COALESCE(updated_by_user.display_name, updated_by_user.name, updated_by_user.email) AS updated_by_display_name
        FROM public.org_pos_session_events_dtl e
        LEFT JOIN public.org_users_mst performed_by_user ON performed_by_user.tenant_org_id = e.tenant_org_id AND performed_by_user.user_id = e.performed_by
        LEFT JOIN public.org_users_mst created_by_user ON created_by_user.tenant_org_id = e.tenant_org_id AND created_by_user.user_id::text = e.created_by
        LEFT JOIN public.org_users_mst updated_by_user ON updated_by_user.tenant_org_id = e.tenant_org_id AND updated_by_user.user_id::text = e.updated_by
        WHERE e.tenant_org_id = ${input.tenantId}::uuid
          AND e.pos_session_id = ${input.posSessionId}::uuid
        ORDER BY e.event_at DESC, e.created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);
    return { items: rows, total: countRows[0]?.total ?? 0, page, pageSize };
  });
}

/**
 * Opens the authenticated operator's POS session with idempotent retry support.
 *
 * @param input - Tenant, operator, branch, and optional terminal/request context.
 * @returns Created, current, or branch-conflict session result.
 *
 * @example
 * const result = await openPosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid', branchId: 'branch-uuid' });
 */
export async function openPosSession(input: OpenPosSessionInput): Promise<OpenPosSessionResult> {
  return openPosSessionInternal(
    input,
    POS_SESSION_IDEMPOTENCY_RESOURCE.OPEN,
    POS_SESSION_EVENT_TYPE.OPEN
  );
}

/**
 * Ensures order entry has a POS session while preserving the standard open rules.
 *
 * @param input - Tenant, operator, branch, and optional terminal/request context.
 * @returns Created, current, or branch-conflict session result.
 *
 * @example
 * const result = await ensurePosSessionForOrderEntry({ tenantId: 'tenant-uuid', userId: 'user-uuid', branchId: 'branch-uuid' });
 */
export async function ensurePosSessionForOrderEntry(
  input: OpenPosSessionInput
): Promise<OpenPosSessionResult> {
  return openPosSessionInternal(
    { ...input, autoOpen: true },
    POS_SESSION_IDEMPOTENCY_RESOURCE.ENSURE_ORDER_ENTRY,
    POS_SESSION_EVENT_TYPE.AUTO_OPEN
  );
}

async function transitionActiveSession(
  input: LifecycleInput,
  transition: {
    resourceType: string;
    eventType: PosSessionEventType;
    allowedFrom: PosSessionStatus[];
    targetStatus: PosSessionStatus;
    noopWhen?: PosSessionStatus;
    timestampColumn: 'paused_at' | 'closed_at' | 'force_closed_at';
    actorColumn: 'paused_by' | 'closed_by' | 'force_closed_by';
    reasonColumn?: 'pause_reason' | 'close_reason' | 'force_close_reason';
    requireDrawerClosed?: boolean;
    /** Refuse when the rollover job already acted on the session (resume only). */
    blockWhenRolledOver?: boolean;
    /** The transition ends the shift (close / force-close): generate the Z-report when required. */
    freezesShift?: boolean;
  }
): Promise<PosSessionLifecycleResult> {
  return withTenantContext(input.tenantId, () =>
    prisma.$transaction(async (tx) => {
      const cached = await readIdempotencyResult<PosSessionLifecycleResult>(
        tx,
        input.tenantId,
        input.idempotencyKey,
        transition.resourceType
      );
      if (cached) return cached;

      const active = await getActiveSessionForUserForUpdate(tx, input.tenantId, input.userId);
      if (!active) {
        throw new PosSessionError('POS_SESSION_ACTIVE_NOT_FOUND', 'No active POS session was found.', 404);
      }

      if (transition.noopWhen && active.status === transition.noopWhen) {
        const result: PosSessionLifecycleResult = { type: 'NOOP', session: active };
        await storeIdempotencyResult(tx, {
          tenantId: input.tenantId,
          key: input.idempotencyKey,
          resourceType: transition.resourceType,
          resourceId: active.id,
          result,
        });
        return result;
      }

      if (!transition.allowedFrom.includes(active.status as PosSessionStatus)) {
        throw new PosSessionError(
          'POS_SESSION_INVALID_STATUS',
          `POS session cannot transition from ${active.status} using ${transition.eventType}.`,
          409
        );
      }

      if (transition.blockWhenRolledOver && active.rollover_applied_at) {
        throw new PosSessionError(
          POS_SESSION_ROLLOVER_ERROR.ROLLED_OVER,
          'This POS session was paused because the business day changed. Close it and open a new session.',
          409,
          { sessionId: active.id, businessDate: active.business_date }
        );
      }

      const performedBy = input.performedBy ?? input.userId;
      const actingOnOthers = performedBy !== input.userId;

      if (transition.requireDrawerClosed && !(input.bypassDrawerCheck && actingOnOthers)) {
        await assertLinkedDrawerIsClosed(tx, active);
      }

      const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
        UPDATE public.org_pos_sessions_mst
        SET status = ${transition.targetStatus},
            ${Prisma.raw(transition.timestampColumn)} = NOW(),
            ${Prisma.raw(transition.actorColumn)} = ${performedBy}::uuid,
            ${transition.reasonColumn ? Prisma.sql`${Prisma.raw(transition.reasonColumn)} = ${input.reason ?? null},` : Prisma.empty}
            updated_at = NOW(),
            updated_by = ${performedBy}
        WHERE tenant_org_id = ${input.tenantId}::uuid
          AND id = ${active.id}::uuid
        RETURNING *
      `);

      const session = normalizeSession(rows[0]);
      // Z-report (D2): when the tenant requires it, the shift is frozen in the SAME transaction that
      // closes it, so a closed session can never exist without its Z-report.
      if (transition.freezesShift) {
        const settings = await getCashControlSettings({
          tenantId: input.tenantId,
          branchId: active.branch_id,
          userId: active.user_id,
        });
        if (settings.shiftZReportRequired) {
          await generateShiftZReportTx(tx, {
            tenantId: input.tenantId,
            posSessionId: session.id,
            generatedBy: performedBy,
          });
        }
      }
      await recordEventTx(tx, {
        tenantId: input.tenantId,
        sessionId: session.id,
        eventType: transition.eventType,
        previousStatus: active.status as PosSessionStatus,
        newStatus: transition.targetStatus,
        performedBy,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        sourceChannel: input.sourceChannel,
        metadata: actingOnOthers
          ? {
              ...(input.metadata ?? {}),
              actedOnBehalfOfUserId: input.userId,
              drawerCheckBypassed: Boolean(transition.requireDrawerClosed && input.bypassDrawerCheck),
            }
          : input.metadata,
      });

      const result: PosSessionLifecycleResult = { type: 'UPDATED', session };
      await storeIdempotencyResult(tx, {
        tenantId: input.tenantId,
        key: input.idempotencyKey,
        resourceType: transition.resourceType,
        resourceId: session.id,
        result,
      });
      return result;
    })
  );
}

/**
 * Pauses the caller's open session while retaining its accountability trail.
 *
 * @param input - Tenant, actor, optional reason, and idempotency context.
 * @returns Updated or idempotent lifecycle result.
 *
 * @example
 * await pausePosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid', reason: 'Break' });
 */
export function pausePosSession(input: LifecycleInput): Promise<PosSessionLifecycleResult> {
  return transitionActiveSession(input, {
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.PAUSE,
    eventType: POS_SESSION_EVENT_TYPE.PAUSE,
    allowedFrom: [POS_SESSION_STATUS.OPEN],
    targetStatus: POS_SESSION_STATUS.PAUSED,
    noopWhen: POS_SESSION_STATUS.PAUSED,
    timestampColumn: 'paused_at',
    actorColumn: 'paused_by',
    reasonColumn: 'pause_reason',
  });
}

/**
 * Resumes the caller's paused session without creating a second active session.
 *
 * @param input - Tenant, actor, optional reason, and idempotency context.
 * @returns Updated or idempotent lifecycle result.
 *
 * @example
 * await resumePosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid' });
 */
export function resumePosSession(input: LifecycleInput): Promise<PosSessionLifecycleResult> {
  return transitionActiveSession(input, {
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.RESUME,
    eventType: POS_SESSION_EVENT_TYPE.RESUME,
    allowedFrom: [POS_SESSION_STATUS.PAUSED],
    targetStatus: POS_SESSION_STATUS.OPEN,
    noopWhen: POS_SESSION_STATUS.OPEN,
    timestampColumn: 'paused_at',
    actorColumn: 'paused_by',
    blockWhenRolledOver: true,
  });
}

/**
 * Closes the caller's active session after linked drawer controls are satisfied.
 *
 * @param input - Tenant, actor, optional reason, and idempotency context.
 * @returns Updated or idempotent lifecycle result.
 *
 * @example
 * await closePosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid', reason: 'Shift complete' });
 */
export function closePosSession(input: LifecycleInput): Promise<PosSessionLifecycleResult> {
  return transitionActiveSession(input, {
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.CLOSE,
    eventType: POS_SESSION_EVENT_TYPE.CLOSE,
    allowedFrom: [POS_SESSION_STATUS.OPEN, POS_SESSION_STATUS.PAUSED],
    targetStatus: POS_SESSION_STATUS.CLOSED,
    timestampColumn: 'closed_at',
    actorColumn: 'closed_by',
    reasonColumn: 'close_reason',
    requireDrawerClosed: true,
    freezesShift: true,
  });
}

/**
 * Force-closes an active session with a mandatory reason for exceptional operations.
 *
 * @param input - Tenant, actor, required reason, and idempotency context.
 * @returns Updated or idempotent lifecycle result.
 *
 * @example
 * await forceClosePosSession({ tenantId: 'tenant-uuid', userId: 'user-uuid', reason: 'Terminal outage' });
 */
export function forceClosePosSession(input: LifecycleInput): Promise<PosSessionLifecycleResult> {
  return transitionActiveSession(input, {
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.FORCE_CLOSE,
    eventType: POS_SESSION_EVENT_TYPE.FORCE_CLOSE,
    allowedFrom: [POS_SESSION_STATUS.OPEN, POS_SESSION_STATUS.PAUSED],
    targetStatus: POS_SESSION_STATUS.FORCE_CLOSED,
    timestampColumn: 'force_closed_at',
    actorColumn: 'force_closed_by',
    reasonColumn: 'force_close_reason',
    requireDrawerClosed: true,
    freezesShift: true,
  });
}
