/** @jest-environment node */

import { NextRequest } from 'next/server';

const requirePermissionMock = jest.fn();
const executeActionMock = jest.fn();
const emitNotificationEventMock = jest.fn();
const queryRawMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => (request: unknown) =>
    requirePermissionMock(...args, request),
}));

jest.mock('@lib/notifications/event-emitter', () => ({
  emitNotificationEvent: (...args: unknown[]) => emitNotificationEventMock(...args),
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  ...jest.requireActual('@/lib/services/workflow/workflow-engine.service'),
  executeAction: (...args: unknown[]) => executeActionMock(...args),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) },
}));

jest.mock('@lib/notifications/config', () => ({
  isOrderTransitionNotifyEnabled: jest.fn().mockResolvedValue(false),
}));

import { POST } from '@/app/api/v1/orders/[id]/transition/route';
import { isOrderTransitionNotifyEnabled } from '@lib/notifications/config';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Counter User',
};
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/orders/[id]/transition — replay must not re-notify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue(AUTH_CONTEXT);
  });

  // `isOrderTransitionNotifyEnabled()` reads the Config Registry key
  // ntf.app.order_transition_notify (env NTF_ORDER_TRANSITION_NOTIFY wins).
  // Default false. Mocked here so the route test needs no registry row.
  it('does not notify a fresh transition while notify is administratively disabled', async () => {
    executeActionMock.mockResolvedValue({ ok: true, currentStatus: 'ready', stateVersion: 2 });

    const response = await POST(
      request({
        screen: 'preparation',
        actionCode: 'MARK_READY',
        expectedStateVersion: 1,
        idempotencyKey: 'order-transition-001',
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(emitNotificationEventMock).not.toHaveBeenCalled();
  });

  it('does not re-notify when executeAction returns a cached idempotent replay', async () => {
    executeActionMock.mockResolvedValue({
      ok: true,
      currentStatus: 'ready',
      stateVersion: 2,
      replay: true,
    });

    const response = await POST(
      request({
        screen: 'preparation',
        actionCode: 'MARK_READY',
        expectedStateVersion: 1,
        idempotencyKey: 'order-transition-001',
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(emitNotificationEventMock).not.toHaveBeenCalled();
  });

  it('does not notify when NTF_ORDER_TRANSITION_NOTIFY=false, even for a fresh transition', async () => {
    const original = process.env.NTF_ORDER_TRANSITION_NOTIFY;
    process.env.NTF_ORDER_TRANSITION_NOTIFY = 'false';
    try {
      executeActionMock.mockResolvedValue({ ok: true, currentStatus: 'ready', stateVersion: 2 });

      const response = await POST(
        request({
          screen: 'preparation',
          actionCode: 'MARK_READY',
          expectedStateVersion: 1,
          idempotencyKey: 'order-transition-001',
        }),
        { params: Promise.resolve({ id: ORDER_ID }) },
      );

      expect(response.status).toBe(200);
      expect(emitNotificationEventMock).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.NTF_ORDER_TRANSITION_NOTIFY;
      else process.env.NTF_ORDER_TRANSITION_NOTIFY = original;
    }
  });
});

describe('POST /api/v1/orders/[id]/transition — notification shows the order number (Human-Friendly Codes T8.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue(AUTH_CONTEXT);
    (isOrderTransitionNotifyEnabled as jest.Mock).mockResolvedValueOnce(true);
  });

  it('sends order_number = order_no, not the UUID', async () => {
    executeActionMock.mockResolvedValue({ ok: true, currentStatus: 'ready', stateVersion: 2 });
    queryRawMock.mockResolvedValueOnce([{ order_no: 'ORD-20261031-0007' }]);

    const response = await POST(
      request({ screen: 'preparation', actionCode: 'MARK_READY', expectedStateVersion: 1, idempotencyKey: 'k-1' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(emitNotificationEventMock).toHaveBeenCalledTimes(1);
    expect(emitNotificationEventMock.mock.calls[0][0]).toMatchObject({
      code: 'order.ready',
      sourceEntityId: ORDER_ID,
      variables: { order_number: 'ORD-20261031-0007' },
    });
  });

  it('falls back to the id when the order number cannot be read', async () => {
    executeActionMock.mockResolvedValue({ ok: true, currentStatus: 'ready', stateVersion: 2 });
    queryRawMock.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(
      request({ screen: 'preparation', actionCode: 'MARK_READY', expectedStateVersion: 1, idempotencyKey: 'k-2' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(emitNotificationEventMock.mock.calls[0][0]).toMatchObject({ variables: { order_number: ORDER_ID } });
  });
});
