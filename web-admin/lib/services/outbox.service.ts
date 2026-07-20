import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { OUTBOX_EVENT_TYPES, OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import type { OutboxEventType } from '@/lib/constants/order-financial';
import { Prisma } from '@prisma/client';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Exponential back-off schedule in minutes: 1 → 5 → 15 → 60 → 240 → FAILED
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240];

function nextRetryAt(attempts: number): Date | null {
  const delayMinutes = RETRY_DELAYS_MINUTES[attempts] ?? null;
  if (delayMinutes === null) return null;
  return new Date(Date.now() + delayMinutes * 60_000);
}

/**
 * Append a domain event to the outbox within an existing transaction.
 * The worker picks up PENDING rows and publishes them to the event bus.
 * @param tx
 * @param tenantId
 * @param eventType
 * @param aggregateType
 * @param aggregateId
 * @param payload
 */
export async function emitEventTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  eventType: OutboxEventType,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id:  tenantId,
      event_type:     eventType,
      aggregate_type: aggregateType,
      aggregate_id:   aggregateId,
      payload: payload as Prisma.InputJsonValue,
      status:         OUTBOX_STATUSES.PENDING,
      attempts:       0,
      max_attempts:   6,
      next_retry_at:  new Date(),
    },
  });
}

/** Shape of a claimed row — mirrors org_domain_events_outbox exactly (see 0292/0410 DDL). */
export interface OutboxEventRow {
  id: string;
  tenant_org_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Prisma.JsonValue;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date | null;
  processed_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

/**
 * Claim a batch of PENDING or FAILED events ready for processing.
 *
 * B7: calls the `claim_outbox_batch` SQL function (migration 0296) instead of
 * a plain findMany+updateMany — that pair has no row lock at all under
 * Postgres READ COMMITTED, so two concurrent callers could both select and
 * then both flip the SAME rows to PROCESSING. The SQL function takes the
 * claim inside `SELECT ... FOR UPDATE SKIP LOCKED`, so concurrent callers
 * never double-claim the same event (tested — see outbox.service.test.ts
 * "concurrency" suite).
 * @param limit
 */
export async function claimBatch(limit = 50): Promise<OutboxEventRow[]> {
  return prisma.$queryRaw<OutboxEventRow[]>`SELECT * FROM claim_outbox_batch(${limit}, NOW())`;
}

/**
 * Mark an outbox event as successfully processed.
 * @param eventId
 */
export async function markProcessed(eventId: string): Promise<void> {
  await prisma.org_domain_events_outbox.update({
    where: { id: eventId },
    data:  { status: OUTBOX_STATUSES.PROCESSED, processed_at: new Date() },
  });
}

/**
 * Mark an event as FAILED and schedule a retry if attempts < max_attempts,
 * or DEAD_LETTERED once the retry budget is exhausted (B7 — previously this
 * stayed FAILED forever with next_retry_at=NULL, indistinguishable from
 * "about to retry" without inspecting that column).
 * @param eventId
 * @param error
 */
export async function markFailed(eventId: string, error: string): Promise<'FAILED' | 'DEAD_LETTERED'> {
  const event = await prisma.org_domain_events_outbox.findUniqueOrThrow({ where: { id: eventId } });
  const attempts = (event.attempts ?? 0) + 1;
  const retryAt  = nextRetryAt(attempts);
  const status   = retryAt ? OUTBOX_STATUSES.FAILED : OUTBOX_STATUSES.DEAD_LETTERED;

  await prisma.org_domain_events_outbox.update({
    where: { id: eventId },
    data: {
      status,
      attempts,
      next_retry_at:  retryAt,
      error_message:  error.slice(0, 2000),
    },
  });

  return status;
}

/**
 * Re-schedule a retry for an event that is still within its attempt budget,
 * or DEAD_LETTERED once exhausted (see markFailed).
 * @param eventId
 * @param currentAttempts
 */
export async function scheduleRetry(eventId: string, currentAttempts: number): Promise<void> {
  const retryAt = nextRetryAt(currentAttempts);
  await prisma.org_domain_events_outbox.update({
    where: { id: eventId },
    data: {
      status:        retryAt ? OUTBOX_STATUSES.FAILED : OUTBOX_STATUSES.DEAD_LETTERED,
      attempts:      currentAttempts,
      next_retry_at: retryAt,
    },
  });
}

/**
 * Manually re-queue a FAILED or DEAD_LETTERED event (ops action, B7).
 * Resets attempts to 0 and next_retry_at to now so the next processor tick
 * picks it up immediately; clears the prior error message.
 * @param eventId
 * @param tenantId
 */
export async function manualRetry(eventId: string, tenantId: string): Promise<void> {
  const updated = await prisma.org_domain_events_outbox.updateMany({
    where: {
      id: eventId,
      tenant_org_id: tenantId,
      status: { in: [OUTBOX_STATUSES.FAILED, OUTBOX_STATUSES.DEAD_LETTERED] },
    },
    data: {
      status:        OUTBOX_STATUSES.PENDING,
      attempts:      0,
      next_retry_at: new Date(),
      error_message: null,
    },
  });
  if (updated.count === 0) {
    throw new Error('EVENT_NOT_FOUND_OR_NOT_RETRYABLE');
  }
}
