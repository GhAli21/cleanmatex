import 'server-only';

/**
 * D-09 — Finance reconciliation report service.
 *
 * Four read-only reconciliation reports required for launch (decision D-09 /
 * 23_DECISIONS_ADDENDUM). Each function is tenant-scoped via `withTenantContext`
 * and additionally filters every query by `tenant_org_id` explicitly (defense in
 * depth — raw SQL bypasses Prisma's tenant middleware, so the WHERE clause is the
 * authoritative isolation boundary, matching the existing finance reports).
 *
 * Reads only. No table is mutated; no new DB object is introduced. The B2B and
 * overpayment-disposition detail tables have no Prisma model (mig 0380 / 0354),
 * so those two reports use parametrised `$queryRaw`.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  EXCESS_LIABILITY_SOURCES,
  RECON_REPORT_EPSILON,
} from '@/lib/constants/reconciliation-reports';
import { MOVEMENT_DIRECTIONS } from '@/lib/constants/payment';
import { CREDIT_NOTE_STATUSES } from '@/lib/constants/order-financial';
import type {
  ReconReportFilter,
  ExcessLiabilityReport,
  ExcessLiabilityRow,
  B2bStatementReconReport,
  B2bStatementReconRow,
  OverpaymentDispositionReconReport,
  OverpaymentDispositionReconRow,
  CashDrawerReconReport,
  CashDrawerReconRow,
} from '@/lib/types/reconciliation-report';

/** Decimal | number | null → number. */
function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

/** Build the optional `created_at` window as raw SQL fragments. */
function dateConds(column: string, from?: string, to?: string): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [];
  if (from) conds.push(Prisma.sql`${Prisma.raw(column)} >= ${new Date(from)}`);
  if (to) conds.push(Prisma.sql`${Prisma.raw(column)} <= ${new Date(`${to}T23:59:59.999Z`)}`);
  return conds;
}

/** Prisma-side `created_at` window for typed model queries. */
function dateFilter(from?: string, to?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unallocated excess / customer stored-value liability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outstanding customer stored-value the tenant still owes: wallet balances,
 * customer-advance balances, and active credit-note remaining balances — each
 * with a positive balance. This is the "unallocated excess > 0" reconciliation
 * the validation backlog flagged: money taken from / owed to customers that has
 * not yet been allocated to an order or invoice.
 *
 * Not date/branch filtered — a liability is outstanding regardless of when it
 * arose; the report is a point-in-time balance snapshot.
 *
 * @param filter tenant scope (date/branch ignored for this snapshot report).
 */
export async function getExcessLiabilityReport(
  filter: ReconReportFilter,
): Promise<ExcessLiabilityReport> {
  const { tenantOrgId } = filter;

  return withTenantContext(tenantOrgId, async () => {
    const [wallets, advances, creditNotes] = await Promise.all([
      prisma.org_customer_wallets_mst.findMany({
        where: { tenant_org_id: tenantOrgId, is_active: true, balance: { gt: 0 } },
        select: {
          customer_id: true,
          balance: true,
          currency_code: true,
          last_activity_at: true,
          org_customers_mst: { select: { display_name: true, name: true } },
        },
      }),
      prisma.org_customer_advances_mst.findMany({
        where: { tenant_org_id: tenantOrgId, is_active: true, balance: { gt: 0 } },
        select: {
          customer_id: true,
          balance: true,
          currency_code: true,
          last_activity_at: true,
          org_customers_mst: { select: { display_name: true, name: true } },
        },
      }),
      prisma.org_credit_notes_mst.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          is_active: true,
          status: CREDIT_NOTE_STATUSES.ACTIVE,
          remaining_balance: { gt: 0 },
        },
        select: {
          customer_id: true,
          remaining_balance: true,
          currency_code: true,
          issued_at: true,
          org_customers_mst: { select: { display_name: true, name: true } },
        },
      }),
    ]);

    const customerName = (c: { display_name: string | null; name: string | null } | null) =>
      c?.display_name ?? c?.name ?? null;

    const rows: ExcessLiabilityRow[] = [
      ...wallets.map((w) => ({
        customerId: w.customer_id,
        customerName: customerName(w.org_customers_mst),
        source: EXCESS_LIABILITY_SOURCES.WALLET,
        currencyCode: w.currency_code,
        outstandingAmount: toNumber(w.balance),
        lastActivityAt: w.last_activity_at?.toISOString() ?? null,
      })),
      ...advances.map((a) => ({
        customerId: a.customer_id,
        customerName: customerName(a.org_customers_mst),
        source: EXCESS_LIABILITY_SOURCES.ADVANCE,
        currencyCode: a.currency_code,
        outstandingAmount: toNumber(a.balance),
        lastActivityAt: a.last_activity_at?.toISOString() ?? null,
      })),
      ...creditNotes.map((cn) => ({
        customerId: cn.customer_id,
        customerName: customerName(cn.org_customers_mst),
        source: EXCESS_LIABILITY_SOURCES.CREDIT_NOTE,
        currencyCode: cn.currency_code,
        outstandingAmount: toNumber(cn.remaining_balance),
        lastActivityAt: cn.issued_at?.toISOString() ?? null,
      })),
    ];

    rows.sort((a, b) => b.outstandingAmount - a.outstandingAmount);

    const walletTotal = rows
      .filter((r) => r.source === EXCESS_LIABILITY_SOURCES.WALLET)
      .reduce((s, r) => s + r.outstandingAmount, 0);
    const advanceTotal = rows
      .filter((r) => r.source === EXCESS_LIABILITY_SOURCES.ADVANCE)
      .reduce((s, r) => s + r.outstandingAmount, 0);
    const creditNoteTotal = rows
      .filter((r) => r.source === EXCESS_LIABILITY_SOURCES.CREDIT_NOTE)
      .reduce((s, r) => s + r.outstandingAmount, 0);

    return {
      rows,
      summary: {
        totalOutstanding: walletTotal + advanceTotal + creditNoteTotal,
        walletTotal,
        advanceTotal,
        creditNoteTotal,
        rowCount: rows.length,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. B2B statement payment reconciliation
// ─────────────────────────────────────────────────────────────────────────────

interface B2bReconRaw {
  statement_id: string;
  statement_no: string;
  customer_id: string;
  currency_cd: string | null;
  status_cd: string | null;
  total_amount: number;
  header_paid: number;
  balance_amount: number;
  detail_paid: number;
  detail_count: number;
}

/**
 * Per B2B statement, compare the header `paid_amount` against the sum of applied
 * rows in `org_b2b_statement_payments_dtl` (mig 0380). A non-zero delta means the
 * statement balance and its payment audit trail diverged — the exact class of
 * drift the F-04 detail table was added to make detectable.
 *
 * @param filter tenant scope + optional `created_at` window on the statement.
 */
export async function getB2bStatementReconReport(
  filter: ReconReportFilter,
): Promise<B2bStatementReconReport> {
  const { tenantOrgId, from, to } = filter;

  return withTenantContext(tenantOrgId, async () => {
    const conds = [
      Prisma.sql`s.tenant_org_id = ${tenantOrgId}::uuid`,
      Prisma.sql`s.is_active = true`,
      ...dateConds('s.created_at', from, to),
    ];

    const raw = await prisma.$queryRaw<B2bReconRaw[]>`
      SELECT
        s.id                                AS statement_id,
        s.statement_no                      AS statement_no,
        s.customer_id                       AS customer_id,
        s.currency_cd                       AS currency_cd,
        s.status_cd                         AS status_cd,
        COALESCE(s.total_amount, 0)::float8 AS total_amount,
        COALESCE(s.paid_amount, 0)::float8  AS header_paid,
        COALESCE(s.balance_amount, 0)::float8 AS balance_amount,
        COALESCE(d.detail_paid, 0)::float8  AS detail_paid,
        COALESCE(d.detail_count, 0)::int    AS detail_count
      FROM org_b2b_statements_mst s
      LEFT JOIN (
        SELECT statement_id,
               SUM(amount) AS detail_paid,
               COUNT(*)    AS detail_count
        FROM org_b2b_statement_payments_dtl
        WHERE tenant_org_id = ${tenantOrgId}::uuid AND is_active = true
        GROUP BY statement_id
      ) d ON d.statement_id = s.id
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY s.created_at DESC NULLS LAST`;

    const rows: B2bStatementReconRow[] = raw.map((r) => {
      const delta = r.header_paid - r.detail_paid;
      return {
        statementId: r.statement_id,
        statementNo: r.statement_no,
        customerId: r.customer_id,
        currencyCode: r.currency_cd,
        statusCode: r.status_cd,
        totalAmount: r.total_amount,
        headerPaidAmount: r.header_paid,
        balanceAmount: r.balance_amount,
        detailPaidAmount: r.detail_paid,
        delta,
        isReconciled: Math.abs(delta) < RECON_REPORT_EPSILON,
        detailRowCount: r.detail_count,
      };
    });

    const exceptions = rows.filter((r) => !r.isReconciled);

    return {
      rows,
      summary: {
        statementCount: rows.length,
        exceptionCount: exceptions.length,
        totalHeaderPaid: rows.reduce((s, r) => s + r.headerPaidAmount, 0),
        totalDetailPaid: rows.reduce((s, r) => s + r.detailPaidAmount, 0),
        totalDelta: rows.reduce((s, r) => s + r.delta, 0),
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Overpayment disposition reconciliation
// ─────────────────────────────────────────────────────────────────────────────

interface OverpayReconRaw {
  resolution_code: string;
  currency_code: string | null;
  cnt: number;
  total_amount: number;
  posted_count: number;
  posted_amount: number;
  orphan_count: number;
  orphan_amount: number;
}

/**
 * Group `org_fin_overpay_disp_dtl` (mig 0354) by resolution code + currency, and
 * split each group into posted (carries a `voucher_trx_line_id` — the
 * authoritative BVM posting) vs orphan (no voucher line). Orphan rows are audit
 * entries whose money was never tied to a voucher leg — the reconciliation
 * exceptions for this report.
 *
 * @param filter tenant scope + optional branch + `created_at` window.
 */
export async function getOverpaymentDispositionReconReport(
  filter: ReconReportFilter,
): Promise<OverpaymentDispositionReconReport> {
  const { tenantOrgId, from, to, branchId } = filter;

  return withTenantContext(tenantOrgId, async () => {
    const conds = [
      Prisma.sql`tenant_org_id = ${tenantOrgId}::uuid`,
      Prisma.sql`is_active = true`,
      ...(branchId ? [Prisma.sql`branch_id = ${branchId}::uuid`] : []),
      ...dateConds('created_at', from, to),
    ];

    const raw = await prisma.$queryRaw<OverpayReconRaw[]>`
      SELECT
        resolution_code                       AS resolution_code,
        currency_code                         AS currency_code,
        COUNT(*)::int                         AS cnt,
        COALESCE(SUM(amount), 0)::float8      AS total_amount,
        COALESCE(SUM(CASE WHEN voucher_trx_line_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int     AS posted_count,
        COALESCE(SUM(CASE WHEN voucher_trx_line_id IS NOT NULL THEN amount ELSE 0 END), 0)::float8 AS posted_amount,
        COALESCE(SUM(CASE WHEN voucher_trx_line_id IS NULL THEN 1 ELSE 0 END), 0)::int          AS orphan_count,
        COALESCE(SUM(CASE WHEN voucher_trx_line_id IS NULL THEN amount ELSE 0 END), 0)::float8 AS orphan_amount
      FROM org_fin_overpay_disp_dtl
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY resolution_code, currency_code
      ORDER BY total_amount DESC`;

    const rows: OverpaymentDispositionReconRow[] = raw.map((r) => ({
      resolutionCode: r.resolution_code,
      currencyCode: r.currency_code,
      count: r.cnt,
      totalAmount: r.total_amount,
      postedCount: r.posted_count,
      postedAmount: r.posted_amount,
      orphanCount: r.orphan_count,
      orphanAmount: r.orphan_amount,
    }));

    return {
      rows,
      summary: {
        totalCount: rows.reduce((s, r) => s + r.count, 0),
        totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
        orphanCount: rows.reduce((s, r) => s + r.orphanCount, 0),
        orphanAmount: rows.reduce((s, r) => s + r.orphanAmount, 0),
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cash drawer movement reconciliation
// ─────────────────────────────────────────────────────────────────────────────

interface MovementAggRaw {
  cash_drawer_session_id: string;
  net_movement: number;
  unlinked_count: number;
}

/**
 * Per cash-drawer session, recompute expected cash from movement rows
 * (opening float + Σ IN − Σ OUT) and reconcile it against the session header's
 * stored `expected_cash_amount`, surface the close-time `difference_amount`, and
 * count movements missing a `fin_voucher` backlink (cash outside the BVM trail —
 * the CASH_MOVEMENT_LINK invariant). A session is an exception when expected
 * drifts from the recomputed value, the close difference is non-zero, or any
 * movement is unlinked.
 *
 * @param filter tenant scope + optional branch + `opened_at` window.
 */
export async function getCashDrawerReconReport(
  filter: ReconReportFilter,
): Promise<CashDrawerReconReport> {
  const { tenantOrgId, from, to, branchId } = filter;

  return withTenantContext(tenantOrgId, async () => {
    const sessions = await prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        ...(branchId ? { branch_id: branchId } : {}),
        ...(dateFilter(from, to) ? { opened_at: dateFilter(from, to) } : {}),
      },
      select: {
        id: true,
        session_no: true,
        status: true,
        currency_code: true,
        opened_at: true,
        closed_at: true,
        opening_float_amount: true,
        expected_cash_amount: true,
        counted_cash_amount: true,
        difference_amount: true,
      },
      orderBy: { opened_at: 'desc' },
    });

    const sessionIds = sessions.map((s) => s.id);

    const aggMap = new Map<string, MovementAggRaw>();
    if (sessionIds.length > 0) {
      const agg = await prisma.$queryRaw<MovementAggRaw[]>`
        SELECT
          cash_drawer_session_id AS cash_drawer_session_id,
          COALESCE(SUM(
            CASE
              WHEN direction = ${MOVEMENT_DIRECTIONS.IN}  THEN amount
              WHEN direction = ${MOVEMENT_DIRECTIONS.OUT} THEN -amount
              ELSE 0
            END
          ), 0)::float8 AS net_movement,
          COALESCE(SUM(
            CASE WHEN fin_voucher_id IS NULL OR fin_voucher_trx_line_id IS NULL THEN 1 ELSE 0 END
          ), 0)::int AS unlinked_count
        FROM org_cash_drawer_movements_dtl
        WHERE tenant_org_id = ${tenantOrgId}::uuid
          AND is_active = true
          AND cash_drawer_session_id = ANY(${sessionIds}::uuid[])
        GROUP BY cash_drawer_session_id`;
      for (const a of agg) aggMap.set(a.cash_drawer_session_id, a);
    }

    const rows: CashDrawerReconRow[] = sessions.map((s) => {
      const agg = aggMap.get(s.id);
      const openingFloat = toNumber(s.opening_float_amount);
      const netMovement = agg ? agg.net_movement : 0;
      const computedExpected = openingFloat + netMovement;
      const headerExpected = toNumber(s.expected_cash_amount);
      const expectedDelta = computedExpected - headerExpected;
      const difference = s.difference_amount == null ? null : toNumber(s.difference_amount);
      const unlinked = agg ? agg.unlinked_count : 0;

      const isReconciled =
        Math.abs(expectedDelta) < RECON_REPORT_EPSILON &&
        (difference == null || Math.abs(difference) < RECON_REPORT_EPSILON) &&
        unlinked === 0;

      return {
        sessionId: s.id,
        sessionNo: s.session_no,
        status: s.status,
        currencyCode: s.currency_code,
        openedAt: s.opened_at.toISOString(),
        closedAt: s.closed_at?.toISOString() ?? null,
        openingFloatAmount: openingFloat,
        netMovementAmount: netMovement,
        computedExpectedAmount: computedExpected,
        headerExpectedAmount: headerExpected,
        countedCashAmount: s.counted_cash_amount == null ? null : toNumber(s.counted_cash_amount),
        differenceAmount: difference,
        expectedDelta,
        unlinkedMovementCount: unlinked,
        isReconciled,
      };
    });

    const exceptions = rows.filter((r) => !r.isReconciled);

    return {
      rows,
      summary: {
        sessionCount: rows.length,
        exceptionCount: exceptions.length,
        totalDifference: rows.reduce((s, r) => s + (r.differenceAmount ?? 0), 0),
        totalUnlinkedMovements: rows.reduce((s, r) => s + r.unlinkedMovementCount, 0),
      },
    };
  });
}
