import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import type { OutboxEventType } from '@/lib/constants/order-financial';
import { Prisma } from '@prisma/client';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Append a domain event inside the caller's transaction and publish it to its reactions.
 *
 * The row is the permanent event log (`org_domain_events_outbox`). `jobs.publish` adds one pg-boss
 * job per enabled reaction (`sys_ops_job_event_subs_cf`, mirrored in `pgboss.subscription`) in the
 * same transaction, with the event id as job id: commit keeps both, rollback removes both.
 * cmx-workers runs each reaction and marks the row PROCESSED once all have applied. An event with
 * no reaction is written as PROCESSED by trigger `trg_odeo_no_reaction` (migration 0809).
 * @param tx caller's interactive transaction
 * @param tenantId event's Organization
 * @param eventType catalogued code (`sys_ops_job_event_types_cd`, FK-checked)
 * @param aggregateType domain object kind, e.g. `order`
 * @param aggregateId domain object id
 * @param payload small JSON context; reactions re-read current data by id
 * @returns the event id
 */
export async function emitEventTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  eventType: OutboxEventType,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const row = await tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id:  tenantId,
      event_type:     eventType,
      aggregate_type: aggregateType,
      aggregate_id:   aggregateId,
      payload: payload as Prisma.InputJsonValue,
      status:         OUTBOX_STATUSES.PENDING,
    },
    select: { id: true },
  });
  await jobs.publish(tx, eventType, { tenantOrgId: tenantId, eventId: row.id });
  return row.id;
}

/**
 * Re-run the reactions of FAILED or DEAD_LETTERED events (operator retry from the outbox monitor).
 * One UPDATE moves each row back to PENDING (or straight to PROCESSED when its event no longer has
 * a reaction) and returns the rows it changed; only those are published again, with new job ids.
 * A concurrent second retry waits on the row lock, then finds the row no longer retryable, so it
 * publishes nothing. A reaction that already applied finds its effect row and does nothing.
 */
async function requeueEvents(eventIds: string[], tenantId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; event_type: OutboxEventType; status: string }[]>`
      UPDATE public.org_domain_events_outbox o
      SET status = CASE WHEN EXISTS (SELECT 1 FROM pgboss.subscription s WHERE s.event = o.event_type)
                        THEN ${OUTBOX_STATUSES.PENDING} ELSE ${OUTBOX_STATUSES.PROCESSED} END,
          processed_at = CASE WHEN EXISTS (SELECT 1 FROM pgboss.subscription s WHERE s.event = o.event_type)
                              THEN NULL ELSE now() END,
          attempts = 0,
          error_message = NULL
      WHERE o.tenant_org_id = ${tenantId}::uuid
        AND o.id = ANY(${eventIds}::uuid[])
        AND o.status IN (${OUTBOX_STATUSES.FAILED}, ${OUTBOX_STATUSES.DEAD_LETTERED})
      RETURNING o.id::text AS id, o.event_type, o.status`;
    for (const row of rows) {
      if (row.status !== OUTBOX_STATUSES.PENDING) continue;
      await jobs.publish(tx, row.event_type, { tenantOrgId: tenantId, eventId: row.id }, { redeliver: true });
    }
    return rows.length;
  });
}

/**
 * Manually re-run one FAILED or DEAD_LETTERED event (ops action).
 * @param eventId
 * @param tenantId
 */
export async function manualRetry(eventId: string, tenantId: string): Promise<void> {
  const count = await requeueEvents([eventId], tenantId);
  if (count === 0) {
    throw new Error('EVENT_NOT_FOUND_OR_NOT_RETRYABLE');
  }
}

/** Max events a single ops bulk-retry may re-queue in one request. */
export const OUTBOX_BULK_RETRY_MAX = 50;

/**
 * Manually re-queue many FAILED/DEAD_LETTERED events (ops bulk action).
 * Tenant-scoped; silently skips ids that are missing or not retryable.
 * @param eventIds
 * @param tenantId
 */
export async function manualRetryMany(eventIds: string[], tenantId: string): Promise<number> {
  const unique = [...new Set(eventIds)].slice(0, OUTBOX_BULK_RETRY_MAX);
  if (unique.length === 0) return 0;
  return requeueEvents(unique, tenantId);
}
