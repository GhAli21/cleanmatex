import 'server-only';

import { Prisma } from '@prisma/client';

import type { prisma } from '@/lib/db/prisma';
import { CASH_EFFECTS } from '@/lib/constants/cash-drawer';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Per-POS-session cash attribution inside one drawer session (E2): when several cashiers share a
 * drawer session (shared_session_mode = SHARED), this says who took and paid out how much, so the
 * drawer's variance can be traced to a shift. Cash lines that carry no POS session (a deferred
 * posting, a manual voucher) come back as one "unattributed" row (`posSessionId = null`) — never
 * silently folded into a cashier. Money is an exact decimal string straight from the database.
 */
export interface DrawerCashAttributionRow {
  /** Null = cash that no POS session was attached to. */
  posSessionId: string | null;
  posSessionNo: string | null;
  operatorUserId: string | null;
  operatorName: string | null;
  currencyCode: string;
  cashIn: string;
  cashOut: string;
  /** cashIn − cashOut. */
  net: string;
  lineCount: number;
}

/**
 * Loads the cash taken and paid out in a drawer session, grouped by POS session and currency.
 * Counts only lines that actually hit the drawer ledger (`cash_effect_code = DRAWER`).
 *
 * @param db Prisma client or transaction
 * @param tenantId tenant (explicitly filtered)
 * @param drawerSessionId the drawer session
 * @returns one row per POS session (or unattributed) and currency, biggest absolute net first
 */
export async function loadDrawerCashAttribution(
  db: Pick<PrismaTx, '$queryRaw'>,
  tenantId: string,
  drawerSessionId: string,
): Promise<DrawerCashAttributionRow[]> {
  const rows = await db.$queryRaw<
    Array<{
      pos_session_id: string | null;
      session_no: string | null;
      operator_user_id: string | null;
      operator_name: string | null;
      currency_code: string;
      cash_in: string;
      cash_out: string;
      net: string;
      line_count: number;
    }>
  >(Prisma.sql`
    SELECT l.pos_session_id,
           ps.session_no,
           ps.user_id AS operator_user_id,
           COALESCE(u.display_name, u.name, u.email) AS operator_name,
           l.currency_code,
           COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'IN'), 0)::text  AS cash_in,
           COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'OUT'), 0)::text AS cash_out,
           COALESCE(SUM(CASE l.direction WHEN 'IN' THEN l.amount WHEN 'OUT' THEN -l.amount ELSE 0 END), 0)::text AS net,
           COUNT(*)::int AS line_count
    FROM public.org_fin_voucher_trx_lines_dtl l
    LEFT JOIN public.org_pos_sessions_mst ps
      ON ps.tenant_org_id = l.tenant_org_id AND ps.id = l.pos_session_id
    LEFT JOIN public.org_users_mst u
      ON u.tenant_org_id = ps.tenant_org_id AND u.user_id = ps.user_id
    WHERE l.tenant_org_id = ${tenantId}::uuid
      AND l.cash_drawer_session_id = ${drawerSessionId}::uuid
      AND l.is_active = TRUE
      AND l.cash_effect_code = ${CASH_EFFECTS.DRAWER}
    GROUP BY l.pos_session_id, ps.session_no, ps.user_id, u.display_name, u.name, u.email, l.currency_code
    ORDER BY ABS(SUM(CASE l.direction WHEN 'IN' THEN l.amount WHEN 'OUT' THEN -l.amount ELSE 0 END)) DESC,
             ps.session_no NULLS LAST, l.currency_code
  `);

  return rows.map((r) => ({
    posSessionId: r.pos_session_id,
    posSessionNo: r.session_no,
    operatorUserId: r.operator_user_id,
    operatorName: r.operator_name,
    currencyCode: r.currency_code,
    cashIn: r.cash_in,
    cashOut: r.cash_out,
    net: r.net,
    lineCount: r.line_count,
  }));
}
