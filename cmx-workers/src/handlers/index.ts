/**
 * Handler per queue this worker consumes. The registry (`sys_ops_job_queue_cf.consumer_app = 'CMX_WORKERS'`)
 * decides which queues run; a registry queue without a handler here is reported and never marked as seen.
 */
import { FIN_REACTION_HANDLERS } from './fin-reactions';
import { ntfCampaignChunk, ntfCampaignStart } from './ntf-campaign';
import { ntfOrchestrate } from './ntf-orchestrate';
import { smokeTest } from './smoke-test';
import type { JobHandler } from './types';

export const HANDLERS: Readonly<Record<string, JobHandler>> = {
  'ops.smoke_test': smokeTest,
  ...FIN_REACTION_HANDLERS,
  'ntf.orchestrate': ntfOrchestrate,
  'ntf.campaign_start': ntfCampaignStart,
  'ntf.campaign_chunk': ntfCampaignChunk,
};
