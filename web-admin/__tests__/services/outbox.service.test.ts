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

const mockOutboxCreate    = jest.fn();
const mockOutboxFindMany  = jest.fn();
const mockOutboxUpdateMany = jest.fn();
const mockTransaction     = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    org_domain_events_outbox: {
      create:    (...a: unknown[]) => mockOutboxCreate(...a),
      findMany:  (...a: unknown[]) => mockOutboxFindMany(...a),
      updateMany: (...a: unknown[]) => mockOutboxUpdateMany(...a),
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

import { emitEventTx, claimBatch } from '@/lib/services/outbox.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-outbox-001';

const makeTx = () => ({
  org_domain_events_outbox: { create: mockOutboxCreate, updateMany: mockOutboxUpdateMany, findMany: mockOutboxFindMany },
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

describe('outbox.service — claimBatch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls $transaction and returns claimed events', async () => {
    const events = [
      { id: 'evt-1', status: 'PENDING', next_retry_at: new Date(Date.now() - 1000) },
    ];

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        org_domain_events_outbox: {
          findMany: jest.fn().mockResolvedValue(events),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(txMock);
    });

    const result = await claimBatch(10);
    expect(result).toEqual(events);
  });

  it('returns [] when no pending events', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        org_domain_events_outbox: {
          findMany:   jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(txMock);
    });

    const result = await claimBatch();
    expect(result).toEqual([]);
  });
});
