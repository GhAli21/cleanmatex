/** @jest-environment node */

const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockRequirePermission = jest.fn();
const getMyActivePosSessionMock = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(
    async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
  ),
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: jest.fn(() => mockRequirePermission),
}));

jest.mock('@/lib/services/pos-session.service', () => ({
  getMyActivePosSession: (...args: unknown[]) => getMyActivePosSessionMock(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  WorkflowEngineError: class WorkflowEngineError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  executeAction: jest.fn(),
  listAvailableActions: jest.fn(),
}));

jest.mock('@/lib/constants/workflow-actions', () => ({
  WORKFLOW_ACTIONS: {
    CONFIRM_PHYSICAL_INTAKE: 'CONFIRM_PHYSICAL_INTAKE',
  },
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/orders/[id]/confirm-physical-intake/route';
import {
  executeAction,
  listAvailableActions,
  WorkflowEngineError,
} from '@/lib/services/workflow/workflow-engine.service';

describe('POST /api/v1/orders/[id]/confirm-physical-intake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermission.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      userName: 'Test User',
    });
    mockFindFirst.mockResolvedValue({
      id: 'order-1',
      current_status: 'draft',
      physical_intake_status: 'pending_dropoff',
      branch_id: 'branch-1',
      sys_order_sources_cd: { requires_remote_intake_confirm: true },
    });
    mockUpdate.mockResolvedValue({ id: 'order-1' });
    getMyActivePosSessionMock.mockResolvedValue({ type: 'NONE' });
    (listAvailableActions as jest.Mock).mockResolvedValue({ stateVersion: 5 });
    (executeAction as jest.Mock).mockResolvedValue({
      ok: true,
      currentStatus: 'intake',
      stateVersion: 6,
    });
  });

  it('uses the engine action and keeps the order update tenant-scoped', async () => {
    const request = new NextRequest(
      'https://cmx.cleanmatex.com/api/v1/orders/order-1/confirm-physical-intake',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': 'physical-intake-request-1',
        },
        body: JSON.stringify({ receivedInfo: 'Received at counter' }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' }) });

    expect(response.status).toBe(200);
    expect(listAvailableActions).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      screen: 'new_order',
      channel: 'staff_web',
    });
    expect(getMyActivePosSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-1',
      branchId: 'branch-1',
    }));
    expect(executeAction).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      screen: 'new_order',
      actionCode: 'CONFIRM_PHYSICAL_INTAKE',
      expectedStateVersion: 5,
      actorUserId: 'user-1',
      actorName: 'Test User',
      channel: 'staff_web',
      idempotencyKey: 'physical-intake-request-1',
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1', tenant_org_id: 'tenant-1' },
    }));
  });

  it('keeps an already received order idempotent without another engine action', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'order-1',
      physical_intake_status: 'received',
      sys_order_sources_cd: { requires_remote_intake_confirm: true },
    });
    const request = new NextRequest(
      'https://cmx.cleanmatex.com/api/v1/orders/order-1/confirm-physical-intake',
      { method: 'POST' },
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' }) });
    const payload = await response.json();

    expect(payload).toMatchObject({ success: true, data: { idempotent: true } });
    expect(listAvailableActions).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('maps an incomplete live-policy binding to HTTP 409', async () => {
    (executeAction as jest.Mock).mockRejectedValueOnce(
      new WorkflowEngineError(
        'PROFILE_SNAPSHOT_INCOMPLETE',
        'The order has an incomplete workflow profile binding.',
      ),
    );
    const request = new NextRequest(
      'https://cmx.cleanmatex.com/api/v1/orders/order-1/confirm-physical-intake',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': 'physical-intake-profile-409',
        },
        body: JSON.stringify({ receivedInfo: 'Received at counter' }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'PROFILE_SNAPSHOT_INCOMPLETE',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
