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

import { POST } from '@/app/api/v1/orders/[id]/transition/route';

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

  it('emits a notification for a fresh transition to a mapped status', async () => {
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
    expect(emitNotificationEventMock).toHaveBeenCalledTimes(1);
    expect(emitNotificationEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'order.ready', sourceEntityId: ORDER_ID }),
    );
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
