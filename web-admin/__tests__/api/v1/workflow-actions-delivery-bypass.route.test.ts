/** @jest-environment node */

import { NextRequest } from 'next/server';

const requirePermissionMock = jest.fn();
const executeActionMock = jest.fn();
const executeCancelOrReturnActionMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => requirePermissionMock,
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  ...jest.requireActual('@/lib/services/workflow/workflow-engine.service'),
  executeAction: (...args: unknown[]) => executeActionMock(...args),
}));

jest.mock('@/lib/services/workflow/cancel-return-orchestrator.service', () => ({
  ...jest.requireActual('@/lib/services/workflow/cancel-return-orchestrator.service'),
  executeCancelOrReturnAction: (...args: unknown[]) => executeCancelOrReturnActionMock(...args),
}));

import { POST } from '@/app/api/v1/orders/[id]/actions/route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Staff User',
};

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/actions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': 'staff-delivery-bypass-001',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/orders/[id]/actions staff delivery bypass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue(AUTH_CONTEXT);
  });

  it('rejects CONFIRM_DELIVERY so staff cannot skip POD, stop, and route writes', async () => {
    const response = await POST(
      request({
        screen: 'driver_delivery',
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        expectedStateVersion: 4,
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'USE_DELIVERY_COMPLETE_COMMAND',
    });
    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it('derives staff_web from a cookie session and ignores a client channel field', async () => {
    executeActionMock.mockResolvedValue({
      ok: true,
      currentStatus: 'processing',
      stateVersion: 5,
    });

    const response = await POST(
      request({
        screen: 'processing',
        actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
        expectedStateVersion: 4,
        channel: 'public_web',
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(executeActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        screen: 'processing',
        actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
        channel: 'staff_web',
      }),
    );
  });
});
