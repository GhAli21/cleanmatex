/**
 * Tests: outbox.service
 *
 * Covers:
 * - emitEventTx — creates outbox row with PENDING status
 * - emitEventTx — sets next_retry_at and max_attempts
 * - claimBatch  — marks claimed rows as PROCESSING
 * - claimBatch  — returns empty when no due events
 * - markProcessed / markFailed (if exported)
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOutboxCreate     = jest.fn();
const mockOutboxUpdateMany = jest.fn();
const mockOutboxUpdate     = jest.fn();
const mockOutboxFindUniqueOrThrow = jest.fn();
const mockQueryRaw         = jest.fn();
const mockTransaction      = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    org_domain_events_outbox: {
      create:    (...a: unknown[]) => mockOutboxCreate(...a),
      updateMany: (...a: unknown[]) => mockOutboxUpdateMany(...a),
      update:    (...a: unknown[]) => mockOutboxUpdate(...a),
      findUniqueOrThrow: (...a: unknown[]) => mockOutboxFindUniqueOrThrow(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { emitEventTx, claimBatch, markFailed, scheduleRetry, manualRetry } from '@/lib/services/outbox.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-outbox-001';

const makeTx = () => ({
  org_domain_events_outbox: { create: mockOutboxCreate, updateMany: mockOutboxUpdateMany },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('outbox.service — emitEventTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an outbox row with status PENDING', async () => {
    mockOutboxCreate.mockResolvedValue({ id: 'evt-1' });
    const tx = makeTx() as Parameters<typeof emitEventTx>[0];

    await emitEventTx(tx, TENANT, 'ORDER_COMPLETED', 'order', 'order-1', { foo: 'bar' });

    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id:  TENANT,
          event_type:     'ORDER_COMPLETED',
          aggregate_type: 'order',
          aggregate_id:   'order-1',
          status:         'PENDING',
        }),
      })
    );
  });

  it('sets max_attempts to 6', async () => {
    mockOutboxCreate.mockResolvedValue({});
    const tx = makeTx() as Parameters<typeof emitEventTx>[0];

    await emitEventTx(tx, TENANT, 'PAYMENT_RECEIVED', 'payment', 'pay-1', {});

    const createArg = mockOutboxCreate.mock.calls[0][0];
    expect(createArg.data.max_attempts).toBe(6);
  });

  it('sets next_retry_at to a Date', async () => {
    mockOutboxCreate.mockResolvedValue({});
    const tx = makeTx() as Parameters<typeof emitEventTx>[0];

    await emitEventTx(tx, TENANT, 'REFUND_PROCESSED', 'refund', 'ref-1', {});

    const createArg = mockOutboxCreate.mock.calls[0][0];
    expect(createArg.data.next_retry_at).toBeInstanceOf(Date);
  });

  it('serialises payload as-is', async () => {
    mockOutboxCreate.mockResolvedValue({});
    const tx = makeTx() as Parameters<typeof emitEventTx>[0];
    const payload = { customerId: 'c1', points: 50 };

    await emitEventTx(tx, TENANT, 'LOYALTY_EARN', 'order', 'order-2', payload);

    const createArg = mockOutboxCreate.mock.calls[0][0];
    expect(createArg.data.payload).toMatchObject(payload);
  });
});

describe('outbox.service — claimBatch (B7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the claim_outbox_batch SQL function (FOR UPDATE SKIP LOCKED — concurrency-safe) and returns claimed events', async () => {
    const events = [
      { id: 'evt-1', status: 'PROCESSING', next_retry_at: new Date(Date.now() - 1000) },
    ];
    mockQueryRaw.mockResolvedValue(events);

    const result = await claimBatch(10);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(events);
  });

  it('returns [] when no pending events', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await claimBatch();
    expect(result).toEqual([]);
  });

  it('two concurrent claimBatch calls each get their own $queryRaw call — the DB-side FOR UPDATE SKIP LOCKED (not app code) is what prevents overlap', async () => {
    // This test documents the concurrency contract at the app layer: claimBatch
    // no longer does its own read-then-write (the old findMany+updateMany raced),
    // it delegates entirely to one atomic SQL call per invocation.
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-1' }]).mockResolvedValueOnce([{ id: 'evt-2' }]);

    const [r1, r2] = await Promise.all([claimBatch(5), claimBatch(5)]);

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(r1).toEqual([{ id: 'evt-1' }]);
    expect(r2).toEqual([{ id: 'evt-2' }]);
  });
});

describe('outbox.service — dead-letter escalation (B7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('markFailed schedules a retry while attempts remain within the budget', async () => {
    mockOutboxFindUniqueOrThrow.mockResolvedValue({ id: 'evt-1', attempts: 0 });
    mockOutboxUpdate.mockResolvedValue({});

    await markFailed('evt-1', 'boom');

    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: 1, next_retry_at: expect.any(Date) }),
      })
    );
  });

  it('markFailed sets DEAD_LETTERED once the retry budget is exhausted (a poison event stops retrying but is never silently lost)', async () => {
    // RETRY_DELAYS_MINUTES has 5 entries — the 6th failure (attempts=5 going in, 6 after) exhausts it.
    mockOutboxFindUniqueOrThrow.mockResolvedValue({ id: 'evt-1', attempts: 5 });
    mockOutboxUpdate.mockResolvedValue({});

    await markFailed('evt-1', 'still broken');

    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DEAD_LETTERED', attempts: 6, next_retry_at: null }),
      })
    );
  });

  it('scheduleRetry mirrors the same DEAD_LETTERED escalation', async () => {
    mockOutboxUpdate.mockResolvedValue({});

    await scheduleRetry('evt-2', 5);

    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DEAD_LETTERED', next_retry_at: null }) })
    );
  });
});

describe('outbox.service — manualRetry (B7 ops action)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('re-queues a FAILED/DEAD_LETTERED event scoped to the tenant, resetting attempts', async () => {
    mockOutboxUpdateMany.mockResolvedValue({ count: 1 });

    await manualRetry('evt-1', 'tenant-1');

    expect(mockOutboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'evt-1', tenant_org_id: 'tenant-1' }),
        data: expect.objectContaining({ status: 'PENDING', attempts: 0, error_message: null }),
      })
    );
  });

  it('throws when no matching row is updated (wrong tenant, or not in a retryable status)', async () => {
    mockOutboxUpdateMany.mockResolvedValue({ count: 0 });

    await expect(manualRetry('evt-x', 'tenant-1')).rejects.toThrow('EVENT_NOT_FOUND_OR_NOT_RETRYABLE');
  });
});
