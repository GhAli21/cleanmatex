/** @jest-environment node */

const getMyActivePosSessionMock = jest.fn();

jest.mock('@/lib/services/pos-session.service', () => ({
  getMyActivePosSession: (...args: unknown[]) => getMyActivePosSessionMock(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn() },
}));

import { NextRequest } from 'next/server';
import { resolvePosEligibleWorkflowCommandChannel } from '@/lib/api/workflow-command-pos-channel';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const BRANCH_ID = '33333333-3333-3333-3333-333333333333';

function cookieRequest() {
  return new NextRequest('http://localhost/api/v1/pickup/orders/id/complete', { method: 'POST' });
}

function bearerRequest() {
  return new NextRequest('http://localhost/api/v1/pickup/orders/id/complete', {
    method: 'POST',
    headers: { Authorization: 'Bearer mobile-access-token' },
  });
}

describe('resolvePosEligibleWorkflowCommandChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps bearer callers on mobile without consulting the POS session', async () => {
    await expect(resolvePosEligibleWorkflowCommandChannel({
      request: bearerRequest(),
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderBranchId: BRANCH_ID,
    })).resolves.toBe('mobile');

    expect(getMyActivePosSessionMock).not.toHaveBeenCalled();
  });

  it('assigns pos only for a cookie session with a tenant-scoped OPEN till', async () => {
    getMyActivePosSessionMock.mockResolvedValueOnce({
      type: 'ACTIVE',
      session: { status: 'OPEN', branch_id: BRANCH_ID },
    });

    await expect(resolvePosEligibleWorkflowCommandChannel({
      request: cookieRequest(),
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderBranchId: BRANCH_ID,
    })).resolves.toBe('pos');

    expect(getMyActivePosSessionMock).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      userId: USER_ID,
      branchId: BRANCH_ID,
    });
  });

  it('stays staff_web when the till is paused or at another branch', async () => {
    getMyActivePosSessionMock.mockResolvedValueOnce({
      type: 'ACTIVE',
      session: { status: 'PAUSED', branch_id: BRANCH_ID },
    });

    await expect(resolvePosEligibleWorkflowCommandChannel({
      request: cookieRequest(),
      tenantId: TENANT_ID,
      userId: USER_ID,
    })).resolves.toBe('staff_web');

    getMyActivePosSessionMock.mockResolvedValueOnce({
      type: 'BRANCH_CONFLICT',
      requestedBranchId: BRANCH_ID,
      activeBranchId: '44444444-4444-4444-4444-444444444444',
      activeSession: { status: 'OPEN', branch_id: '44444444-4444-4444-4444-444444444444' },
    });

    await expect(resolvePosEligibleWorkflowCommandChannel({
      request: cookieRequest(),
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderBranchId: BRANCH_ID,
    })).resolves.toBe('staff_web');
  });

  it('falls back to staff_web when POS lookup fails so handover is not blocked', async () => {
    getMyActivePosSessionMock.mockRejectedValueOnce(new Error('pos lookup unavailable'));

    await expect(resolvePosEligibleWorkflowCommandChannel({
      request: cookieRequest(),
      tenantId: TENANT_ID,
      userId: USER_ID,
    })).resolves.toBe('staff_web');
  });
});
