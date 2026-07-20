/**
 * Tests: outbox-handlers/loyalty-earn.handler (B7 / H7)
 *
 * Covers:
 * - computes earnPoints from orderAmount * program.earn_rate_per_unit
 * - derives a deterministic idempotencyKey from the outbox event id
 * - skips (no-op, not an error) when the tenant has no active loyalty program
 * - skips when the computed earnPoints rounds down to zero
 * - throws when the LOYALTY_EARN payload is missing customerId/orderAmount
 */

const mockProgramFindFirst = jest.fn();
const mockTransaction = jest.fn();
const mockProcessEarnPoints = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/loyalty.service', () => ({
  processEarnPoints: (...a: unknown[]) => mockProcessEarnPoints(...a),
}));

import { processLoyaltyEarnEvent } from '@/lib/services/outbox-handlers/loyalty-earn.handler';
import type { OutboxEventRow } from '@/lib/services/outbox.service';

const TENANT = 'tenant-loyalty-001';

function makeEvent(overrides: Partial<OutboxEventRow> = {}): OutboxEventRow {
  return {
    id: 'evt-loyalty-1',
    tenant_org_id: TENANT,
    event_type: 'LOYALTY_EARN',
    aggregate_type: 'order',
    aggregate_id: 'order-1',
    payload: { customerId: 'cust-1', orderAmount: 100 },
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

function makeTx() {
  return {
    org_loyalty_programs_cf: {
      findFirst: (...a: unknown[]) => mockProgramFindFirst(...a),
    },
  };
}

describe('processLoyaltyEarnEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('computes earnPoints = floor(orderAmount * earn_rate_per_unit) and calls processEarnPoints with a deterministic idempotency key', async () => {
    mockProgramFindFirst.mockResolvedValue({ earn_rate_per_unit: 1.5 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));
    mockProcessEarnPoints.mockResolvedValue({});

    await processLoyaltyEarnEvent(makeEvent({ payload: { customerId: 'cust-1', orderAmount: 100 } }));

    expect(mockProcessEarnPoints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        customerId: 'cust-1',
        orderId: 'order-1',
        earnPoints: 150, // floor(100 * 1.5)
        monetaryValue: 100,
        idempotencyKey: 'loyalty-earn-evt-loyalty-1',
      })
    );
  });

  it('floors fractional points rather than rounding', async () => {
    mockProgramFindFirst.mockResolvedValue({ earn_rate_per_unit: 0.333 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));
    mockProcessEarnPoints.mockResolvedValue({});

    await processLoyaltyEarnEvent(makeEvent({ payload: { customerId: 'cust-1', orderAmount: 10 } }));

    expect(mockProcessEarnPoints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ earnPoints: 3 }) // floor(10 * 0.333) = floor(3.33) = 3
    );
  });

  it('skips (no error) when the tenant has no active loyalty program', async () => {
    mockProgramFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));

    await expect(processLoyaltyEarnEvent(makeEvent())).resolves.toBeUndefined();
    expect(mockProcessEarnPoints).not.toHaveBeenCalled();
  });

  it('skips when earnPoints rounds down to zero (no meaningful credit)', async () => {
    mockProgramFindFirst.mockResolvedValue({ earn_rate_per_unit: 0.001 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));

    await processLoyaltyEarnEvent(makeEvent({ payload: { customerId: 'cust-1', orderAmount: 0.5 } }));

    expect(mockProcessEarnPoints).not.toHaveBeenCalled();
  });

  it('throws when the payload is missing customerId or orderAmount (never silently guesses)', async () => {
    await expect(
      processLoyaltyEarnEvent(makeEvent({ payload: { orderAmount: 100 } }))
    ).rejects.toThrow(/payload missing/);
    await expect(
      processLoyaltyEarnEvent(makeEvent({ payload: { customerId: 'cust-1' } }))
    ).rejects.toThrow(/payload missing/);
  });
});
