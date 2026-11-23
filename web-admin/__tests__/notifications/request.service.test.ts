/**
 * Notification requests (Background Jobs step 5): the producer side.
 * - requestNotificationTx stores the request and queues ntf.orchestrate on the caller's transaction,
 *   job id = request id, payload ids only.
 * - emitNotificationEvent never throws into the business flow.
 * - deliverPriority orders urgent sends first and low ones last.
 * runNotificationRequest (the worker side) is proved on local Postgres by cmx-workers' tests.
 */

const mockRequestCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (...a: unknown[]) => mockTransaction(...a) },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_t: string, fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@lib/notifications/orchestrator', () => ({ orchestrateNotification: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { mockJobProducer } from '@cmx/jobs';
import type { Prisma } from '@prisma/client';
import { logger } from '@lib/utils/logger';
import { emitNotificationEvent } from '@lib/notifications/event-emitter';
import { deliverPriority, requestNotificationTx } from '@lib/notifications/request.service';
import { NOTIFICATION_PRIORITY, type NotificationEvent } from '@lib/notifications/types';

const TENANT = '11111111-1111-1111-1111-111111111111';
const event: NotificationEvent = {
  code: 'order.created',
  tenantOrgId: TENANT,
  recipientUserIds: ['22222222-2222-2222-2222-222222222222'],
  sourceEntityType: 'order',
  sourceEntityId: '33333333-3333-3333-3333-333333333333',
  variables: { order_number: 'ORD-1' },
  actionUrl: '/dashboard/orders/33333333-3333-3333-3333-333333333333',
};
const tx = { org_ntf_requests_tr: { create: (...a: unknown[]) => mockRequestCreate(...a) } } as unknown as Prisma.TransactionClient;

beforeEach(() => jest.clearAllMocks());

describe('requestNotificationTx', () => {
  it('stores the request and queues ntf.orchestrate on the same transaction with ids only', async () => {
    mockRequestCreate.mockResolvedValue({ id: 'req-1' });

    const id = await requestNotificationTx(tx, event);

    expect(id).toBe('req-1');
    expect(mockRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_org_id: TENANT,
        event_code: 'order.created',
        source_entity_type: 'order',
        source_entity_id: event.sourceEntityId,
        request_data: {
          recipientUserIds: event.recipientUserIds,
          variables: { order_number: 'ORD-1' },
          actionUrl: event.actionUrl,
        },
      }),
      select: { id: true },
    });
    expect(mockJobProducer.enqueue).toHaveBeenCalledWith(tx, 'ntf.orchestrate', { tenantOrgId: TENANT, requestId: 'req-1' }, { id: 'req-1' });
  });
});

describe('emitNotificationEvent', () => {
  it('records the request in its own transaction', async () => {
    mockRequestCreate.mockResolvedValue({ id: 'req-2' });
    mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await emitNotificationEvent(event);

    expect(mockJobProducer.enqueue).toHaveBeenCalledWith(tx, 'ntf.orchestrate', { tenantOrgId: TENANT, requestId: 'req-2' }, { id: 'req-2' });
  });

  it('never throws to the caller and logs the dropped notification as an error', async () => {
    mockTransaction.mockRejectedValue(new Error('db unavailable'));

    await expect(emitNotificationEvent(event)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('deliverPriority', () => {
  it('runs urgent sends first and low-priority ones last', () => {
    expect(deliverPriority(NOTIFICATION_PRIORITY.URGENT)).toBeGreaterThan(deliverPriority(NOTIFICATION_PRIORITY.HIGH));
    expect(deliverPriority(NOTIFICATION_PRIORITY.HIGH)).toBeGreaterThan(deliverPriority(undefined));
    expect(deliverPriority(undefined)).toBeGreaterThan(deliverPriority(NOTIFICATION_PRIORITY.LOW));
  });
});
