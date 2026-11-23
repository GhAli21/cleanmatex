/**
 * ntf.orchestrate (Background Jobs step 5, STEP5_PLAN.md): one notification request → in-app rows,
 * outbox rows and one ntf.deliver job per sendable outbox row (run by HQ API).
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { markNotificationRequestFailed, runNotificationRequest } from '@/lib/notifications/request.service';
import { errorText, log } from '../log';
import type { JobHandler } from './types';

export const ntfOrchestrate: JobHandler = async (job, ctx) => {
  const { tenantOrgId, requestId } = QUEUE_PAYLOADS['ntf.orchestrate'].parse(job.data);
  try {
    return await runNotificationRequest(tenantOrgId, requestId);
  } catch (err) {
    if (ctx.finalAttempt) {
      await markNotificationRequestFailed(tenantOrgId, requestId, errorText(err)).catch((markErr: unknown) =>
        log('error', 'could not mark notification request failed', { requestId, error: errorText(markErr) }));
    }
    throw err;
  }
};
