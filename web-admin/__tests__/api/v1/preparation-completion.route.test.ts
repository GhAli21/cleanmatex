/** @jest-environment node */

import { NextRequest } from 'next/server';

const validateCSRFMock = jest.fn();
const requireAllPermissionsFactory = jest.fn();
const allPermissionsHandler = jest.fn();
const isPreparationEnabledMock = jest.fn();
const listAvailableActionsMock = jest.fn();
const completePreparationCommandMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...args: unknown[]) => validateCSRFMock(...args),
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requireAllPermissions: (...args: unknown[]) => requireAllPermissionsFactory(...args),
}));

jest.mock('@/lib/config/features', () => ({
  isPreparationEnabled: () => isPreparationEnabledMock(),
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  ...jest.requireActual('@/lib/services/workflow/workflow-engine.service'),
  listAvailableActions: (...args: unknown[]) => listAvailableActionsMock(...args),
}));

jest.mock('@/lib/services/preparation/preparation-completion.service', () => ({
  ...jest.requireActual('@/lib/services/preparation/preparation-completion.service'),
  completePreparationCommand: (...args: unknown[]) => completePreparationCommandMock(...args),
}));

import { POST } from '@/app/api/v1/preparation/[id]/complete/route';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Preparation User',
};
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/v1/preparation/${ORDER_ID}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/preparation/[id]/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateCSRFMock.mockResolvedValue(null);
    isPreparationEnabledMock.mockReturnValue(true);
    allPermissionsHandler.mockResolvedValue(AUTH_CONTEXT);
    requireAllPermissionsFactory.mockReturnValue(allPermissionsHandler);
    listAvailableActionsMock.mockResolvedValue({ stateVersion: 7 });
    completePreparationCommandMock.mockResolvedValue({
      orderId: ORDER_ID,
      readyBy: '2026-08-14T09:00:00.000Z',
      workflow: { ok: true, currentStatus: 'processing', stateVersion: 8 },
    });
  });

  it('uses authenticated tenant context and forwards the replay key to the command', async () => {
    const response = await POST(
      request(
        { internalNotes: 'Items checked and prepared.' },
        { 'Idempotency-Key': 'prep-command-001' },
      ),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'orders:update',
      'orders:transition',
    ]);
    expect(listAvailableActionsMock).toHaveBeenCalledWith({
      tenantId: AUTH_CONTEXT.tenantId,
      orderId: ORDER_ID,
      screen: 'preparation',
    });
    expect(completePreparationCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: AUTH_CONTEXT.tenantId,
      actorUserId: AUTH_CONTEXT.userId,
      expectedStateVersion: 7,
      idempotencyKey: 'prep-command-001',
      internalNotes: 'Items checked and prepared.',
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { currentStatus: 'processing', stateVersion: 8 },
    });
  });

  it('rejects requests without a replay key before invoking the command', async () => {
    const response = await POST(request({}), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(completePreparationCommandMock).not.toHaveBeenCalled();
  });

  it('maps workflow version conflicts for a safe client retry', async () => {
    completePreparationCommandMock.mockRejectedValue(
      new WorkflowEngineError('VERSION_CONFLICT', 'The order changed.', []),
    );

    const response = await POST(
      request({}, { 'Idempotency-Key': 'prep-command-002' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VERSION_CONFLICT',
    });
  });
});
