/**
 * ERP posting retry (Background Jobs step 6c, migration 0825): one job per SYSTEM_ERROR posting
 * exception, queued by the posting engine a few minutes after the failure. No schedule, no sweep.
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { runErpPostRetryItem } from '@/lib/services/erp-posting-auto-retry.service';
import type { JobHandler } from './types';

export const FIN_ERP_RETRY_HANDLERS: Readonly<Record<string, JobHandler>> = {
  'fin.erp_post.retry': async (job) => {
    const { tenantOrgId, exceptionId, postingLogId } = QUEUE_PAYLOADS['fin.erp_post.retry'].parse(job.data);
    return runErpPostRetryItem(tenantOrgId, exceptionId, postingLogId);
  },
};
