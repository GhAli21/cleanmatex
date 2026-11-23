/**
 * Tests: outbox-handlers/loyalty-earn.handler (B7 / H7, D27)
 *
 * Covers:
 * - reconciles the event's order on the reaction transaction it is given
 * - idempotency key is `loyalty-<trigger>-<sourceId>`
 * - events without a trigger fall back to a per-event key
 */

const mockReconcile = jest.fn();

jest.mock('@/lib/services/loyalty.service', () => ({
  reconcileOrderLoyaltyEarnTx: (...a: unknown[]) => mockReconcile(...a),
}));

import { processLoyaltyEarnEvent } from '@/lib/services/outbox-handlers/loyalty-earn.handler';
import type { DomainEventRow } from '@/lib/types/domain-event';
import type { Prisma } from '@prisma/client';

const TENANT = 'tenant-loyalty-001';

const TX = { marker: 'reaction-tx' } as unknown as Prisma.TransactionClient;

function makeEvent(overrides: Partial<DomainEventRow> = {}): DomainEventRow {
  return {
    id: 'evt-loyalty-1',
    tenant_org_id: TENANT,
    event_type: 'LOYALTY_EARN_RECALC_REQUESTED',
    aggregate_type: 'order',
    aggregate_id: 'order-1',
    payload: { trigger: 'ORDER_FIN_RECALC', sourceId: 'trace-1' },
    created_at: new Date(),
    ...overrides,
  };
}

describe('processLoyaltyEarnEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reconciles the order with the trigger + source idempotency key', async () => {
    await processLoyaltyEarnEvent(TX, makeEvent());
    expect(mockReconcile).toHaveBeenCalledWith(TX, {
      tenantId: TENANT, orderId: 'order-1', idempotencyKey: 'loyalty-ORDER_FIN_RECALC-trace-1',
    });
  });

  it('falls back to a per-event key when the payload has no trigger', async () => {
    await processLoyaltyEarnEvent(TX, makeEvent({ payload: { customerId: 'cust-1', orderAmount: 100 } }));
    expect(mockReconcile).toHaveBeenCalledWith(TX, expect.objectContaining({
      idempotencyKey: 'loyalty-earn-evt-loyalty-1',
    }));
  });
});
