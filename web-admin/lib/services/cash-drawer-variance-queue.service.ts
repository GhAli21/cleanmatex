import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { toMoneyString } from '@/lib/utils/money';
import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer';

/**
 * Variance decision queue (C3): closed drawer sessions whose closing variance tripped their
 * threshold, with the supervisor's decision — pending approval, approved, or rejected. The
 * supervisor works the PENDING list; REJECTED is the investigation list.
 */

export const VARIANCE_QUEUE_DECISION = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  /** Every session that tripped a threshold, decided or not. */
  ALL: 'ALL',
} as const;

export type VarianceQueueDecision = (typeof VARIANCE_QUEUE_DECISION)[keyof typeof VARIANCE_QUEUE_DECISION];

export interface VarianceQueueFilter {
  decision: VarianceQueueDecision;
  page: number;
  pageSize: number;
}

export interface VarianceQueueCurrencyRow {
  currencyCode: string;
  closingExpected: string | null;
  closingCounted: string | null;
  closingVariance: string | null;
}

export interface VarianceQueueRow {
  sessionId: string;
  sessionNo: string;
  drawerId: string;
  drawerName: string | null;
  branchId: string;
  branchName: string | null;
  closedAt: string | null;
  closedById: string | null;
  closedByName: string | null;
  thresholdSnapshot: string;
  decision: Exclude<VarianceQueueDecision, 'ALL'>;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  currencies: VarianceQueueCurrencyRow[];
}

export interface VarianceQueuePage {
  rows: VarianceQueueRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Lists the variance decision queue for the actor's branches, newest close first.
 *
 * @param tenantOrgId tenant (explicitly filtered in every query)
 * @param filter decision filter and paging
 * @param scopeBranchIds the actor's permitted branches; undefined = all branches, empty = nothing
 * @returns one page of queue rows with per-currency figures and the decision
 */
export async function listVarianceDecisionQueue(
  tenantOrgId: string,
  filter: VarianceQueueFilter,
  scopeBranchIds?: readonly string[],
): Promise<VarianceQueuePage> {
  if (scopeBranchIds && scopeBranchIds.length === 0) {
    return { rows: [], totalCount: 0, page: filter.page, pageSize: filter.pageSize };
  }

  return withTenantContext(tenantOrgId, async () => {
    const decisionWhere =
      filter.decision === VARIANCE_QUEUE_DECISION.PENDING
        ? { variance_approved_by: null, variance_rejected_by: null }
        : filter.decision === VARIANCE_QUEUE_DECISION.APPROVED
          ? { variance_approved_by: { not: null } }
          : filter.decision === VARIANCE_QUEUE_DECISION.REJECTED
            ? { variance_rejected_by: { not: null } }
            : {};

    const where = {
      tenant_org_id: tenantOrgId,
      status: { in: [CASH_DRAWER_SESSION_STATUSES.CLOSED, CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED] },
      variance_threshold_snapshot: { not: null },
      ...decisionWhere,
      ...(scopeBranchIds ? { branch_id: { in: [...scopeBranchIds] } } : {}),
    };

    const [sessions, totalCount] = await Promise.all([
      prisma.org_cash_drawer_sessions_mst.findMany({
        where,
        orderBy: { closed_at: 'desc' },
        skip: Math.max(0, (filter.page - 1) * filter.pageSize),
        take: filter.pageSize,
        select: {
          id: true,
          session_no: true,
          cash_drawer_id: true,
          branch_id: true,
          closed_at: true,
          closed_by: true,
          variance_threshold_snapshot: true,
          variance_approved_by: true,
          variance_approved_at: true,
          variance_approval_reason: true,
          variance_rejected_by: true,
          variance_rejected_at: true,
          variance_rejection_reason: true,
        },
      }),
      prisma.org_cash_drawer_sessions_mst.count({ where }),
    ]);

    if (sessions.length === 0) {
      return { rows: [], totalCount, page: filter.page, pageSize: filter.pageSize };
    }

    const sessionIds = sessions.map((s) => s.id);
    const drawerIds = [...new Set(sessions.map((s) => s.cash_drawer_id))];
    const branchIds = [...new Set(sessions.map((s) => s.branch_id))];
    const userIds = [
      ...new Set(
        sessions
          .flatMap((s) => [s.closed_by, s.variance_approved_by, s.variance_rejected_by])
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [balances, drawers, branches, users] = await Promise.all([
      prisma.org_cash_drawer_ses_bal_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: { in: sessionIds }, is_active: true },
        orderBy: { currency_code: 'asc' },
        select: {
          cash_drawer_session_id: true,
          currency_code: true,
          closing_expected: true,
          closing_counted: true,
          closing_variance: true,
        },
      }),
      prisma.org_cash_drawers_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: drawerIds } },
        select: { id: true, drawer_name: true },
      }),
      prisma.org_branches_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: branchIds } },
        select: { id: true, branch_name: true },
      }),
      userIds.length
        ? prisma.org_users_mst.findMany({
            where: { tenant_org_id: tenantOrgId, user_id: { in: userIds } },
            select: { user_id: true, display_name: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const drawerName = new Map(drawers.map((d) => [d.id, d.drawer_name]));
    const branchName = new Map(branches.map((b) => [b.id, b.branch_name]));
    const userName = new Map(users.map((u) => [u.user_id, u.display_name ?? u.name ?? u.email ?? null]));
    const money = (value: { toString(): string } | null) => (value == null ? null : toMoneyString(value.toString()));

    const bySession = new Map<string, VarianceQueueCurrencyRow[]>();
    for (const b of balances) {
      const list = bySession.get(b.cash_drawer_session_id) ?? [];
      list.push({
        currencyCode: b.currency_code,
        closingExpected: money(b.closing_expected),
        closingCounted: money(b.closing_counted),
        closingVariance: money(b.closing_variance),
      });
      bySession.set(b.cash_drawer_session_id, list);
    }

    const rows: VarianceQueueRow[] = sessions.map((s) => {
      const rejected = s.variance_rejected_by != null;
      const approved = s.variance_approved_by != null;
      const decidedById = rejected ? s.variance_rejected_by : s.variance_approved_by;
      return {
        sessionId: s.id,
        sessionNo: s.session_no,
        drawerId: s.cash_drawer_id,
        drawerName: drawerName.get(s.cash_drawer_id) ?? null,
        branchId: s.branch_id,
        branchName: branchName.get(s.branch_id) ?? null,
        closedAt: s.closed_at ? s.closed_at.toISOString() : null,
        closedById: s.closed_by,
        closedByName: s.closed_by ? (userName.get(s.closed_by) ?? null) : null,
        thresholdSnapshot: toMoneyString(s.variance_threshold_snapshot!.toString()),
        decision: rejected
          ? VARIANCE_QUEUE_DECISION.REJECTED
          : approved
            ? VARIANCE_QUEUE_DECISION.APPROVED
            : VARIANCE_QUEUE_DECISION.PENDING,
        decidedById,
        decidedByName: decidedById ? (userName.get(decidedById) ?? null) : null,
        decidedAt: (rejected ? s.variance_rejected_at : s.variance_approved_at)?.toISOString() ?? null,
        decisionReason: rejected ? s.variance_rejection_reason : s.variance_approval_reason,
        currencies: bySession.get(s.id) ?? [],
      };
    });

    return { rows, totalCount, page: filter.page, pageSize: filter.pageSize };
  });
}
