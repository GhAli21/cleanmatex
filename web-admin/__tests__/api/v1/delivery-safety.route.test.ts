/** @jest-environment node */

import type { NextRequest } from 'next/server';

const requirePermissionFactory = jest.fn();
const requireAllPermissionsFactory = jest.fn();
const permissionHandler = jest.fn();
const allPermissionsHandler = jest.fn();
const createRouteMock = jest.fn();
const capturePODMock = jest.fn();
const completeDeliveryMock = jest.fn();
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

import { POST as createRoute } from '@/app/api/v1/delivery/routes/route';
import { POST as capturePOD } from '@/app/api/v1/delivery/stops/[stopId]/pod/route';
import { POST as completeDelivery } from '@/app/api/v1/delivery/stops/[stopId]/complete/route';

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

  it('keeps the atomic completion endpoint fail-closed until release gates pass', async () => {
    const response = await completeDelivery({} as NextRequest, {
      params: Promise.resolve({ stopId: '44444444-4444-4444-4444-444444444444' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith([
      'delivery:pod',
      'orders:transition',
    ]);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DELIVERY_HARDENING_REQUIRED',
    });
    expect(completeDeliveryMock).not.toHaveBeenCalled();
  });
});
