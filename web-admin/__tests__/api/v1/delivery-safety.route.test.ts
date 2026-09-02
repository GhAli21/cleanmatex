/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { File } from 'node:buffer';

const requirePermissionFactory = jest.fn();
const requireAllPermissionsFactory = jest.fn();
const permissionHandler = jest.fn();
const allPermissionsHandler = jest.fn();
const createRouteMock = jest.fn();
const capturePODMock = jest.fn();
const completeDeliveryMock = jest.fn();
const getMyActivePosSessionMock = jest.fn();
const createDeliveryEvidenceUploadMock = jest.fn();
const validateCSRFMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionFactory(...args),
  requireAllPermissions: (...args: unknown[]) => requireAllPermissionsFactory(...args),
}));

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...args: unknown[]) => validateCSRFMock(...args),
}));

jest.mock('@/lib/services/delivery-service', () => ({
  DeliveryService: {
    createRoute: (...args: unknown[]) => createRouteMock(...args),
    capturePOD: (...args: unknown[]) => capturePODMock(...args),
  },
}));

jest.mock('@/lib/services/delivery/delivery-completion.service', () => ({
  completeDelivery: (...args: unknown[]) => completeDeliveryMock(...args),
  DeliveryCompletionError: class DeliveryCompletionError extends Error {},
}));

jest.mock('@/lib/services/pos-session.service', () => ({
  getMyActivePosSession: (...args: unknown[]) => getMyActivePosSessionMock(...args),
}));

jest.mock('@/lib/services/delivery/delivery-evidence.service', () => ({
  createDeliveryEvidenceUpload: (...args: unknown[]) => createDeliveryEvidenceUploadMock(...args),
  DeliveryEvidenceError: class DeliveryEvidenceError extends Error {},
}));

jest.mock('@/lib/middleware/rate-limit', () => ({
  checkAPIRateLimitTenant: jest.fn(),
}));

import { POST as createRoute } from '@/app/api/v1/delivery/routes/route';
import { POST as capturePOD } from '@/app/api/v1/delivery/stops/[stopId]/pod/route';
import { POST as completeDelivery } from '@/app/api/v1/delivery/stops/[stopId]/complete/route';
import { POST as createEvidence } from '@/app/api/v1/delivery/stops/[stopId]/evidence/route';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import { NextResponse } from 'next/server';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

describe('delivery write safety boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionHandler.mockResolvedValue(AUTH_CONTEXT);
    allPermissionsHandler.mockResolvedValue(AUTH_CONTEXT);
    validateCSRFMock.mockResolvedValue(null);
    requirePermissionFactory.mockReturnValue(permissionHandler);
    requireAllPermissionsFactory.mockReturnValue(allPermissionsHandler);
    getMyActivePosSessionMock.mockResolvedValue({ type: 'NONE' });
  });

  it('fails route creation closed after authorization without calling the service', async () => {
    const response = await createRoute({} as NextRequest);

    expect(requirePermissionFactory).toHaveBeenCalledWith('delivery:routes');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DELIVERY_HARDENING_REQUIRED',
    });
    expect(createRouteMock).not.toHaveBeenCalled();
  });

  it('fails POD capture closed after both permissions without calling the service', async () => {
    const response = await capturePOD({} as NextRequest, {
      params: { stopId: '44444444-4444-4444-4444-444444444444' },
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'delivery:pod',
      'orders:transition',
    ]);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DELIVERY_HARDENING_REQUIRED',
    });
    expect(capturePODMock).not.toHaveBeenCalled();
  });

  it('allows the isolated atomic completion path without reopening legacy delivery writes', async () => {
    completeDeliveryMock.mockResolvedValue({
      stopId: '44444444-4444-4444-8444-444444444444',
      podId: '55555555-5555-4555-8555-555555555555',
      orderId: '66666666-6666-4666-8666-666666666666',
      workflow: { stateVersion: 2 },
    });
    const response = await completeDelivery(new Request('http://localhost/api/v1/delivery/stops/44444444-4444-4444-8444-444444444444/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedStateVersion: 1,
        idempotencyKey: 'delivery-complete-test',
        podMethodCode: 'PHOTO',
        photoEvidenceIds: ['77777777-7777-4777-8777-777777777777'],
      }),
    }) as NextRequest, {
      params: Promise.resolve({ stopId: '44444444-4444-4444-4444-444444444444' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'delivery:pod',
      'orders:transition',
    ]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
    expect(completeDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: AUTH_CONTEXT.tenantId,
      podMethodCode: 'PHOTO',
      channel: 'staff_web',
    }));
  });

  it('maps workflow version conflicts so the client can refresh and retry', async () => {
    completeDeliveryMock.mockRejectedValue(
      new WorkflowEngineError('VERSION_CONFLICT', 'The order changed.', []),
    );
    const response = await completeDelivery(new Request('http://localhost/api/v1/delivery/stops/44444444-4444-4444-8444-444444444444/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedStateVersion: 1,
        idempotencyKey: 'delivery-complete-conflict',
        podMethodCode: 'SIGNATURE',
        signatureEvidenceId: '77777777-7777-4777-8777-777777777777',
      }),
    }) as NextRequest, {
      params: Promise.resolve({ stopId: '44444444-4444-4444-8444-444444444444' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VERSION_CONFLICT',
    });
  });

  it('allows private evidence receipts only through the atomic completion path', async () => {
    createDeliveryEvidenceUploadMock.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      evidenceType: 'photo',
      expiresAt: '2026-08-15T10:00:00.000Z',
    });
    const form = new FormData();
    form.append('evidenceType', 'photo');
    form.append('file', new File([new Uint8Array([0xFF, 0xD8, 0xFF])], 'proof.jpeg', { type: 'image/jpeg' }));
    const response = await createEvidence(new Request('http://localhost/api/v1/delivery/stops/44444444-4444-4444-8444-444444444444/evidence', {
      method: 'POST',
      body: form,
    }) as NextRequest, {
      params: Promise.resolve({ stopId: '44444444-4444-4444-8444-444444444444' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'delivery:pod',
      'orders:transition',
    ]);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
    expect(createDeliveryEvidenceUploadMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: AUTH_CONTEXT.tenantId,
      evidenceType: 'photo',
    }));
  });

  it('rejects staff completion when delivery:pod and orders:transition are missing', async () => {
    const denied = NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    allPermissionsHandler.mockResolvedValue(denied);

    const response = await completeDelivery(new Request('http://localhost/api/v1/delivery/stops/44444444-4444-4444-8444-444444444444/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedStateVersion: 1,
        idempotencyKey: 'delivery-complete-rbac',
        podMethodCode: 'SIGNATURE',
        signatureEvidenceId: '77777777-7777-4777-8777-777777777777',
      }),
    }) as NextRequest, {
      params: Promise.resolve({ stopId: '44444444-4444-4444-4444-444444444444' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'delivery:pod',
      'orders:transition',
    ]);
    expect(response.status).toBe(403);
    expect(completeDeliveryMock).not.toHaveBeenCalled();
  });
});
