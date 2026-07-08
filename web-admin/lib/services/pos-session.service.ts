import 'server-only';

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  POS_SESSION_EVENT_TYPE,
  POS_SESSION_IDEMPOTENCY_RESOURCE,
  POS_SESSION_STATUS,
  type PosSessionEventType,
  type PosSessionStatus,
} from '@/lib/constants/pos-session';
import type {
  GetMyActivePosSessionResult,
  OpenPosSessionResult,
  PosSessionIdempotentResult,
  PosSessionLifecycleResult,
  PosSessionListResult,
  PosSessionListRow,
  PosSessionMetadata,
  PosSessionRow,
  PosSessionSummary,
  PosSessionWithContext,
} from '@/lib/types/pos-session';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface OpenPosSessionInput {
  tenantId: string;
  userId: string;
  branchId: string;
  terminalId?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
  autoOpen?: boolean;
}

interface LifecycleInput {
  tenantId: string;
  userId: string;
  reason?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
}

interface PosSessionFinanceContextInput {
  tenantId: string;
  userId: string;
  posSessionId?: string | null;
  branchId?: string | null;
}

interface AutoLinkDrawerInput extends PosSessionFinanceContextInput {
  cashDrawerSessionId?: string | null;
  idempotencyKey?: string | null;
  sourceChannel?: string | null;
  metadata?: PosSessionMetadata;
}

const ACTIVE_STATUSES = [POS_SESSION_STATUS.OPEN, POS_SESSION_STATUS.PAUSED] as const;
const IDEMPOTENCY_TTL_DAYS = 7;

export class PosSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422
  ) {
    super(message);
    this.name = 'PosSessionError';
  }
}

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
  return {
    ...row,
    ...normalizeSession(row),
  };
}

function normalizeSessionWithContext(row: PosSessionWithContext): PosSessionWithContext {
  return {
    ...row,
    ...normalizeSession(row),
  };
}

function businessDateForTimezone(timezone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
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

  const rows = await db.$queryRaw<PosSessionWithContext[]>(Prisma.sql`
    SELECT
      ps.*,
      COALESCE(b.name, b.branch_name) AS branch_name,
      b.name2 AS branch_name2,
      pt.terminal_name,
      pt.terminal_code,
      ${drawerNameSql},
      ${drawerSessionNoSql},
      ${drawerSessionStatusSql}
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
    WHERE ps.tenant_org_id = ${tenantId}::uuid
      AND ps.user_id = ${userId}::uuid
      AND ps.status IN (${Prisma.join([...ACTIVE_STATUSES])})
      AND ps.is_active = TRUE
    ORDER BY ps.opened_at DESC
    LIMIT 1
  `);
  return rows[0] ? normalizeSessionWithContext(rows[0]) : null;
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

async function resolveBusinessTimezone(tx: PrismaTx, tenantId: string): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ timezone: string | null }>>(Prisma.sql`
    SELECT timezone
    FROM public.org_tenants_mst
    WHERE id = ${tenantId}::uuid
    LIMIT 1
  `);
  return rows[0]?.timezone || 'Asia/Muscat';
}

async function recordEventTx(
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
  if (rows[0]?.status === 'OPEN') {
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
    if (session.cash_drawer_session_id !== input.cashDrawerSessionId) {
      throw new PosSessionError(
        'POS_SESSION_DRAWER_ALREADY_LINKED',
        'POS session is already linked to a different cash drawer session.',
        409
      );
    }
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

function emptySummaryAmount(): { currencyCode: null; amount: number; count: number } {
  return { currencyCode: null, amount: 0, count: 0 };
}

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

    const [paymentTotals, paymentGroups, refundTotals, refundGroups, voucherTotals, voucherGroups] =
      await Promise.all([
        prisma.$queryRaw<Array<{ currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT currency_code, COALESCE(SUM(amount), 0)::float8 AS amount, COUNT(*)::int AS count
          FROM public.org_order_payments_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY currency_code
          ORDER BY currency_code NULLS LAST
          LIMIT 1
        `),
        prisma.$queryRaw<Array<{ payment_method_code: string | null; payment_status: string | null; currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT payment_method_code, payment_status, currency_code,
                 COALESCE(SUM(amount), 0)::float8 AS amount,
                 COUNT(*)::int AS count
          FROM public.org_order_payments_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY payment_method_code, payment_status, currency_code
          ORDER BY payment_method_code NULLS LAST, payment_status NULLS LAST
        `),
        prisma.$queryRaw<Array<{ currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT currency_code, COALESCE(SUM(refund_amount), 0)::float8 AS amount, COUNT(*)::int AS count
          FROM public.org_order_refunds_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY currency_code
          ORDER BY currency_code NULLS LAST
          LIMIT 1
        `),
        prisma.$queryRaw<Array<{ refund_method_code: string | null; refund_status: string | null; currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT refund_method_code, refund_status, currency_code,
                 COALESCE(SUM(refund_amount), 0)::float8 AS amount,
                 COUNT(*)::int AS count
          FROM public.org_order_refunds_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY refund_method_code, refund_status, currency_code
          ORDER BY refund_method_code NULLS LAST, refund_status NULLS LAST
        `),
        prisma.$queryRaw<Array<{ currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT currency_code, COALESCE(SUM(amount), 0)::float8 AS amount, COUNT(*)::int AS count
          FROM public.org_fin_voucher_trx_lines_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY currency_code
          ORDER BY currency_code NULLS LAST
          LIMIT 1
        `),
        prisma.$queryRaw<Array<{ line_role: string | null; payment_method_code: string | null; direction: string | null; currency_code: string | null; amount: number; count: number }>>(Prisma.sql`
          SELECT line_role, payment_method_code, direction, currency_code,
                 COALESCE(SUM(amount), 0)::float8 AS amount,
                 COUNT(*)::int AS count
          FROM public.org_fin_voucher_trx_lines_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND pos_session_id = ${input.posSessionId}::uuid
            AND is_active = TRUE
          GROUP BY line_role, payment_method_code, direction, currency_code
          ORDER BY line_role NULLS LAST, payment_method_code NULLS LAST
        `),
      ]);

    return {
      session,
      payments: {
        total: paymentTotals[0]
          ? { currencyCode: paymentTotals[0].currency_code, amount: paymentTotals[0].amount, count: paymentTotals[0].count }
          : emptySummaryAmount(),
        byMethod: paymentGroups.map((row) => ({
          groupCode: row.payment_method_code,
          status: row.payment_status,
          currencyCode: row.currency_code,
          amount: row.amount,
          count: row.count,
        })),
      },
      refunds: {
        total: refundTotals[0]
          ? { currencyCode: refundTotals[0].currency_code, amount: refundTotals[0].amount, count: refundTotals[0].count }
          : emptySummaryAmount(),
        byMethod: refundGroups.map((row) => ({
          groupCode: row.refund_method_code,
          status: row.refund_status,
          currencyCode: row.currency_code,
          amount: row.amount,
          count: row.count,
        })),
      },
      voucherLines: {
        total: voucherTotals[0]
          ? { currencyCode: voucherTotals[0].currency_code, amount: voucherTotals[0].amount, count: voucherTotals[0].count }
          : emptySummaryAmount(),
        byRole: voucherGroups.map((row) => ({
          lineRole: row.line_role,
          paymentMethodCode: row.payment_method_code,
          direction: row.direction,
          currencyCode: row.currency_code,
          amount: row.amount,
          count: row.count,
        })),
      },
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

  const businessTimezone = await resolveBusinessTimezone(tx, input.tenantId);
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
      ${input.userId}::uuid, ${input.userId}, ${JSON.stringify(input.metadata ?? {})}::jsonb
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
    performedBy: input.userId,
    idempotencyKey: input.idempotencyKey,
    sourceChannel: input.sourceChannel,
    metadata: input.metadata,
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

export async function listPosSessions(input: {
  tenantId: string;
  userId: string;
  canViewAll: boolean;
  page: number;
  pageSize: number;
  branchId?: string | null;
  status?: PosSessionStatus | null;
  scope?: 'own' | 'all';
}): Promise<PosSessionListResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const showAll = input.canViewAll && input.scope === 'all';

  const userScopeSql = showAll
    ? Prisma.empty
    : Prisma.sql`AND ps.user_id = ${input.userId}::uuid`;
  const branchSql = input.branchId
    ? Prisma.sql`AND ps.branch_id = ${input.branchId}::uuid`
    : Prisma.empty;
  const statusSql = input.status
    ? Prisma.sql`AND ps.status = ${input.status}`
    : Prisma.empty;

  return withTenantContext(input.tenantId, async () => {
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM public.org_pos_sessions_mst ps
        WHERE ps.tenant_org_id = ${input.tenantId}::uuid
          AND ps.is_active = TRUE
          ${userScopeSql}
          ${branchSql}
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
          cds.status AS cash_drawer_session_status
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
        WHERE ps.tenant_org_id = ${input.tenantId}::uuid
          AND ps.is_active = TRUE
          ${userScopeSql}
          ${branchSql}
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

export async function openPosSession(input: OpenPosSessionInput): Promise<OpenPosSessionResult> {
  return openPosSessionInternal(
    input,
    POS_SESSION_IDEMPOTENCY_RESOURCE.OPEN,
    POS_SESSION_EVENT_TYPE.OPEN
  );
}

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

      if (transition.requireDrawerClosed) {
        await assertLinkedDrawerIsClosed(tx, active);
      }

      const rows = await tx.$queryRaw<PosSessionRow[]>(Prisma.sql`
        UPDATE public.org_pos_sessions_mst
        SET status = ${transition.targetStatus},
            ${Prisma.raw(transition.timestampColumn)} = NOW(),
            ${Prisma.raw(transition.actorColumn)} = ${input.userId}::uuid,
            ${transition.reasonColumn ? Prisma.sql`${Prisma.raw(transition.reasonColumn)} = ${input.reason ?? null},` : Prisma.empty}
            updated_at = NOW(),
            updated_by = ${input.userId}
        WHERE tenant_org_id = ${input.tenantId}::uuid
          AND id = ${active.id}::uuid
        RETURNING *
      `);

      const session = normalizeSession(rows[0]);
      await recordEventTx(tx, {
        tenantId: input.tenantId,
        sessionId: session.id,
        eventType: transition.eventType,
        previousStatus: active.status as PosSessionStatus,
        newStatus: transition.targetStatus,
        performedBy: input.userId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        sourceChannel: input.sourceChannel,
        metadata: input.metadata,
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

export function resumePosSession(input: LifecycleInput): Promise<PosSessionLifecycleResult> {
  return transitionActiveSession(input, {
    resourceType: POS_SESSION_IDEMPOTENCY_RESOURCE.RESUME,
    eventType: POS_SESSION_EVENT_TYPE.RESUME,
    allowedFrom: [POS_SESSION_STATUS.PAUSED],
    targetStatus: POS_SESSION_STATUS.OPEN,
    noopWhen: POS_SESSION_STATUS.OPEN,
    timestampColumn: 'paused_at',
    actorColumn: 'paused_by',
  });
}

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
  });
}

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
  });
}
