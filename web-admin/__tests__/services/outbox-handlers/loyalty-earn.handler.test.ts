/**
 * Tests: outbox-handlers/loyalty-earn.handler (B7 / H7, D27)
 *
 * Covers:
 * - reconciles the event's order inside one transaction
 * - idempotency key is `loyalty-<trigger>-<sourceId>`
 * - events without a trigger fall back to a per-event key
 */

const mockTransaction = jest.fn();
const mockReconcile = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/loyalty.service', () => ({
  reconcileOrderLoyaltyEarnTx: (...a: unknown[]) => mockReconcile(...a),
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
    payload: { trigger: 'ORDER_FIN_RECALC', sourceId: 'trace-1' },
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

describe('processLoyaltyEarnEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  });

  it('reconciles the order with the trigger + source idempotency key', async () => {
    await processLoyaltyEarnEvent(makeEvent());
    expect(mockReconcile).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT, orderId: 'order-1', idempotencyKey: 'loyalty-ORDER_FIN_RECALC-trace-1',
    });
  });

  it('falls back to a per-event key when the payload has no trigger', async () => {
    await processLoyaltyEarnEvent(makeEvent({ payload: { customerId: 'cust-1', orderAmount: 100 } }));
    expect(mockReconcile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: 'loyalty-earn-evt-loyalty-1',
    }));
  });
});
