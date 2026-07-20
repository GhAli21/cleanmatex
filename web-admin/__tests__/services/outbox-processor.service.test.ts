/**
 * Tests: outbox-processor.service (B7)
 *
 * Covers:
 * - registry: an event is dispatched only to handlers whose eventTypes own it
 * - an event with no matching handler is marked processed (not an error)
 * - a poison event (handler throws) is marked failed/dead-lettered without
 *   blocking the rest of the batch (regression lock for H6)
 * - replayed event (claimBatch returns nothing new) processes zero times —
 *   idempotency lives in claimBatch/consumer layers, this just proves the
 *   loop only acts on what it actually claims
 * - concurrency: two processOutboxBatch calls each make their own claimBatch
 *   call (the actual double-claim guard is the DB-side FOR UPDATE SKIP LOCKED
 *   inside claim_outbox_batch — see outbox.service.test.ts)
 */

const mockClaimBatch = jest.fn();
const mockMarkProcessed = jest.fn();
const mockMarkFailed = jest.fn();
const mockConsumeOrderHistoryEvent = jest.fn();
const mockProcessLoyaltyEarnEvent = jest.fn();

jest.mock('@/lib/services/outbox.service', () => ({
  claimBatch: (...a: unknown[]) => mockClaimBatch(...a),
  markProcessed: (...a: unknown[]) => mockMarkProcessed(...a),
  markFailed: (...a: unknown[]) => mockMarkFailed(...a),
}));

jest.mock('@/lib/services/order-history-consumer.service', () => ({
  consumeOrderHistoryEvent: (...a: unknown[]) => mockConsumeOrderHistoryEvent(...a),
}));

jest.mock('@/lib/services/outbox-handlers/loyalty-earn.handler', () => ({
  processLoyaltyEarnEvent: (...a: unknown[]) => mockProcessLoyaltyEarnEvent(...a),
}));

import { processOutboxBatch, OUTBOX_HANDLERS } from '@/lib/services/outbox-processor.service';

const TENANT = 'tenant-outbox-proc-001';

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'evt-1',
    tenant_org_id: TENANT,
    event_type: 'ORDER_COMPLETED',
    aggregate_type: 'order',
    aggregate_id: 'order-1',
    payload: {},
    status: 'PROCESSING',
    attempts: 0,
    max_attempts: 6,
    next_retry_at: null,
    processed_at: null,
    error_message: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('outbox-processor.service — registry', () => {
  it('registers the order-history and loyalty-earn handlers with distinct, non-overlapping event-type ownership by design', () => {
    const orderHistory = OUTBOX_HANDLERS.find((h) => h.name === 'order-history')!;
    const loyaltyEarn = OUTBOX_HANDLERS.find((h) => h.name === 'loyalty-earn')!;
    expect(orderHistory.eventTypes.has('ORDER_COMPLETED')).toBe(true);
    expect(orderHistory.eventTypes.has('LOYALTY_EARN')).toBe(false);
    expect(loyaltyEarn.eventTypes.has('LOYALTY_EARN')).toBe(true);
    expect(loyaltyEarn.eventTypes.has('ORDER_COMPLETED')).toBe(false);
  });
});

describe('outbox-processor.service — processOutboxBatch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dispatches ORDER_COMPLETED only to the order-history handler and marks it processed', async () => {
    mockClaimBatch.mockResolvedValue([makeEvent({ event_type: 'ORDER_COMPLETED' })]);
    mockConsumeOrderHistoryEvent.mockResolvedValue({ status: 'WRITTEN', historyId: 'hist-1' });

    const result = await processOutboxBatch();

    expect(mockConsumeOrderHistoryEvent).toHaveBeenCalledTimes(1);
    expect(mockProcessLoyaltyEarnEvent).not.toHaveBeenCalled();
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-1');
    expect(result).toEqual({ claimed: 1, processed: 1, skipped: 0, failed: 0, deadLettered: 0 });
  });

  it('dispatches LOYALTY_EARN only to the loyalty-earn handler', async () => {
    mockClaimBatch.mockResolvedValue([makeEvent({ id: 'evt-2', event_type: 'LOYALTY_EARN' })]);
    mockProcessLoyaltyEarnEvent.mockResolvedValue(undefined);

    await processOutboxBatch();

    expect(mockProcessLoyaltyEarnEvent).toHaveBeenCalledTimes(1);
    expect(mockConsumeOrderHistoryEvent).not.toHaveBeenCalled();
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-2');
  });

  it('marks an event with no matching handler as processed (not an error) — nothing was ever supposed to consume it', async () => {
    mockClaimBatch.mockResolvedValue([makeEvent({ id: 'evt-3', event_type: 'AR_DEBIT_NOTE_POSTED' })]);

    const result = await processOutboxBatch();

    expect(mockConsumeOrderHistoryEvent).not.toHaveBeenCalled();
    expect(mockProcessLoyaltyEarnEvent).not.toHaveBeenCalled();
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-3');
    expect(result.skipped).toBe(1);
  });

  it('a poison event (handler throws) is marked failed and does NOT block the rest of the batch (H6 regression lock)', async () => {
    mockClaimBatch.mockResolvedValue([
      makeEvent({ id: 'evt-poison', event_type: 'LOYALTY_EARN' }),
      makeEvent({ id: 'evt-good', event_type: 'ORDER_COMPLETED' }),
    ]);
    mockProcessLoyaltyEarnEvent.mockRejectedValue(new Error('boom'));
    mockConsumeOrderHistoryEvent.mockResolvedValue({ status: 'WRITTEN', historyId: 'hist-2' });
    mockMarkFailed.mockResolvedValue('FAILED');

    const result = await processOutboxBatch();

    expect(mockMarkFailed).toHaveBeenCalledWith('evt-poison', 'boom');
    // The second event in the same batch still gets processed — the poison
    // event does not abort the loop.
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-good');
    expect(result).toEqual({ claimed: 2, processed: 1, skipped: 0, failed: 1, deadLettered: 0 });
  });

  it('counts a DEAD_LETTERED markFailed outcome separately from a merely-FAILED one', async () => {
    mockClaimBatch.mockResolvedValue([makeEvent({ id: 'evt-exhausted', event_type: 'LOYALTY_EARN' })]);
    mockProcessLoyaltyEarnEvent.mockRejectedValue(new Error('still broken'));
    mockMarkFailed.mockResolvedValue('DEAD_LETTERED');

    const result = await processOutboxBatch();

    expect(result.deadLettered).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('returns zero-effect result when claimBatch has nothing due (a replay after everything is already processed)', async () => {
    mockClaimBatch.mockResolvedValue([]);

    const result = await processOutboxBatch();

    expect(mockMarkProcessed).not.toHaveBeenCalled();
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 0, processed: 0, skipped: 0, failed: 0, deadLettered: 0 });
  });

  it('two concurrent processOutboxBatch calls each issue their own claimBatch call (DB-side SKIP LOCKED is the actual double-claim guard)', async () => {
    mockClaimBatch
      .mockResolvedValueOnce([makeEvent({ id: 'evt-a' })])
      .mockResolvedValueOnce([makeEvent({ id: 'evt-b' })]);
    mockConsumeOrderHistoryEvent.mockResolvedValue({ status: 'WRITTEN', historyId: 'h' });

    const [r1, r2] = await Promise.all([processOutboxBatch(), processOutboxBatch()]);

    expect(mockClaimBatch).toHaveBeenCalledTimes(2);
    expect(r1.processed).toBe(1);
    expect(r2.processed).toBe(1);
    // Distinct event ids claimed by each call — no overlap possible at this layer.
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-a');
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-b');
  });
});
