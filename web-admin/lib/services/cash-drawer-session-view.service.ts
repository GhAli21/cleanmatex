import 'server-only';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 * Read model for the session-detail "closure" section (CLF-8-8): per-currency
 * balances, the session's counts (with denomination breakdown), disposition,
 * and the post-close status + change log. Pure reads — all mutation stays in
 * `cash-drawer-session.service.ts`.
 */

export interface SessionClosureBalance {
  currencyCode: string;
  openingExpected: string;
  openingCounted: string | null;
  openingVariance: string | null;
  finIn: string;
  finOut: string;
  trxIn: string;
  trxOut: string;
  closingExpected: string | null;
  closingCounted: string | null;
  closingVariance: string | null;
  dispositionCode: string | null;
  dispositionNotes: string | null;
  dispositionDestDrawerId: string | null;
  dispositionDestDrawerName: string | null;
  dispositionKeptAmount: string | null;
}

export interface SessionClosureCount {
  countId: string;
  countType: string;
  countMethod: string;
  currencyCode: string;
  expectedAmount: string;
  countedAmount: string;
  varianceAmount: string;
  countedBy: string;
  countedAt: Date;
  notes: string | null;
  supersedesCountId: string | null;
  denominations: Array<{ valueMinor: number; quantity: number; lineAmount: string }>;
}

export interface SessionClosureView {
  sessionId: string;
  status: string;
  balances: SessionClosureBalance[];
  counts: SessionClosureCount[];
  postClose: {
    statusCode: string | null;
    notes: string | null;
    by: string | null;
    at: Date | null;
    history: Array<{ statusCode: string; notes: string | null; changedBy: string | null; changedAt: Date | null }>;
  };
}

const dec = (v: { toString(): string }) => new Decimal(v.toString()).toFixed(4);
const decOrNull = (v: { toString(): string } | null) => (v === null ? null : dec(v));

/**
 * Loads the closure view of one session.
 * @param tenantOrgId tenant scope
 * @param drawerId drawer the session must belong to
 * @param sessionId session to read
 * @returns the closure view, or `null` when the session is not found for this tenant/drawer
 */
export async function getSessionClosureView(
  tenantOrgId: string,
  drawerId: string,
  sessionId: string,
): Promise<SessionClosureView | null> {
  return withTenantContext(tenantOrgId, async () => {
    const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantOrgId, cash_drawer_id: drawerId },
      select: {
        id: true,
        status: true,
        post_close_status_code: true,
        post_close_notes: true,
        post_close_by: true,
        post_close_at: true,
      },
    });
    if (!session) return null;

    const [balances, counts, history] = await Promise.all([
      prisma.org_cash_drawer_ses_bal_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: sessionId },
        orderBy: { currency_code: 'asc' },
      }),
      prisma.org_cash_drawer_cnt_mst.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: sessionId },
        orderBy: { counted_at: 'asc' },
      }),
      prisma.org_cash_drawer_ses_post_tr.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: sessionId },
        orderBy: { changed_at: 'desc' },
        select: { post_close_status_code: true, post_close_notes: true, changed_by: true, changed_at: true },
      }),
    ]);

    const destIds = [...new Set(balances.map((b) => b.disposition_dest_drawer_id).filter((id): id is string => Boolean(id)))];
    const countIds = counts.map((c) => c.id);
    const [destDrawers, denomRows] = await Promise.all([
      destIds.length
        ? prisma.org_cash_drawers_mst.findMany({
            where: { tenant_org_id: tenantOrgId, id: { in: destIds } },
            select: { id: true, drawer_name: true },
          })
        : Promise.resolve([]),
      countIds.length
        ? prisma.org_cash_drawer_cnt_denom_dtl.findMany({
            where: { tenant_org_id: tenantOrgId, count_id: { in: countIds } },
            orderBy: { denom_value_minor_snap: 'desc' },
            select: { count_id: true, denom_value_minor_snap: true, quantity: true, line_amount: true },
          })
        : Promise.resolve([]),
    ]);
    const destNameById = new Map(destDrawers.map((d) => [d.id, d.drawer_name]));

    return {
      sessionId: session.id,
      status: session.status,
      balances: balances.map((b) => ({
        currencyCode: b.currency_code,
        openingExpected: dec(b.opening_expected),
        openingCounted: decOrNull(b.opening_counted),
        openingVariance: decOrNull(b.opening_variance),
        finIn: dec(b.fin_in),
        finOut: dec(b.fin_out),
        trxIn: dec(b.trx_in),
        trxOut: dec(b.trx_out),
        closingExpected: decOrNull(b.closing_expected),
        closingCounted: decOrNull(b.closing_counted),
        closingVariance: decOrNull(b.closing_variance),
        dispositionCode: b.disposition_code,
        dispositionNotes: b.disposition_notes,
        dispositionDestDrawerId: b.disposition_dest_drawer_id,
        dispositionDestDrawerName: b.disposition_dest_drawer_id ? destNameById.get(b.disposition_dest_drawer_id) ?? null : null,
        dispositionKeptAmount: decOrNull(b.disposition_kept_amount),
      })),
      counts: counts.map((c) => ({
        countId: c.id,
        countType: c.count_type,
        countMethod: c.count_method,
        currencyCode: c.currency_code,
        expectedAmount: dec(c.expected_amount),
        countedAmount: dec(c.counted_amount),
        varianceAmount: dec(c.variance_amount),
        countedBy: c.counted_by,
        countedAt: c.counted_at,
        notes: c.notes,
        supersedesCountId: c.supersedes_count_id,
        denominations: denomRows
          .filter((d) => d.count_id === c.id)
          .map((d) => ({ valueMinor: d.denom_value_minor_snap, quantity: d.quantity, lineAmount: dec(d.line_amount) })),
      })),
      postClose: {
        statusCode: session.post_close_status_code,
        notes: session.post_close_notes,
        by: session.post_close_by,
        at: session.post_close_at,
        history: history.map((h) => ({
          statusCode: h.post_close_status_code,
          notes: h.post_close_notes,
          changedBy: h.changed_by,
          changedAt: h.changed_at,
        })),
      },
    };
  });
}
