import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ErpLitePostingEngineService } from './erp-lite-posting-engine.service';

/**
 * The `fin.erp_post.retry` job (Background Jobs step 6c, migration 0825): replays ONE posting log
 * behind a SYSTEM_ERROR exception. The posting engine queues the job when the posting fails
 * (`queueAutoRetry`), so nothing sweeps the exception table.
 *
 * Same effect as the Exception Workbench Retry button, done by the system: success marks the
 * exception RETRIED and writes one action audit row. A retry that fails again is a new posting log
 * and a new exception, which queues its own job while attempts remain; this job then completes.
 * Throws only when the replay itself could not run (lost connection, ERP-Lite switched off), so
 * pg-boss retries it.
 */

const ACTOR = 'system/erp-auto-retry';

/** Statuses a person has not acted on yet. Any other status means someone already handled it. */
const OPEN_STATUSES = new Set(['NEW', 'OPEN']);

export interface ErpRetryItemOutcome {
  outcome: 'RETRIED' | 'FAILED_AGAIN' | 'SKIPPED_ORPHAN';
  reason?: string;
}

export async function runErpPostRetryItem(
  tenantOrgId: string,
  exceptionId: string,
  postingLogId: string
): Promise<ErpRetryItemOutcome> {
  return withTenantContext(tenantOrgId, async () => {
    const rows = await prisma.$queryRaw<{ status_code: string }[]>`
      SELECT status_code
      FROM public.org_fin_post_exc_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND id = ${exceptionId}::uuid
        AND posting_log_id = ${postingLogId}::uuid
        AND rec_status = 1
    `;
    const status = rows[0]?.status_code;
    if (!status) return { outcome: 'SKIPPED_ORPHAN', reason: 'EXCEPTION_NOT_FOUND' };
    if (!OPEN_STATUSES.has(status)) return { outcome: 'SKIPPED_ORPHAN', reason: `EXCEPTION_${status}` };

    const result = await ErpLitePostingEngineService.retry({ posting_log_id: postingLogId, tenant_org_id: tenantOrgId });
    if (!result.success) return { outcome: 'FAILED_AGAIN', reason: result.error_code };

    await prisma.$executeRaw`
      UPDATE public.org_fin_post_exc_tr
      SET status_code = 'RETRIED', resolved_at = NOW(), resolved_by = ${ACTOR},
          updated_at = NOW(), updated_by = ${ACTOR}, updated_info = 'fin.erp_post.retry'
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND id = ${exceptionId}::uuid
        AND status_code IN ('NEW', 'OPEN')
    `;
    await prisma.$executeRaw`
      INSERT INTO public.org_fin_post_action_tr (
        tenant_org_id, action_domain, action_code, exception_id,
        prev_status_code, new_status_code, action_notes, result_code, actor_user_id,
        created_at, created_by, created_info, rec_status, is_active
      ) VALUES (
        ${tenantOrgId}::uuid, 'EXCEPTION', 'RETRY', ${exceptionId}::uuid,
        ${status}, 'RETRIED', 'Retried automatically after a system error', 'SUCCESS', ${ACTOR},
        NOW(), ${ACTOR}, 'fin.erp_post.retry', 1, true
      )
    `;
    return { outcome: 'RETRIED' };
  });
}
