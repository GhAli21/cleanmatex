/**
 * The web-admin modules cmx-workers imports, as seen by `npm run typecheck` (tsconfig.typecheck.json).
 * web-admin compiles with `strict: false`, so its sources cannot be type-checked under this
 * workspace's strict settings; the build (esbuild) and the tests (tsx) load the real modules through
 * tsconfig.json paths. Keep these in step with the real exports: the integration tests run them.
 */
declare module '@/lib/services/domain-event-reactions.service' {
  export type ReactionHandlerCode = 'order_history' | 'loyalty_earn' | 'cash_over_short' | 'order_change_confirm';
  export interface ReactionJob {
    tenantOrgId: string;
    eventId: string;
    eventCode: string;
    handlerCode: ReactionHandlerCode;
    queueName: string;
    jobId: string;
    appliedBy: string;
  }
  export const REACTION_HANDLERS: Readonly<Record<ReactionHandlerCode, unknown>>;
  export function runDomainEventReaction(job: ReactionJob): Promise<{ outcome: string }>;
  export function markDomainEventDeadLettered(tenantOrgId: string, eventId: string, error: string): Promise<void>;
}

declare module '@/lib/notifications/request.service' {
  export interface NotificationRequestOutcome {
    outcome: 'PROCESSED' | 'ALREADY_PROCESSED' | 'SKIPPED_ORPHAN';
    deliverJobs: number;
  }
  export function runNotificationRequest(tenantOrgId: string, requestId: string): Promise<NotificationRequestOutcome>;
  export function markNotificationRequestFailed(tenantOrgId: string, requestId: string, error: string): Promise<void>;
  export function requestNotification(event: {
    code: string;
    tenantOrgId: string;
    recipientUserIds: string[];
    sourceEntityType?: string;
    sourceEntityId?: string;
    variables: Record<string, string>;
  }): Promise<string>;
}

declare module '@/lib/notifications/campaign-jobs.service' {
  export const CAMPAIGN_CHUNK_SIZE: number;
  export const CAMPAIGN_DELIVER_PRIORITY: number;
  export interface CampaignStartOutcome {
    outcome: 'STARTED' | 'NOT_DUE' | 'NOT_STARTABLE' | 'NO_TARGETS' | 'COMPLETED' | 'SKIPPED_ORPHAN';
    chunks: number;
  }
  export interface CampaignChunkOutcome {
    outcome: 'PROCESSED' | 'NOT_RUNNING' | 'CHANNEL_OFF_RECHECK' | 'SKIPPED_ORPHAN';
    queued: number;
    sentNow: number;
    skipped: number;
    completed: boolean;
  }
  export function startCampaign(tenantOrgId: string, campaignId: string): Promise<CampaignStartOutcome>;
  export function runCampaignChunk(tenantOrgId: string, campaignId: string, chunk: number): Promise<CampaignChunkOutcome>;
  export function failCampaignChunk(tenantOrgId: string, campaignId: string, chunk: number, error: string): Promise<void>;
}

declare module '@/lib/db/prisma' {
  import type { PrismaClient } from '@prisma/client';
  export const prisma: PrismaClient;
}

declare module '@/lib/jobs/producer' {
  import type { JobProducer } from '@cmx/jobs';
  export const jobs: JobProducer;
}

declare module '@/lib/services/outbox.service' {
  import type { Prisma } from '@prisma/client';
  export function emitEventTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<string>;
  export function manualRetry(eventId: string, tenantId: string): Promise<void>;
}

declare module '@/lib/constants/order-financial' {
  export const OUTBOX_HANDLER_CATALOG: readonly { handler: string; eventTypes: readonly string[] }[];
}

declare module '@/lib/services/finance-expiry-jobs.service' {
  export type ExpiryKind = 'gift_card' | 'loyalty';
  export const EXPIRY_SWEEP_PAGE: number;
  export const EXPIRY_SWEEP_MAX_PAGES: number;
  export interface ExpirySweepOutcome { found: number; queued: number; nextPage: number | null }
  export interface ExpiryItemOutcome { outcome: 'EXPIRED' | 'SKIPPED_ORPHAN'; reason?: string }
  export function loyaltyExpiryJobId(accountId: string, at?: Date): string;
  export function runExpirySweep(kind: ExpiryKind, page?: number): Promise<ExpirySweepOutcome>;
  export function runGiftCardExpiryItem(tenantOrgId: string, giftCardId: string): Promise<ExpiryItemOutcome>;
  export function runLoyaltyExpiryItem(tenantOrgId: string, accountId: string): Promise<ExpiryItemOutcome>;
}

declare module '@/lib/services/pos-session-rollover.service' {
  export interface PosSessionRolloverOutcome { processedCount: number; failedCount: number }
  export function runPosSessionRolloverSweep(options?: { now?: Date; tenantId?: string; sessionIds?: readonly string[] }): Promise<PosSessionRolloverOutcome>;
}

declare module '@/lib/services/erp-posting-auto-retry.service' {
  export interface ErpRetryItemOutcome { outcome: 'RETRIED' | 'FAILED_AGAIN' | 'SKIPPED_ORPHAN'; reason?: string }
  export function runErpPostRetryItem(tenantOrgId: string, exceptionId: string, postingLogId: string): Promise<ErpRetryItemOutcome>;
}
