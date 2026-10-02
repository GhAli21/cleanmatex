import 'server-only';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { CASH_DRAWER_SESSION_STATUSES, DRAWER_TYPES } from '@/lib/constants/cash-drawer';

/**
 * Follow-up list (§4B.7 `GET /api/v1/cash-drawers/follow-up`, CLF-8-9): closed
 * sessions whose close disposition moved cash into a `PENDING_DEPOSIT`
 * drawer — the operational worklist for "has this cash actually reached the
 * bank yet" (`post_close_status_code`).
 */

export interface FollowUpListFilter {
  postCloseStatusCode?: string;
  page: number;
  pageSize: number;
}

export interface FollowUpSessionRow {
  sessionId: string;
  sessionNo: string;
  drawerId: string;
  drawerName: string | null;
  branchId: string;
  branchName: string | null;
  closedAt: Date | null;
  postCloseStatusCode: string | null;
  postCloseNotes: string | null;
  pendingDepositAmounts: Array<{ currencyCode: string; amount: string }>;
}

export interface FollowUpPage {
  rows: FollowUpSessionRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function listFollowUpSessions(tenantOrgId: string, filter: FollowUpListFilter): Promise<FollowUpPage> {
  return withTenantContext(tenantOrgId, async () => {
    const pendingDepositDrawers = await prisma.org_cash_drawers_mst.findMany({
      where: { tenant_org_id: tenantOrgId, drawer_type: DRAWER_TYPES.PENDING_DEPOSIT },
      select: { id: true },
    });
    const pdDrawerIds = pendingDepositDrawers.map((d) => d.id);
    if (pdDrawerIds.length === 0) {
      return { rows: [], totalCount: 0, page: filter.page, pageSize: filter.pageSize };
    }

    const balRows = await prisma.org_cash_drawer_ses_bal_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, disposition_dest_drawer_id: { in: pdDrawerIds } },
      select: { cash_drawer_session_id: true, currency_code: true, closing_basis: true, disposition_kept_amount: true },
    });
    const sessionIds = [...new Set(balRows.map((r) => r.cash_drawer_session_id))];
    if (sessionIds.length === 0) {
      return { rows: [], totalCount: 0, page: filter.page, pageSize: filter.pageSize };
    }

    const where = {
      tenant_org_id: tenantOrgId,
      id: { in: sessionIds },
      status: { in: [CASH_DRAWER_SESSION_STATUSES.CLOSED, CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED] },
      ...(filter.postCloseStatusCode ? { post_close_status_code: filter.postCloseStatusCode } : {}),
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
          post_close_status_code: true,
          post_close_notes: true,
        },
      }),
      prisma.org_cash_drawer_sessions_mst.count({ where }),
    ]);

    const drawerIds = [...new Set(sessions.map((s) => s.cash_drawer_id))];
    const branchIds = [...new Set(sessions.map((s) => s.branch_id).filter((id): id is string => Boolean(id)))];
    const [drawers, branches] = await Promise.all([
      drawerIds.length
        ? prisma.org_cash_drawers_mst.findMany({
            where: { tenant_org_id: tenantOrgId, id: { in: drawerIds } },
            select: { id: true, drawer_name: true },
          })
        : Promise.resolve([]),
      branchIds.length
        ? prisma.org_branches_mst.findMany({
            where: { tenant_org_id: tenantOrgId, id: { in: branchIds } },
            select: { id: true, branch_name: true },
          })
        : Promise.resolve([]),
    ]);
    const drawerNameById = new Map(drawers.map((d) => [d.id, d.drawer_name]));
    const branchNameById = new Map(branches.map((b) => [b.id, b.branch_name]));

    const balBySession = new Map<string, typeof balRows>();
    for (const r of balRows) {
      balBySession.set(r.cash_drawer_session_id, [...(balBySession.get(r.cash_drawer_session_id) ?? []), r]);
    }

    return {
      rows: sessions.map((s) => ({
        sessionId: s.id,
        sessionNo: s.session_no,
        drawerId: s.cash_drawer_id,
        drawerName: drawerNameById.get(s.cash_drawer_id) ?? null,
        branchId: s.branch_id,
        branchName: s.branch_id ? branchNameById.get(s.branch_id) ?? null : null,
        closedAt: s.closed_at,
        postCloseStatusCode: s.post_close_status_code,
        postCloseNotes: s.post_close_notes,
        pendingDepositAmounts: (balBySession.get(s.id) ?? []).map((r) => {
          const basis = r.closing_basis ? new Decimal(r.closing_basis.toString()) : new Decimal(0);
          const kept = r.disposition_kept_amount ? new Decimal(r.disposition_kept_amount.toString()) : new Decimal(0);
          return { currencyCode: r.currency_code, amount: basis.minus(kept).toFixed(4) };
        }),
      })),
      totalCount,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  });
}
