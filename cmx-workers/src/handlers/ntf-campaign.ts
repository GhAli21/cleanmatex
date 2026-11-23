/**
 * ntf.campaign_start / ntf.campaign_chunk (Background Jobs step 5, STEP5_PLAN.md tenant item 4):
 * a campaign's targets → outbox rows and low-priority ntf.deliver jobs, 50 targets per chunk job.
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { failCampaignChunk, runCampaignChunk, startCampaign } from '@/lib/notifications/campaign-jobs.service';
import { errorText, log } from '../log';
import type { JobHandler } from './types';

export const ntfCampaignStart: JobHandler = async (job) => {
  const { tenantOrgId, campaignId } = QUEUE_PAYLOADS['ntf.campaign_start'].parse(job.data);
  return startCampaign(tenantOrgId, campaignId);
};

export const ntfCampaignChunk: JobHandler = async (job, ctx) => {
  const { tenantOrgId, campaignId, chunk } = QUEUE_PAYLOADS['ntf.campaign_chunk'].parse(job.data);
  try {
    return await runCampaignChunk(tenantOrgId, campaignId, chunk);
  } catch (err) {
    if (ctx.finalAttempt) {
      await failCampaignChunk(tenantOrgId, campaignId, chunk, errorText(err)).catch((markErr: unknown) =>
        log('error', 'could not mark campaign chunk failed', { campaignId, chunk, error: errorText(markErr) }));
    }
    throw err;
  }
};
