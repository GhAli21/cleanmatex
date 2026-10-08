import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type {
  PosShiftZArchivePage,
  PosShiftZArchiveRow,
  PosShiftZArchiveVariance,
} from '@/lib/types/pos-shift-report';
import type { PosSessionCurrencyTotal } from '@/lib/types/pos-session';

export const Z_ARCHIVE_MAX_PAGE_SIZE = 100;

export interface ListShiftZReportsInput {
  tenantId: string;
  /** The acting user; their own shifts are always listed even outside their branch scope. */
  userId: string;
  /** May the actor see other operators' shifts (`pos_session:view_all`)? */
  canViewAll: boolean;
  /**
   * Branch scope (B3): other operators' shifts are limited to these branches. `undefined` = every
   * branch; an empty list = own shifts only.
   */
  branchIds?: readonly string[];
  page: number;
  pageSize: number;
  branchId?: string | null;
  operatorUserId?: string | null;
  /** Inclusive business-date bounds, `YYYY-MM-DD`. */
  businessDateFrom?: string | null;
  businessDateTo?: string | null;
  /** Matches the report number, the POS session number or the operator name. */
  query?: string | null;
}

interface ArchiveDbRow {
  id: string;
  report_no: string;
  pos_session_id: string;
  session_no: string | null;
  branch_id: string;
  branch_name: string | null;
  operator_user_id: string;
  operator_name: string | null;
  business_date: Date | string;
  business_timezone: string;
  session_opened_at: Date | string;
  session_closed_at: Date | string;
  generated_at: Date | string;
  auto_close_reason: string | null;
  sales: PosSessionCurrencyTotal[] | null;
  drawer_balances: Array<{ currencyCode: string; closingVariance: string | null }> | null;
  variance_pending: boolean | null;
  hash_ok: boolean;
  total: bigint | number;
}

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : String(value));
const dateOnly = (value: Date | string): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/** Escapes LIKE wildcards so a search term is matched literally. */
const likeTerm = (term: string): string => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Lists frozen Z-reports (the Z archive), newest business day first.
 *
 * Reads the headline figures straight from the stored snapshot in SQL so a page never ships whole
 * snapshots. Visibility follows the POS-session list: your own shifts, plus other operators' when
 * you hold `pos_session:view_all` and the shift is in your branch scope. The integrity flag is
 * recomputed per row (SHA-256 of the stored snapshot against the stored hash).
 *
 * @param input tenant, actor, scope, filters and paging
 * @returns one page of archive rows and the unpaged total
 */
export async function listShiftZReports(input: ListShiftZReportsInput): Promise<PosShiftZArchivePage> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), Z_ARCHIVE_MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const ownOnlySql = input.canViewAll ? Prisma.empty : Prisma.sql`AND z.operator_user_id = ${input.userId}::uuid`;
  const branchScopeSql = input.branchIds
    ? Prisma.sql`AND (z.operator_user_id = ${input.userId}::uuid OR z.branch_id = ANY(${[...input.branchIds]}::uuid[]))`
    : Prisma.empty;
  const branchSql = input.branchId ? Prisma.sql`AND z.branch_id = ${input.branchId}::uuid` : Prisma.empty;
  const operatorSql = input.operatorUserId
    ? Prisma.sql`AND z.operator_user_id = ${input.operatorUserId}::uuid`
    : Prisma.empty;
  const fromSql = input.businessDateFrom
    ? Prisma.sql`AND z.business_date >= ${input.businessDateFrom}::date`
    : Prisma.empty;
  const toSql = input.businessDateTo ? Prisma.sql`AND z.business_date <= ${input.businessDateTo}::date` : Prisma.empty;
  const querySql = input.query
    ? Prisma.sql`AND (
        z.report_no ILIKE ${likeTerm(input.query)}
        OR ps.session_no ILIKE ${likeTerm(input.query)}
        OR EXISTS (
          SELECT 1
          FROM public.org_users_mst q_user
          WHERE q_user.tenant_org_id = z.tenant_org_id
            AND q_user.user_id = z.operator_user_id
            AND (q_user.display_name ILIKE ${likeTerm(input.query)} OR q_user.name ILIKE ${likeTerm(input.query)})
        )
      )`
    : Prisma.empty;

  return withTenantContext(input.tenantId, async () => {
    const rows = await prisma.$queryRaw<ArchiveDbRow[]>(Prisma.sql`
      SELECT z.id, z.report_no, z.pos_session_id, ps.session_no,
             z.branch_id, COALESCE(b.name, b.branch_name) AS branch_name,
             z.operator_user_id, COALESCE(u.display_name, u.name, u.email) AS operator_name,
             z.business_date, z.business_timezone, z.session_opened_at, z.session_closed_at, z.generated_at,
             ps.auto_close_reason,
             z.snapshot->'payments'->'totals' AS sales,
             z.snapshot->'drawer'->'balances' AS drawer_balances,
             (z.snapshot->'drawer'->>'variancePending')::boolean AS variance_pending,
             (encode(sha256(convert_to(z.snapshot::text, 'UTF8')), 'hex') = z.snapshot_hash) AS hash_ok,
             COUNT(*) OVER () AS total
      FROM public.org_pos_shift_z_rpt_tr z
      JOIN public.org_pos_sessions_mst ps
        ON ps.tenant_org_id = z.tenant_org_id AND ps.id = z.pos_session_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = z.tenant_org_id AND b.id = z.branch_id
      LEFT JOIN public.org_users_mst u
        ON u.tenant_org_id = z.tenant_org_id AND u.user_id = z.operator_user_id
      WHERE z.tenant_org_id = ${input.tenantId}::uuid
        AND z.is_active = TRUE
        ${ownOnlySql}
        ${branchScopeSql}
        ${branchSql}
        ${operatorSql}
        ${fromSql}
        ${toSql}
        ${querySql}
      ORDER BY z.business_date DESC, z.generated_at DESC, z.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const items: PosShiftZArchiveRow[] = rows.map((row) => {
      const drawerVariance: PosShiftZArchiveVariance[] = (row.drawer_balances ?? []).map((b) => ({
        currencyCode: b.currencyCode,
        variance: b.closingVariance ?? null,
      }));
      return {
        id: row.id,
        reportNo: row.report_no,
        posSessionId: row.pos_session_id,
        sessionNo: row.session_no,
        branchId: row.branch_id,
        branchName: row.branch_name,
        operatorUserId: row.operator_user_id,
        operatorName: row.operator_name,
        businessDate: dateOnly(row.business_date),
        businessTimezone: row.business_timezone,
        openedAt: iso(row.session_opened_at),
        closedAt: iso(row.session_closed_at),
        generatedAt: iso(row.generated_at),
        autoClosed: row.auto_close_reason !== null,
        sales: row.sales ?? [],
        drawerVariance,
        variancePending: row.variance_pending === true,
        hashVerified: row.hash_ok,
      };
    });

    return { items, total: rows.length > 0 ? Number(rows[0].total) : 0, page, pageSize };
  });
}
