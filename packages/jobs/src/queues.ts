/**
 * Queue names and payload schemas: the producer side of every pg-boss queue.
 *
 * A queue exists only after a migration creates it (`pgboss.create_queue`) and registers it in
 * `sys_ops_job_cf` + `sys_ops_job_queue_cf`; sending to a missing queue throws. Add the queue here
 * in the same change that ships its migration, never before.
 *
 * Payloads carry ids, codes and small flags only (DESIGN §5.3): strict objects, so an extra field,
 * a whole entity or personal data is rejected before it reaches the queue table.
 */
import { z } from 'zod';

/** Any 8-4-4-4-12 hex id. `z.guid()`, not `z.uuid()`: seeded demo ids are not RFC 4122 versions. */
export const zId = z.guid();

/** Dead-letter queue. Producers never send to it; pg-boss moves exhausted jobs there. */
export const DEAD_LETTER_QUEUE = 'dead_letter' as const;

/** Payload schema per producer queue. The key is the pg-boss queue name. */
export const QUEUE_PAYLOADS = {
  /**
   * Proves a consumer runs end to end (DESIGN §10 step 3). `mode: 'fail'` makes the handler throw,
   * to prove retry with backoff, the dead-letter queue and redrive on any environment.
   */
  'ops.smoke_test': z.strictObject({ runId: zId, mode: z.enum(['ok', 'fail']).optional() }),
  /**
   * One notification request (`org_ntf_requests_tr`, migration 0810) → in-app and outbox rows.
   * Job id = request id, so a request is prepared by one job.
   */
  'ntf.orchestrate': z.strictObject({ tenantOrgId: zId, requestId: zId }),
  /**
   * One outbox row (`org_ntf_outbox_dtl`) → its provider, run by HQ API. The job id is the claim
   * token (`fn_ntf_worker_claim_one`); the first send of a row uses the outbox id.
   */
  'ntf.deliver': z.strictObject({ tenantOrgId: zId, outboxId: zId }),
  /**
   * One campaign (`org_ntf_campaigns_mst`) at its send time, on approval, start or resume: creates its
   * targets, sets it RUNNING and queues one `ntf.campaign_chunk` per page that still has PENDING targets.
   */
  'ntf.campaign_start': z.strictObject({ tenantOrgId: zId, campaignId: zId }),
  /**
   * One page of a campaign's targets: `chunk` k = targets k*50 .. k*50+49 in id order (fixed once the
   * campaign starts). Each PENDING target gets its outbox row and `ntf.deliver` job in one transaction.
   */
  'ntf.campaign_chunk': z.strictObject({ tenantOrgId: zId, campaignId: zId, chunk: z.number().int().min(0).max(100_000) }),
} as const;

export type QueueName = keyof typeof QUEUE_PAYLOADS;
export type QueuePayload<N extends QueueName> = z.infer<(typeof QUEUE_PAYLOADS)[N]>;

/**
 * Job data for every domain-event subscription queue (DESIGN §20.4). The event row in
 * `org_domain_events_outbox` holds the facts; the job only points at it.
 */
export const DOMAIN_EVENT_JOB = z.strictObject({ tenantOrgId: zId, eventId: zId });
export type DomainEventJob = z.infer<typeof DOMAIN_EVENT_JOB>;

/** Event codes are past-tense UPPER_SNAKE facts, mirroring `sys_ops_job_event_types_cd.event_code`. */
export const EVENT_CODE = z.string().regex(/^[A-Z][A-Z0-9_]{2,62}$/);
