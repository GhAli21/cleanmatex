import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import type { ErpLitePostLogRow, PostAuditListResult } from '@/lib/types/erp-lite-ops';

export interface PostAuditFilters {
  page?: number;
  pageSize?: number;
  statusCode?: string;
  sourceDocTypeCode?: string;
  txnEventCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class ErpLitePostAuditService {
  // -------------------------------------------------------
  // Paginated posting log with optional filters
  // -------------------------------------------------------
  static async listPostLogs(filters: PostAuditFilters = {}): Promise<PostAuditListResult> {
    const tenantId = await this.requireTenantId();
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(10, filters.pageSize ?? 50), 200);
    const offset = (page - 1) * pageSize;

    const statusClause = filters.statusCode
      ? Prisma.sql`AND pl.log_status_code = ${filters.statusCode}`
      : Prisma.sql``;
    const docTypeClause = filters.sourceDocTypeCode
      ? Prisma.sql`AND pl.source_doc_type_code = ${filters.sourceDocTypeCode}`
      : Prisma.sql``;
    const eventClause = filters.txnEventCode
      ? Prisma.sql`AND pl.txn_event_code = ${filters.txnEventCode}`
      : Prisma.sql``;
    const dateFromClause = filters.dateFrom
      ? Prisma.sql`AND pl.created_at >= ${filters.dateFrom}::date`
      : Prisma.sql``;
    const dateToClause = filters.dateTo
      ? Prisma.sql`AND pl.created_at < (${filters.dateTo}::date + INTERVAL '1 day')`
      : Prisma.sql``;

    return withTenantContext(tenantId, async () => {
      type RawRow = {
        id: string;
        tenant_org_id: string;
        branch_id: string | null;
        journal_id: string | null;
        source_module_code: string;
        source_doc_type_code: string;
        source_doc_id: string;
        source_doc_no: string | null;
        txn_event_code: string;
        idempotency_key: string;
        attempt_no: string;
        attempt_status_code: string;
        log_status_code: string;
        error_code: string | null;
        error_message: string | null;
        retry_of_log_id: string | null;
        repost_of_log_id: string | null;
        created_at: Date;
        updated_at: Date | null;
        total_count: string;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          pl.id,
          pl.tenant_org_id,
          pl.branch_id,
          pl.journal_id,
          pl.source_module_code,
          pl.source_doc_type_code,
          pl.source_doc_id,
          pl.source_doc_no,
          pl.txn_event_code,
          pl.idempotency_key,
          pl.attempt_no,
          pl.attempt_status_code,
          pl.log_status_code,
          pl.error_code,
          pl.error_message,
          pl.retry_of_log_id,
          pl.repost_of_log_id,
          pl.created_at,
          pl.updated_at,
          COUNT(*) OVER() AS total_count
        FROM public.org_fin_post_log_tr pl
        WHERE pl.tenant_org_id = ${tenantId}::uuid
          AND pl.rec_status    = 1
          ${statusClause}
          ${docTypeClause}
          ${eventClause}
          ${dateFromClause}
          ${dateToClause}
        ORDER BY pl.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

      const mapped: ErpLitePostLogRow[] = rows.map((r) => ({
        id: r.id,
        tenant_org_id: r.tenant_org_id,
        branch_id: r.branch_id,
        journal_id: r.journal_id,
        source_module_code: r.source_module_code,
        source_doc_type_code: r.source_doc_type_code,
        source_doc_id: r.source_doc_id,
        source_doc_no: r.source_doc_no,
        txn_event_code: r.txn_event_code,
        idempotency_key: r.idempotency_key,
        attempt_no: Number(r.attempt_no),
        attempt_status_code: r.attempt_status_code,
        log_status_code: r.log_status_code,
        error_code: r.error_code,
        error_message: r.error_message,
        retry_of_log_id: r.retry_of_log_id,
        repost_of_log_id: r.repost_of_log_id,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      }));

      return { rows: mapped, total, page, pageSize };
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }
}
