import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';
import type { ErpLiteJournalListRow } from '@/lib/types/erp-lite-ops';

export class ErpLiteJournalsService {
  static async listRecentJournals(limit = 150): Promise<ErpLiteJournalListRow[]> {
    const tenantId = await this.requireTenantId();
    const take = Math.min(Math.max(1, limit), 500);

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          journal_no: string;
          journal_date: string;
          posting_date: string;
          status_code: string;
          txn_event_code: string;
          total_debit: string;
          total_credit: string;
          narration: string | null;
          source_doc_type_code: string;
          source_doc_no: string | null;
        }>
      >(Prisma.sql`
        SELECT
          j.id,
          j.journal_no,
          TO_CHAR(j.journal_date, 'YYYY-MM-DD') AS journal_date,
          TO_CHAR(j.posting_date, 'YYYY-MM-DD') AS posting_date,
          j.status_code,
          j.txn_event_code,
          j.total_debit::text AS total_debit,
          j.total_credit::text AS total_credit,
          j.narration,
          j.source_doc_type_code,
          j.source_doc_no
        FROM public.org_fin_journal_mst j
        WHERE j.tenant_org_id = ${tenantId}::uuid
          AND j.rec_status = 1
        ORDER BY j.posting_date DESC, j.journal_no DESC
        LIMIT ${take}
      `);

      return rows.map((r) => ({
        id: r.id,
        journal_no: r.journal_no,
        journal_date: r.journal_date,
        posting_date: r.posting_date,
        status_code: r.status_code,
        txn_event_code: r.txn_event_code,
        total_debit: r.total_debit,
        total_credit: r.total_credit,
        narration: r.narration,
        source_doc_type_code: r.source_doc_type_code,
        source_doc_no: r.source_doc_no,
      }));
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    await assertErpLiteEnabledForTenant(tenantId);
    return tenantId;
  }
}
