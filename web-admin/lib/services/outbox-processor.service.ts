import 'server-only';

import { logger } from '@/lib/utils/logger';
import { claimBatch, markProcessed, markFailed, type OutboxEventRow } from './outbox.service';
import { consumeOrderHistoryEvent } from './order-history-consumer.service';
import { processLoyaltyEarnEvent } from './outbox-handlers/loyalty-earn.handler';

/**
 * B7 — Financial outbox handler registry.
 *
 * A claimed event is fanned out to every handler whose `eventTypes` set
 * contains its `event_type` (there can be more than one — e.g. a future GL
 * handler could also react to ORDER_COMPLETED alongside order-history).
 * A handler that doesn't own an event type is simply not invoked for it —
 * there is no "SKIPPED" return contract here because canHandle() ownership
 * is expressed by set membership, decided once per event before any handler
 * runs, unlike the BVM wiring-handler registry's per-line canHandle() checks.
 */
export interface OutboxHandler {
  name: string;
  eventTypes: ReadonlySet<string>;
  handle(event: OutboxEventRow): Promise<void>;
}

const orderHistoryHandler: OutboxHandler = {
  name: 'order-history',
  eventTypes: new Set(['ORDER_COMPLETED', 'VOUCHER_POSTED_AND_WIRED', 'AR_INVOICE_ISSUED', 'PAYMENT_VERIFIED']),
  async handle(event) {
    const outcome = await consumeOrderHistoryEvent({
      id: event.id,
      tenant_org_id: event.tenant_org_id,
      event_type: event.event_type,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      payload: event.payload,
      created_at: event.created_at,
    });
    if (outcome.status === 'SKIPPED_NOT_ORDER_LINKED') {
      logger.info('order-history consumer skipped (not order-linked)', { eventId: event.id });
    }
  },
};

const loyaltyEarnHandler: OutboxHandler = {
  name: 'loyalty-earn',
  eventTypes: new Set(['LOYALTY_EARN']),
  handle: processLoyaltyEarnEvent,
};

/** Registered in dispatch order. Add future handlers (e.g. GL fan-out, B6) here. */
export const OUTBOX_HANDLERS: OutboxHandler[] = [orderHistoryHandler, loyaltyEarnHandler];

export interface ProcessOutboxResult {
  claimed: number;
  processed: number;
  skipped: number;
  failed: number;
  deadLettered: number;
}

/**
 * Claim a batch of due outbox events and dispatch each to every registered
 * handler that owns its event type.
 *
 * - An event with no matching handler is marked processed immediately
 *   (nothing was supposed to consume it — not an error).
 * - An event whose handler(s) all succeed is marked processed.
 * - A handler throwing marks the event FAILED (bounded retry with backoff)
 *   or DEAD_LETTERED once the retry budget is exhausted — a poison event
 *   never blocks the rest of the batch (the loop continues regardless).
 * @param limit max events to claim this tick (default 50, mirrors claimBatch's own default)
 */
export async function processOutboxBatch(limit = 50): Promise<ProcessOutboxResult> {
  const events = await claimBatch(limit);
  const result: ProcessOutboxResult = { claimed: events.length, processed: 0, skipped: 0, failed: 0, deadLettered: 0 };

  for (const event of events) {
    const matchingHandlers = OUTBOX_HANDLERS.filter((h) => h.eventTypes.has(event.event_type));

    if (matchingHandlers.length === 0) {
      await markProcessed(event.id);
      result.skipped++;
      continue;
    }

    try {
      for (const handler of matchingHandlers) {
        await handler.handle(event);
      }
      await markProcessed(event.id);
      result.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Outbox event handler failed', err instanceof Error ? err : undefined, {
        eventId: event.id,
        eventType: event.event_type,
        message,
      });
      const status = await markFailed(event.id, message);
      if (status === 'DEAD_LETTERED') {
        result.deadLettered++;
      } else {
        result.failed++;
      }
    }
  }

  return result;
}
