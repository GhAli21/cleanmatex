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

/**
 * Claim a batch of PENDING or FAILED events ready for processing.
 * Sets status → PROCESSING to prevent concurrent worker picks.
 * @param limit
 */
export async function claimBatch(limit = 50) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const events = await tx.org_domain_events_outbox.findMany({
      where: {
        status: { in: [OUTBOX_STATUSES.PENDING, OUTBOX_STATUSES.FAILED] },
        next_retry_at: { lte: now },
      },
      orderBy: { next_retry_at: 'asc' },
      take:    limit,
    });

    const ids = events.map((e) => e.id);
    if (ids.length > 0) {
      await tx.org_domain_events_outbox.updateMany({
        where: { id: { in: ids } },
        data:  { status: OUTBOX_STATUSES.PROCESSING },
      });
    }

    return events;
  });
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
 * Mark an event as FAILED and schedule a retry if attempts < max_attempts.
 * @param eventId
 * @param error
 */
export async function markFailed(eventId: string, error: string): Promise<void> {
  const event = await prisma.org_domain_events_outbox.findUniqueOrThrow({ where: { id: eventId } });
  const attempts = (event.attempts ?? 0) + 1;
  const retryAt  = nextRetryAt(attempts);

  await prisma.org_domain_events_outbox.update({
    where: { id: eventId },
    data: {
      status:         retryAt ? OUTBOX_STATUSES.FAILED : OUTBOX_STATUSES.FAILED,
      attempts,
      next_retry_at:  retryAt,
      error_message:  error.slice(0, 2000),
    },
  });
}

/**
 * Re-schedule a retry for an event that is still within its attempt budget.
 * @param eventId
 * @param currentAttempts
 */
export async function scheduleRetry(eventId: string, currentAttempts: number): Promise<void> {
  const retryAt = nextRetryAt(currentAttempts);
  await prisma.org_domain_events_outbox.update({
    where: { id: eventId },
    data: {
      status:        retryAt ? OUTBOX_STATUSES.FAILED : OUTBOX_STATUSES.FAILED,
      attempts:      currentAttempts,
      next_retry_at: retryAt,
    },
  });
}
