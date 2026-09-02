/** @jest-environment node */

import { NextRequest } from 'next/server';

const validateCSRFMock = jest.fn();
const requireRequestPermissionMock = jest.fn();
const usesBearerAuthenticationMock = jest.fn();
const completePickupMock = jest.fn();
const getMyActivePosSessionMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...args: unknown[]) => validateCSRFMock(...args),
}));

jest.mock('@/lib/auth/request-permission-auth', () => ({
  requireRequestPermission: (...args: unknown[]) => requireRequestPermissionMock(...args),
  usesBearerAuthentication: (...args: unknown[]) => usesBearerAuthenticationMock(...args),
}));

jest.mock('@/lib/services/pos-session.service', () => ({
  getMyActivePosSession: (...args: unknown[]) => getMyActivePosSessionMock(...args),
}));

jest.mock('@/lib/services/pickup/pickup-completion.service', () => ({
  ...jest.requireActual('@/lib/services/pickup/pickup-completion.service'),
  completePickup: (...args: unknown[]) => completePickupMock(...args),
}));

import { POST } from '@/app/api/v1/pickup/orders/[orderId]/complete/route';
import { PickupCompletionError } from '@/lib/services/pickup/pickup-completion.service';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Counter User',
};
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/v1/pickup/orders/${ORDER_ID}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/pickup/orders/[orderId]/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateCSRFMock.mockResolvedValue(null);
    requireRequestPermissionMock.mockResolvedValue({ ...AUTH_CONTEXT, mode: 'session' });
    usesBearerAuthenticationMock.mockReturnValue(false);
    getMyActivePosSessionMock.mockResolvedValue({ type: 'NONE' });
    completePickupMock.mockResolvedValue({
      orderId: ORDER_ID,
      releaseIds: ['44444444-4444-4444-4444-444444444444'],
      workflow: { ok: true, currentStatus: 'delivered', stateVersion: 8 },
    });
  });

  it('uses authenticated tenant context and rejects client-supplied actor fields', async () => {
    const response = await POST(
      request(
        {
          expectedStateVersion: 7,
          handoverNotes: 'Collected at the branch counter.',
          tenantId: 'attacker-controlled-tenant',
          actorUserId: 'attacker-controlled-user',
        },
        { 'Idempotency-Key': 'pickup-command-001' },
      ),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(completePickupMock).not.toHaveBeenCalled();
  });

  it('uses only the authenticated tenant and actor for a valid request', async () => {
    const response = await POST(
      request(
        { expectedStateVersion: 7, handoverNotes: 'Collected at the branch counter.' },
        { 'Idempotency-Key': 'pickup-command-001' },
      ),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(requireRequestPermissionMock).toHaveBeenCalledWith(expect.anything(), 'orders:transition');
    expect(completePickupMock).toHaveBeenCalledWith({
      tenantId: AUTH_CONTEXT.tenantId,
      orderId: ORDER_ID,
      actorUserId: AUTH_CONTEXT.userId,
      actorName: AUTH_CONTEXT.userName,
      expectedStateVersion: 7,
      handoverNotes: 'Collected at the branch counter.',
      idempotencyKey: 'pickup-command-001',
      channel: 'staff_web',
    });
    expect(response.status).toBe(200);
  });

  it('rejects a missing replay key before invoking the command', async () => {
    const response = await POST(
      request({ expectedStateVersion: 7 }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(completePickupMock).not.toHaveBeenCalled();
  });

  it('accepts bearer authentication without applying browser CSRF validation', async () => {
    usesBearerAuthenticationMock.mockReturnValue(true);
    requireRequestPermissionMock.mockResolvedValue({ ...AUTH_CONTEXT, mode: 'bearer' });

    const response = await POST(
      request(
        { expectedStateVersion: 7 },
        { Authorization: 'Bearer mobile-access-token', 'Idempotency-Key': 'pickup-command-bearer' },
      ),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(validateCSRFMock).not.toHaveBeenCalled();
    expect(requireRequestPermissionMock).toHaveBeenCalledWith(expect.anything(), 'orders:transition');
    expect(completePickupMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'mobile' }),
    );
  });

  it('assigns pos when the actor has a verified OPEN POS session', async () => {
    getMyActivePosSessionMock.mockResolvedValueOnce({
      type: 'ACTIVE',
      session: { status: 'OPEN', branch_id: AUTH_CONTEXT.tenantId },
    });

    const response = await POST(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'pickup-command-pos' }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(completePickupMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'pos' }),
    );
  });

  it('rejects a malformed order ID before authentication or command execution', async () => {
    const response = await POST(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'pickup-command-invalid-id' }),
      { params: Promise.resolve({ orderId: 'not-a-uuid' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(requireRequestPermissionMock).not.toHaveBeenCalled();
    expect(completePickupMock).not.toHaveBeenCalled();
  });

  it('returns the collection gate result without allowing a status bypass', async () => {
    completePickupMock.mockRejectedValue(
      new PickupCompletionError(
        'PICKUP_COLLECTION_REQUIRED',
        'Collect the remaining pay-on-collection balance before confirming pickup.',
        422,
      ),
    );

    const response = await POST(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'pickup-command-002' }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'PICKUP_COLLECTION_REQUIRED',
    });
  });
});
