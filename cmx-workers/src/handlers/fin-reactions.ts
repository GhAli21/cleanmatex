/**
 * Finance domain event reactions (DESIGN §20.2, §22.2): one pg-boss queue per reaction, created by
 * migration 0809. Each job carries `{ tenantOrgId, eventId }`; the web-admin reaction runner applies
 * the reaction once and marks the event row PROCESSED when all its reactions are done.
 */
import { DOMAIN_EVENT_JOB } from '@cmx/jobs';
import {
  markDomainEventDeadLettered,
  runDomainEventReaction,
  type ReactionHandlerCode,
} from '@/lib/services/domain-event-reactions.service';
import { errorText, log } from '../log';
import type { JobHandler } from './types';

export interface FinReaction {
  queue: string;
  eventCode: string;
  handlerCode: ReactionHandlerCode;
}

/** Mirrors the enabled rows of `sys_ops_job_event_subs_cf`; test/reactions.test.ts compares the two. */
export const FIN_REACTIONS: readonly FinReaction[] = [
  { queue: 'fin.order_submitted.order_history', eventCode: 'ORDER_SUBMITTED', handlerCode: 'order_history' },
  { queue: 'fin.voucher_posted_and_wired.order_history', eventCode: 'VOUCHER_POSTED_AND_WIRED', handlerCode: 'order_history' },
  { queue: 'fin.ar_invoice_issued.order_history', eventCode: 'AR_INVOICE_ISSUED', handlerCode: 'order_history' },
  { queue: 'fin.payment_verified.order_history', eventCode: 'PAYMENT_VERIFIED', handlerCode: 'order_history' },
  { queue: 'fin.payment_cancelled.order_history', eventCode: 'PAYMENT_CANCELLED', handlerCode: 'order_history' },
  { queue: 'fin.payment_failed.order_history', eventCode: 'PAYMENT_FAILED', handlerCode: 'order_history' },
  { queue: 'fin.payment_voided.order_history', eventCode: 'PAYMENT_VOIDED', handlerCode: 'order_history' },
  { queue: 'fin.payment_reversed.order_history', eventCode: 'PAYMENT_REVERSED', handlerCode: 'order_history' },
  { queue: 'fin.payment_captured.order_history', eventCode: 'PAYMENT_CAPTURED', handlerCode: 'order_history' },
  { queue: 'fin.payment_settled.order_history', eventCode: 'PAYMENT_SETTLED', handlerCode: 'order_history' },
  { queue: 'fin.loyalty_earn_recalc_requested.loyalty_earn', eventCode: 'LOYALTY_EARN_RECALC_REQUESTED', handlerCode: 'loyalty_earn' },
  { queue: 'fin.cash_drawer_variance_recorded.cash_over_short', eventCode: 'CASH_DRAWER_VARIANCE_RECORDED', handlerCode: 'cash_over_short' },
  { queue: 'fin.order_change_applied.order_change_confirm', eventCode: 'ORDER_CHANGE_APPLIED', handlerCode: 'order_change_confirm' },
];

function reactionHandler(r: FinReaction): JobHandler {
  return async (job, ctx) => {
    const { tenantOrgId, eventId } = DOMAIN_EVENT_JOB.parse(job.data);
    try {
      return await runDomainEventReaction({
        tenantOrgId,
        eventId,
        eventCode: r.eventCode,
        handlerCode: r.handlerCode,
        queueName: r.queue,
        jobId: job.id,
        appliedBy: ctx.consumer,
      });
    } catch (err) {
      if (ctx.finalAttempt) {
        // Shown on the tenant outbox monitor, whose Retry runs the reactions again.
        await markDomainEventDeadLettered(tenantOrgId, eventId, errorText(err)).catch((markErr: unknown) =>
          log('error', 'could not mark event dead-lettered', { queue: r.queue, eventId, error: errorText(markErr) }));
      }
      throw err;
    }
  };
}

export const FIN_REACTION_HANDLERS: Readonly<Record<string, JobHandler>> = Object.fromEntries(
  FIN_REACTIONS.map((r) => [r.queue, reactionHandler(r)]),
);
