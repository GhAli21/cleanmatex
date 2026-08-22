/** @jest-environment node */

import { NextRequest } from 'next/server';

const validateCSRFMock = jest.fn();
const requireRequestPermissionMock = jest.fn();
const usesBearerAuthenticationMock = jest.fn();
const executeWorkflowStageCommandMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...args: unknown[]) => validateCSRFMock(...args),
}));

jest.mock('@/lib/auth/request-permission-auth', () => ({
  requireRequestPermission: (...args: unknown[]) => requireRequestPermissionMock(...args),
  usesBearerAuthentication: (...args: unknown[]) => usesBearerAuthenticationMock(...args),
}));

jest.mock('@/lib/services/workflow/workflow-stage-command.service', () => ({
  executeWorkflowStageCommand: (...args: unknown[]) => executeWorkflowStageCommandMock(...args),
}));

import { POST } from '@/app/api/v1/processing/[id]/complete/route';
import { POST as POST_FAIL_QA } from '@/app/api/v1/qa/[id]/fail/route';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import { resolveWorkflowStageCommandTarget } from '@/lib/workflow/workflow-stage-command-paths';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Processing User',
};
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/v1/processing/${ORDER_ID}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('stage-owned workflow command adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateCSRFMock.mockResolvedValue(null);
    requireRequestPermissionMock.mockResolvedValue({ ...AUTH_CONTEXT, mode: 'session' });
    usesBearerAuthenticationMock.mockReturnValue(false);
    executeWorkflowStageCommandMock.mockResolvedValue({
      ok: true,
      currentStatus: 'assembly',
      stateVersion: 8,
    });
  });

  it('maps floor actions to versioned stage paths without a destination guess', () => {
    expect(
      resolveWorkflowStageCommandTarget('processing', WORKFLOW_ACTIONS.COMPLETE_PROCESSING)?.path(ORDER_ID),
    ).toBe(`/api/v1/processing/${ORDER_ID}/complete`);
    expect(
      resolveWorkflowStageCommandTarget('qa', WORKFLOW_ACTIONS.FAIL_QA)?.path(ORDER_ID),
    ).toBe(`/api/v1/qa/${ORDER_ID}/fail`);
    expect(
      resolveWorkflowStageCommandTarget('ready_release', WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP)?.path(ORDER_ID),
    ).toBe(`/api/v1/ready/${ORDER_ID}/release-pickup`);
    expect(resolveWorkflowStageCommandTarget('canceling', WORKFLOW_ACTIONS.CANCEL_ORDER)).toBeNull();
  });

  it('rejects client-supplied tenant fields instead of trusting the body', async () => {
    const response = await POST(
      request(
        { expectedStateVersion: 7, rackLocation: 'RACK-A1', tenantId: 'attacker-tenant' },
        { 'Idempotency-Key': 'processing-command-reject-tenant' },
      ),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(executeWorkflowStageCommandMock).not.toHaveBeenCalled();
  });

  it('executes COMPLETE_PROCESSING with authenticated tenant context only', async () => {
    const response = await POST(
      request(
        { expectedStateVersion: 7, rackLocation: 'RACK-A1' },
        { 'Idempotency-Key': 'processing-command-001' },
      ),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(requireRequestPermissionMock).toHaveBeenCalledWith(expect.anything(), 'orders:transition');
    expect(executeWorkflowStageCommandMock).toHaveBeenCalledWith({
      tenantId: AUTH_CONTEXT.tenantId,
      orderId: ORDER_ID,
      actorUserId: AUTH_CONTEXT.userId,
      actorName: AUTH_CONTEXT.userName,
      screen: 'processing',
      actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
      expectedStateVersion: 7,
      idempotencyKey: 'processing-command-001',
      channel: 'staff_web',
      input: { rackLocation: 'RACK-A1' },
    });
    expect(response.status).toBe(200);
  });

  it('rejects a missing replay key before invoking the command', async () => {
    const response = await POST(
      request({ expectedStateVersion: 7 }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(executeWorkflowStageCommandMock).not.toHaveBeenCalled();
  });

  it('accepts bearer authentication without applying browser CSRF validation', async () => {
    usesBearerAuthenticationMock.mockReturnValue(true);
    requireRequestPermissionMock.mockResolvedValue({ ...AUTH_CONTEXT, mode: 'bearer' });

    const response = await POST(
      request(
        { expectedStateVersion: 7 },
        { Authorization: 'Bearer mobile-access-token', 'Idempotency-Key': 'processing-command-bearer' },
      ),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(validateCSRFMock).not.toHaveBeenCalled();
    expect(executeWorkflowStageCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'mobile' }),
    );
  });

  it('maps workflow version conflicts for a safe client retry', async () => {
    executeWorkflowStageCommandMock.mockRejectedValue(
      new WorkflowEngineError('VERSION_CONFLICT', 'The order changed.', []),
    );

    const response = await POST(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'processing-command-002' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VERSION_CONFLICT',
    });
  });

  it('maps a broken semantic snapshot as a conflict instead of a validation error', async () => {
    executeWorkflowStageCommandMock.mockRejectedValue(
      new WorkflowEngineError('PROFILE_SNAPSHOT_INCOMPLETE', 'The order has an incomplete semantic workflow snapshot.'),
    );

    const response = await POST(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'processing-command-profile' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'PROFILE_SNAPSHOT_INCOMPLETE',
    });
  });

  it('fails closed when FAIL_QA is submitted without an auditable reason', async () => {
    const response = await POST_FAIL_QA(
      request({ expectedStateVersion: 7 }, { 'Idempotency-Key': 'qa-fail-001' }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(executeWorkflowStageCommandMock).not.toHaveBeenCalled();
  });
});
