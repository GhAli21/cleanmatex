import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { toMoneyString } from '@/lib/utils/money';
import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer';

/**
 * Cash variance by cashier (C4): for a date range, how each cashier's closed drawer sessions came
 * out — how many, the total / mean / absolute variance, and whether the errors lean towards
 * shortage or overage. Variances of different currencies are never added together, so the report
 * is grouped by cashier AND currency. "Cashier" is the user who opened the drawer session; the
 * date is the session's close date in the tenant's timezone.
 */

export interface VarianceByCashierFilter {
  /** Inclusive close-date range, `YYYY-MM-DD`, in the tenant timezone. */
  dateFrom: string;
  dateTo: string;
  /** Narrow to one cashier (drawer-session opener). */
  cashierId?: string;
}

export interface VarianceByCashierRow {
  cashierId: string | null;
  cashierName: string | null;
  currencyCode: string;
  sessionCount: number;
  /** Sessions that closed exactly on the expected cash. */
  balancedCount: number;
  shortageCount: number;
  overageCount: number;
  /** Signed sum: negative = net shortage. */
  totalVariance: string;
  meanVariance: string;
  /** Sum of absolute variances: how wrong the counts were, regardless of direction. */
  absoluteVariance: string;
  shortageTotal: string;
  overageTotal: string;
  /** Most negative single-session variance (0 when none). */
  largestShortage: string;
  largestOverage: string;
  /** Shortage sessions / sessions with any variance: 1 = always short, 0 = always over; null when every session balanced. */
  shortageShare: number | null;
  /** Sessions over their threshold that a supervisor has not decided yet. */
  pendingDecisionCount: number;
  /** Sessions whose variance a supervisor rejected (under investigation). */
  rejectedCount: number;
}

export interface VarianceByCashierReport {
  filter: VarianceByCashierFilter;
  rows: VarianceByCashierRow[];
}

interface RawRow {
  cashier_id: string | null;
  currency_code: string;
  session_count: number;
  balanced_count: number;
  shortage_count: number;
  overage_count: number;
  total_variance: string;
  mean_variance: string;
  absolute_variance: string;
  shortage_total: string;
  overage_total: string;
  largest_shortage: string;
  largest_overage: string;
  pending_count: number;
  rejected_count: number;
}

/**
 * Builds the per-cashier, per-currency variance report.
 *
 * @param tenantOrgId tenant (explicitly filtered in every query)
 * @param filter close-date range and optional cashier
 * @param scopeBranchIds the actor's permitted branches; undefined = all branches, empty = nothing
 * @returns one row per cashier and currency, largest absolute net variance first
 */
export async function getVarianceByCashierReport(
  tenantOrgId: string,
  filter: VarianceByCashierFilter,
  scopeBranchIds?: readonly string[],
): Promise<VarianceByCashierReport> {
  if (scopeBranchIds && scopeBranchIds.length === 0) return { filter, rows: [] };

  return withTenantContext(tenantOrgId, async () => {
    const branchSql = scopeBranchIds
      ? Prisma.sql`AND s.branch_id IN (${Prisma.join([...scopeBranchIds].map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.empty;
    const cashierSql = filter.cashierId ? Prisma.sql`AND s.opened_by = ${filter.cashierId}::uuid` : Prisma.empty;

    const raw = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        s.opened_by AS cashier_id,
        b.currency_code,
        COUNT(*)::int AS session_count,
        COUNT(*) FILTER (WHERE b.closing_variance = 0)::int AS balanced_count,
        COUNT(*) FILTER (WHERE b.closing_variance < 0)::int AS shortage_count,
        COUNT(*) FILTER (WHERE b.closing_variance > 0)::int AS overage_count,
        COALESCE(SUM(b.closing_variance), 0)::text AS total_variance,
        COALESCE(AVG(b.closing_variance), 0)::text AS mean_variance,
        COALESCE(SUM(ABS(b.closing_variance)), 0)::text AS absolute_variance,
        COALESCE(SUM(b.closing_variance) FILTER (WHERE b.closing_variance < 0), 0)::text AS shortage_total,
        COALESCE(SUM(b.closing_variance) FILTER (WHERE b.closing_variance > 0), 0)::text AS overage_total,
        COALESCE(MIN(b.closing_variance) FILTER (WHERE b.closing_variance < 0), 0)::text AS largest_shortage,
        COALESCE(MAX(b.closing_variance) FILTER (WHERE b.closing_variance > 0), 0)::text AS largest_overage,
        COUNT(*) FILTER (
          WHERE s.variance_threshold_snapshot IS NOT NULL
            AND s.variance_approved_by IS NULL AND s.variance_rejected_by IS NULL
        )::int AS pending_count,
        COUNT(*) FILTER (WHERE s.variance_rejected_by IS NOT NULL)::int AS rejected_count
      FROM public.org_cash_drawer_sessions_mst s
      JOIN public.org_tenants_mst t
        ON t.id = s.tenant_org_id
      JOIN public.org_cash_drawer_ses_bal_dtl b
        ON b.tenant_org_id = s.tenant_org_id
       AND b.cash_drawer_session_id = s.id
       AND b.is_active = TRUE
      WHERE s.tenant_org_id = ${tenantOrgId}::uuid
        AND s.status IN (${CASH_DRAWER_SESSION_STATUSES.CLOSED}, ${CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED})
        AND s.closed_at IS NOT NULL
        AND b.closing_variance IS NOT NULL
        AND (s.closed_at AT TIME ZONE t.timezone)::date BETWEEN ${filter.dateFrom}::date AND ${filter.dateTo}::date
        ${branchSql}
        ${cashierSql}
      GROUP BY s.opened_by, b.currency_code
      ORDER BY ABS(SUM(b.closing_variance)) DESC, s.opened_by, b.currency_code
    `);

    const cashierIds = [...new Set(raw.map((r) => r.cashier_id).filter((id): id is string => Boolean(id)))];
    const users = cashierIds.length
      ? await prisma.org_users_mst.findMany({
          where: { tenant_org_id: tenantOrgId, user_id: { in: cashierIds } },
          select: { user_id: true, display_name: true, name: true, email: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.user_id, u.display_name ?? u.name ?? u.email ?? null]));

    const rows: VarianceByCashierRow[] = raw.map((r) => {
      const withVariance = r.shortage_count + r.overage_count;
      return {
        cashierId: r.cashier_id,
        cashierName: r.cashier_id ? (nameById.get(r.cashier_id) ?? null) : null,
        currencyCode: r.currency_code,
        sessionCount: r.session_count,
        balancedCount: r.balanced_count,
        shortageCount: r.shortage_count,
        overageCount: r.overage_count,
        totalVariance: toMoneyString(r.total_variance),
        meanVariance: toMoneyString(r.mean_variance),
        absoluteVariance: toMoneyString(r.absolute_variance),
        shortageTotal: toMoneyString(r.shortage_total),
        overageTotal: toMoneyString(r.overage_total),
        largestShortage: toMoneyString(r.largest_shortage),
        largestOverage: toMoneyString(r.largest_overage),
        shortageShare: withVariance === 0 ? null : r.shortage_count / withVariance,
        pendingDecisionCount: r.pending_count,
        rejectedCount: r.rejected_count,
      };
    });

    return { filter, rows };
  });
}
