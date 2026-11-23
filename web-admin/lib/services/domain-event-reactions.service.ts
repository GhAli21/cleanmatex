import 'server-only';

import { claimEffect } from '@cmx/jobs';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import { consumeOrderHistoryEvent } from '@/lib/services/order-history-consumer.service';
import { confirmOrderChangeApplied } from '@/lib/services/order-change/order-change-applied.handler';
import { processCashOverShortEvent } from '@/lib/services/outbox-handlers/cash-over-short.handler';
import { processLoyaltyEarnEvent } from '@/lib/services/outbox-handlers/loyalty-earn.handler';
import type { DomainEventRow } from '@/lib/types/domain-event';

/**
 * Domain event reactions (docs/features/Background_Jobs/DESIGN.md §20, §22.2).
 *
 * `emitEventTx` publishes each event to one pg-boss queue per reaction
 * (`sys_ops_job_event_subs_cf`). cmx-workers runs each job through
 * `runDomainEventReaction`, which applies the reaction exactly once:
 *
 *   1. lock the event row (reactions to one event run one after another);
 *   2. claim the effect key `<handler_code>:<event id>` in `org_ops_job_effect_tr`;
 *   3. run the handler on the same transaction;
 *   4. mark the event PROCESSED when every enabled reaction has its effect row.
 *
 * A retried or duplicated job finds its effect row and only re-checks step 4.
 */

type Tx = Prisma.TransactionClient;

/** A reaction body. Runs inside the reaction transaction; returns a short outcome label. */
export type ReactionHandler = (tx: Tx, event: DomainEventRow) => Promise<string>;

/** Keyed by `sys_ops_job_event_subs_cf.handler_code`. */
export const REACTION_HANDLERS = {
  order_history: async (tx, event) => (await consumeOrderHistoryEvent(event, tx)).status,
  loyalty_earn: async (tx, event) => {
    await processLoyaltyEarnEvent(tx, event);
    return 'APPLIED';
  },
  cash_over_short: async (tx, event) => {
    await processCashOverShortEvent(tx, event);
    return 'APPLIED';
  },
  order_change_confirm: async (tx, event) => {
    await confirmOrderChangeApplied(event, (tenantId, changeId) =>
      tx.org_order_changes_mst.findFirst({ where: { id: changeId, tenant_org_id: tenantId }, select: { id: true } }));
    return 'CONFIRMED';
  },
} satisfies Record<string, ReactionHandler>;

export type ReactionHandlerCode = keyof typeof REACTION_HANDLERS;

export interface ReactionJob {
  tenantOrgId: string;
  eventId: string;
  /** Event code this queue subscribes to; a job for any other code is rejected. */
  eventCode: string;
  handlerCode: ReactionHandlerCode;
  queueName: string;
  /** pg-boss job id, recorded on the effect row. */
  jobId: string;
  /** Consumer name, recorded on the effect row. */
  appliedBy: string;
}

/** Below the handler budget of a 300 s queue (cmx-workers `handlerBudgetMs`), so the database gives up first. */
const REACTION_TX_TIMEOUT_MS = 120_000;

/**
 * Applies one reaction to one event, once.
 * @returns `SKIPPED_ORPHAN` when the event row no longer exists, `ALREADY_APPLIED` on a repeat,
 *          otherwise the handler's outcome.
 */
export async function runDomainEventReaction(job: ReactionJob): Promise<{ outcome: string }> {
  const handler: ReactionHandler = REACTION_HANDLERS[job.handlerCode];
  return withTenantContext(job.tenantOrgId, () =>
    prisma.$transaction(async (tx) => {
      // Lock first: a second reaction to this event waits here, then sees this one's effect row.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id::text AS id FROM public.org_domain_events_outbox
        WHERE id = ${job.eventId}::uuid AND tenant_org_id = ${job.tenantOrgId}::uuid
        FOR UPDATE`;
      if (locked.length === 0) return { outcome: 'SKIPPED_ORPHAN' }; // removed with its tenant's data (DESIGN §5.6)

      const event = await tx.org_domain_events_outbox.findFirstOrThrow({
        where: { id: job.eventId, tenant_org_id: job.tenantOrgId },
        select: { id: true, tenant_org_id: true, event_type: true, aggregate_type: true, aggregate_id: true, payload: true, created_at: true },
      });
      if (event.event_type !== job.eventCode) {
        throw new Error(`REACTION_EVENT_MISMATCH: ${job.queueName} received ${event.event_type} event ${event.id}`);
      }

      const claimed = await claimEffect(tx, {
        tenantOrgId: job.tenantOrgId,
        effectKey: `${job.handlerCode}:${job.eventId}`,
        queueName: job.queueName,
        jobId: job.jobId,
        appliedBy: job.appliedBy,
      });
      const outcome = claimed ? await handler(tx, event as DomainEventRow) : 'ALREADY_APPLIED';

      // Done when every enabled reaction (pgboss.subscription, the list publish() used) has its effect row.
      await tx.$executeRaw`
        UPDATE public.org_domain_events_outbox o
        SET status = ${OUTBOX_STATUSES.PROCESSED}, processed_at = now(), error_message = NULL
        WHERE o.id = ${job.eventId}::uuid
          AND o.tenant_org_id = ${job.tenantOrgId}::uuid
          AND o.status <> ${OUTBOX_STATUSES.PROCESSED}
          AND NOT EXISTS (
            SELECT 1
            FROM pgboss.subscription ps
            JOIN public.sys_ops_job_event_subs_cf s ON s.queue_job_code = ps.name AND s.event_code = ps.event
            WHERE ps.event = o.event_type
              AND NOT EXISTS (
                SELECT 1 FROM public.org_ops_job_effect_tr e
                WHERE e.tenant_org_id = o.tenant_org_id
                  AND e.effect_key = s.handler_code || ':' || o.id::text))`;
      return { outcome };
    }, { maxWait: 10_000, timeout: REACTION_TX_TIMEOUT_MS }),
  );
}

/**
 * Records a reaction's last failed attempt on the event row (the job itself moves to `dead_letter`),
 * so the tenant outbox monitor shows it and its Retry runs the reactions again.
 */
export async function markDomainEventDeadLettered(tenantOrgId: string, eventId: string, error: string): Promise<void> {
  await prisma.org_domain_events_outbox.updateMany({
    where: { id: eventId, tenant_org_id: tenantOrgId, status: { not: OUTBOX_STATUSES.PROCESSED } },
    data: { status: OUTBOX_STATUSES.DEAD_LETTERED, error_message: error.slice(0, 2000) },
  });
}
