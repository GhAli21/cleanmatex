import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { CASH_EFFECTS } from '@/lib/constants/cash-drawer';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  POS_SHIFT_REPORT_ERROR,
  POS_SHIFT_REPORT_KIND,
  POS_SHIFT_SNAPSHOT_VERSION,
  POS_SHIFT_Z_REPORT_NO_PREFIX,
  POS_SHIFT_Z_SESSION_STATUS,
  type PosShiftReportKind,
} from '@/lib/constants/pos-shift-report';
import { PosSessionError } from '@/lib/services/pos-session-error';
import { loadPosSessionRollup } from '@/lib/services/pos-session-rollup';
import { loadDrawerCashAttribution } from '@/lib/services/cash-drawer-attribution';
import type {
  PosShiftCashRow,
  PosShiftDrawerBalanceRow,
  PosShiftDrawerFigures,
  PosShiftReportSnapshot,
  PosShiftRoundingRow,
  PosShiftSessionFacts,
  PosShiftZReport,
} from '@/lib/types/pos-shift-report';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = Pick<PrismaTx, '$queryRaw'>;

interface SessionFactsRow {
  id: string;
  session_no: string;
  business_date: Date | string;
  business_timezone: string;
  status: string;
  branch_id: string;
  branch_name: string | null;
  user_id: string;
  operator_name: string | null;
  opened_at: Date | string;
  closed_at: Date | string | null;
  force_closed_at: Date | string | null;
  auto_close_reason: string | null;
  cash_drawer_session_id: string | null;
}

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : String(value));
const dateOnly = (value: Date | string): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function loadSessionFacts(
  db: Db,
  tenantId: string,
  posSessionId: string,
  scopeToUserId: string | null
): Promise<SessionFactsRow> {
  const rows = await db.$queryRaw<SessionFactsRow[]>(Prisma.sql`
    SELECT
      ps.id, ps.session_no, ps.business_date, ps.business_timezone, ps.status, ps.branch_id,
      COALESCE(b.name, b.branch_name) AS branch_name,
      ps.user_id,
      COALESCE(u.display_name, u.name, u.email) AS operator_name,
      ps.opened_at, ps.closed_at, ps.force_closed_at, ps.auto_close_reason, ps.cash_drawer_session_id
    FROM public.org_pos_sessions_mst ps
    LEFT JOIN public.org_branches_mst b
      ON b.tenant_org_id = ps.tenant_org_id AND b.id = ps.branch_id
    LEFT JOIN public.org_users_mst u
      ON u.tenant_org_id = ps.tenant_org_id AND u.user_id = ps.user_id
    WHERE ps.tenant_org_id = ${tenantId}::uuid
      AND ps.id = ${posSessionId}::uuid
      AND ps.is_active = TRUE
      ${scopeToUserId ? Prisma.sql`AND ps.user_id = ${scopeToUserId}::uuid` : Prisma.empty}
    LIMIT 1
  `);
  if (!rows[0]) {
    throw new PosSessionError('POS_SESSION_NOT_FOUND', 'POS session was not found.', 404);
  }
  return rows[0];
}

async function loadCashFigures(
  db: Db,
  tenantId: string,
  posSessionId: string
): Promise<{ byCurrency: PosShiftCashRow[]; changeRounding: PosShiftRoundingRow[] }> {
  const [byCurrency, rounding] = await Promise.all([
    db.$queryRaw<Array<{ currency_code: string | null; cash_in: string; cash_out: string; net: string; line_count: number }>>(Prisma.sql`
      SELECT currency_code,
             COALESCE(SUM(amount) FILTER (WHERE direction = 'IN'), 0)::text  AS cash_in,
             COALESCE(SUM(amount) FILTER (WHERE direction = 'OUT'), 0)::text AS cash_out,
             COALESCE(SUM(CASE direction WHEN 'IN' THEN amount WHEN 'OUT' THEN -amount ELSE 0 END), 0)::text AS net,
             COUNT(*)::int AS line_count
      FROM public.org_fin_voucher_trx_lines_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND pos_session_id = ${posSessionId}::uuid
        AND is_active = TRUE
        AND cash_effect_code = ${CASH_EFFECTS.DRAWER}
      GROUP BY currency_code
      ORDER BY currency_code NULLS LAST
    `),
    db.$queryRaw<Array<{ currency_code: string | null; net: string; line_count: number }>>(Prisma.sql`
      SELECT currency_code,
             COALESCE(SUM(CASE direction WHEN 'IN' THEN amount WHEN 'OUT' THEN -amount ELSE 0 END), 0)::text AS net,
             COUNT(*)::int AS line_count
      FROM public.org_fin_voucher_trx_lines_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND pos_session_id = ${posSessionId}::uuid
        AND is_active = TRUE
        AND line_role = ${LINE_ROLE.CASH_CHANGE_ROUNDING}
      GROUP BY currency_code
      ORDER BY currency_code NULLS LAST
    `),
  ]);
  return {
    byCurrency: byCurrency.map((r) => ({
      currencyCode: r.currency_code,
      cashIn: r.cash_in,
      cashOut: r.cash_out,
      net: r.net,
      lineCount: r.line_count,
    })),
    changeRounding: rounding.map((r) => ({ currencyCode: r.currency_code, net: r.net, lineCount: r.line_count })),
  };
}

async function loadDrawerFigures(
  db: Db,
  tenantId: string,
  cashDrawerSessionId: string | null
): Promise<PosShiftDrawerFigures | null> {
  if (!cashDrawerSessionId) return null;
  const sessions = await db.$queryRaw<
    Array<{
      id: string;
      session_no: string;
      drawer_name: string | null;
      status: string;
      opened_at: Date | string;
      closed_at: Date | string | null;
      variance_threshold_snapshot: string | null;
      variance_approved_by: string | null;
      variance_rejected_by: string | null;
    }>
  >(Prisma.sql`
    SELECT ds.id, ds.session_no, d.drawer_name, ds.status, ds.opened_at, ds.closed_at,
           ds.variance_threshold_snapshot::text AS variance_threshold_snapshot,
           ds.variance_approved_by, ds.variance_rejected_by
    FROM public.org_cash_drawer_sessions_mst ds
    LEFT JOIN public.org_cash_drawers_mst d
      ON d.tenant_org_id = ds.tenant_org_id AND d.id = ds.cash_drawer_id
    WHERE ds.tenant_org_id = ${tenantId}::uuid AND ds.id = ${cashDrawerSessionId}::uuid
    LIMIT 1
  `);
  const ds = sessions[0];
  if (!ds) return null;

  const balances = await db.$queryRaw<
    Array<{
      currency_code: string;
      opening_expected: string | null;
      opening_counted: string | null;
      fin_in: string | null;
      fin_out: string | null;
      trx_in: string | null;
      trx_out: string | null;
      closing_expected: string | null;
      closing_counted: string | null;
      closing_variance: string | null;
    }>
  >(Prisma.sql`
    SELECT currency_code,
           opening_expected::text, opening_counted::text, fin_in::text, fin_out::text,
           trx_in::text, trx_out::text,
           closing_expected::text, closing_counted::text, closing_variance::text
    FROM public.org_cash_drawer_ses_bal_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND cash_drawer_session_id = ${cashDrawerSessionId}::uuid
      AND is_active = TRUE
    ORDER BY currency_code
  `);

  const attribution = await loadDrawerCashAttribution(db, tenantId, cashDrawerSessionId);
  const approved = ds.variance_approved_by !== null;
  const rejected = ds.variance_rejected_by !== null;
  return {
    sessionId: ds.id,
    sessionNo: ds.session_no,
    drawerName: ds.drawer_name,
    status: ds.status,
    openedAt: iso(ds.opened_at),
    closedAt: ds.closed_at ? iso(ds.closed_at) : null,
    variancePending: ds.variance_threshold_snapshot !== null && !approved && !rejected,
    varianceApproved: approved,
    varianceRejected: rejected,
    attribution: attribution.map((a) => ({
      posSessionId: a.posSessionId,
      posSessionNo: a.posSessionNo,
      operatorName: a.operatorName,
      currencyCode: a.currencyCode,
      cashIn: a.cashIn,
      cashOut: a.cashOut,
      net: a.net,
      lineCount: a.lineCount,
    })),
    balances: balances.map(
      (b): PosShiftDrawerBalanceRow => ({
        currencyCode: b.currency_code,
        openingExpected: b.opening_expected,
        openingCounted: b.opening_counted,
        finIn: b.fin_in,
        finOut: b.fin_out,
        trxIn: b.trx_in,
        trxOut: b.trx_out,
        closingExpected: b.closing_expected,
        closingCounted: b.closing_counted,
        closingVariance: b.closing_variance,
      })
    ),
  };
}

function toSessionFacts(row: SessionFactsRow): PosShiftSessionFacts {
  const closedAt = row.closed_at ?? row.force_closed_at;
  return {
    id: row.id,
    sessionNo: row.session_no,
    businessDate: dateOnly(row.business_date),
    businessTimezone: row.business_timezone,
    status: row.status,
    branchId: row.branch_id,
    branchName: row.branch_name,
    operatorUserId: row.user_id,
    operatorName: row.operator_name,
    openedAt: iso(row.opened_at),
    closedAt: closedAt ? iso(closedAt) : null,
    autoCloseReason: row.auto_close_reason,
  };
}

/**
 * Builds the figures of one POS session's shift: sales/refunds/voucher roll-up per currency,
 * the cash that moved through the drawer, the change-rounding the business absorbed, and the
 * linked drawer session's balances. The same builder produces the live X-report and the body of
 * the frozen Z-report, so the two can never disagree about what a shift contains.
 *
 * @param db Prisma client or transaction (a transaction when called from the closing flow)
 * @param input tenant, session, report kind and an optional owner filter
 * @returns the versioned snapshot
 * @throws PosSessionError POS_SESSION_NOT_FOUND when the session is missing (or not the owner's)
 */
export async function buildPosShiftSnapshot(
  db: Db,
  input: { tenantId: string; posSessionId: string; kind: PosShiftReportKind; scopeToUserId?: string | null }
): Promise<PosShiftReportSnapshot> {
  const facts = await loadSessionFacts(db, input.tenantId, input.posSessionId, input.scopeToUserId ?? null);
  const [rollup, cash, drawer] = await Promise.all([
    loadPosSessionRollup(db, input.tenantId, input.posSessionId),
    loadCashFigures(db, input.tenantId, input.posSessionId),
    loadDrawerFigures(db, input.tenantId, facts.cash_drawer_session_id),
  ]);
  return {
    version: POS_SHIFT_SNAPSHOT_VERSION,
    kind: input.kind,
    generatedAt: new Date().toISOString(),
    session: toSessionFacts(facts),
    payments: rollup.payments,
    refunds: rollup.refunds,
    voucherLines: rollup.voucherLines,
    cash,
    drawer,
  };
}

/**
 * The live X-report: the shift's figures right now, computed on demand and never stored.
 *
 * @param input tenant, actor and whether the actor may see other operators' sessions
 * @returns the X snapshot
 */
export async function getLivePosShiftReport(input: {
  tenantId: string;
  userId: string;
  posSessionId: string;
  canViewAll?: boolean;
}): Promise<PosShiftReportSnapshot> {
  return withTenantContext(input.tenantId, () =>
    buildPosShiftSnapshot(prisma, {
      tenantId: input.tenantId,
      posSessionId: input.posSessionId,
      kind: POS_SHIFT_REPORT_KIND.X,
      scopeToUserId: input.canViewAll ? null : input.userId,
    })
  );
}

/**
 * Freezes a finished POS session into its immutable Z-report, inside the caller's transaction.
 * Idempotent: a session has exactly one Z-report, so a second call returns the existing one
 * instead of creating "a second Z". The hash is stamped by the database trigger.
 *
 * Call it from the same transaction that closes the session, after the status update, so a
 * tenant that requires Z-reports can never end up with a closed shift and no artifact.
 *
 * @param tx the closing transaction
 * @param input tenant, session and who closed it (user id, or `system` for the rollover job)
 * @returns the report id and whether this call created it
 * @throws PosSessionError Z_REPORT_SESSION_NOT_FINISHED when the session is still open or paused
 */
export async function generateShiftZReportTx(
  tx: PrismaTx,
  input: { tenantId: string; posSessionId: string; generatedBy: string }
): Promise<{ reportId: string; created: boolean }> {
  const facts = await loadSessionFacts(tx, input.tenantId, input.posSessionId, null);
  if (facts.status !== POS_SESSION_STATUS.CLOSED && facts.status !== POS_SESSION_STATUS.FORCE_CLOSED) {
    throw new PosSessionError(
      POS_SHIFT_REPORT_ERROR.SESSION_NOT_FINISHED,
      'A Z-report can only be generated once the POS session is closed.',
      409
    );
  }

  const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM public.org_pos_shift_z_rpt_tr
    WHERE tenant_org_id = ${input.tenantId}::uuid AND pos_session_id = ${input.posSessionId}::uuid
    LIMIT 1
  `);
  if (existing[0]) return { reportId: existing[0].id, created: false };

  const snapshot = await buildPosShiftSnapshot(tx, {
    tenantId: input.tenantId,
    posSessionId: input.posSessionId,
    kind: POS_SHIFT_REPORT_KIND.Z,
  });
  const closedAt = snapshot.session.closedAt ?? new Date().toISOString();

  // snapshot_hash is a required column but is overwritten by trg_opszr_hash; the placeholder never persists.
  const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO public.org_pos_shift_z_rpt_tr (
      tenant_org_id, branch_id, pos_session_id, report_no, business_date, business_timezone,
      session_status, session_opened_at, session_closed_at, operator_user_id,
      cash_drawer_session_id, snapshot_version, snapshot, snapshot_hash, generated_by, created_by
    )
    VALUES (
      ${input.tenantId}::uuid, ${facts.branch_id}::uuid, ${input.posSessionId}::uuid,
      ${`${POS_SHIFT_Z_REPORT_NO_PREFIX}${facts.session_no}`}, ${snapshot.session.businessDate}::date,
      ${facts.business_timezone},
      ${facts.status === POS_SESSION_STATUS.FORCE_CLOSED ? POS_SHIFT_Z_SESSION_STATUS.FORCE_CLOSED : POS_SHIFT_Z_SESSION_STATUS.CLOSED},
      ${snapshot.session.openedAt}::timestamptz, ${closedAt}::timestamptz, ${facts.user_id}::uuid,
      ${facts.cash_drawer_session_id}::uuid, ${POS_SHIFT_SNAPSHOT_VERSION}, ${JSON.stringify(snapshot)}::jsonb,
      'pending', ${input.generatedBy}, ${input.generatedBy}
    )
    ON CONFLICT (tenant_org_id, pos_session_id) DO NOTHING
    RETURNING id
  `);
  if (inserted[0]) return { reportId: inserted[0].id, created: true };

  // Lost a race to a concurrent generator: the other row is the one report.
  const raced = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM public.org_pos_shift_z_rpt_tr
    WHERE tenant_org_id = ${input.tenantId}::uuid AND pos_session_id = ${input.posSessionId}::uuid
    LIMIT 1
  `);
  return { reportId: raced[0].id, created: false };
}

/**
 * Generates the Z-report of a finished session on demand (own transaction) — for tenants that do
 * not auto-generate at close, or to back-fill. The snapshot is taken now; `generatedAt` and the
 * session's `closedAt` show how long after the close that was.
 *
 * @param input tenant, actor and session
 * @returns the report id and whether this call created it
 */
export async function generateShiftZReport(input: {
  tenantId: string;
  posSessionId: string;
  actorUserId: string;
}): Promise<{ reportId: string; created: boolean }> {
  return withTenantContext(input.tenantId, () =>
    prisma.$transaction((tx) =>
      generateShiftZReportTx(tx, {
        tenantId: input.tenantId,
        posSessionId: input.posSessionId,
        generatedBy: input.actorUserId,
      })
    )
  );
}

/**
 * Reads the stored Z-report of a session, re-verifying its hash against the stored snapshot.
 *
 * @param input tenant, actor and whether the actor may see other operators' sessions
 * @returns the Z-report, or null when none exists yet
 * @throws PosSessionError POS_SESSION_NOT_FOUND when the session is missing or not visible
 */
export async function getShiftZReport(input: {
  tenantId: string;
  userId: string;
  posSessionId: string;
  canViewAll?: boolean;
}): Promise<PosShiftZReport | null> {
  return withTenantContext(input.tenantId, async () => {
    // Visibility is the session's: same owner/view_all rule as the live summary.
    await loadSessionFacts(prisma, input.tenantId, input.posSessionId, input.canViewAll ? null : input.userId);

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        report_no: string;
        pos_session_id: string;
        branch_id: string;
        business_date: Date | string;
        session_status: string;
        generated_at: Date | string;
        generated_by: string;
        snapshot_hash: string;
        snapshot: PosShiftReportSnapshot;
        hash_ok: boolean;
      }>
    >(Prisma.sql`
      SELECT id, report_no, pos_session_id, branch_id, business_date, session_status,
             generated_at, generated_by, snapshot_hash, snapshot,
             (encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex') = snapshot_hash) AS hash_ok
      FROM public.org_pos_shift_z_rpt_tr
      WHERE tenant_org_id = ${input.tenantId}::uuid AND pos_session_id = ${input.posSessionId}::uuid
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      reportNo: row.report_no,
      posSessionId: row.pos_session_id,
      branchId: row.branch_id,
      businessDate: dateOnly(row.business_date),
      sessionStatus: row.session_status,
      generatedAt: iso(row.generated_at),
      generatedBy: row.generated_by,
      snapshotHash: row.snapshot_hash,
      hashVerified: row.hash_ok,
      snapshot: row.snapshot,
    };
  });
}
