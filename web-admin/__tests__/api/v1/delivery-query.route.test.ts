/** @jest-environment node */

import type { NextRequest } from 'next/server';

const requireAllPermissionsFactory = jest.fn();
const permissionHandler = jest.fn();
const getRouteManifestMock = jest.fn();
const getStopMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requireAllPermissions: (...args: unknown[]) => requireAllPermissionsFactory(...args),
}));

jest.mock('@/lib/services/delivery/delivery-route-query.service', () => ({
  DeliveryRouteQueryService: {
    getRouteManifest: (...args: unknown[]) => getRouteManifestMock(...args),
    getStop: (...args: unknown[]) => getStopMock(...args),
  },
}));

import { GET as getRoute } from '@/app/api/v1/delivery/routes/[routeId]/route';
import { GET as getStop } from '@/app/api/v1/delivery/stops/[stopId]/route';

const AUTH_CONTEXT = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userName: 'Delivery Operator',
};

describe('delivery route and stop read contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionHandler.mockResolvedValue(AUTH_CONTEXT);
    requireAllPermissionsFactory.mockReturnValue(permissionHandler);
  });

  it('loads a route manifest only for the authenticated tenant', async () => {
    getRouteManifestMock.mockResolvedValue({ id: 'route-1', routeNumber: 'RT-001', stops: [] });

    const response = await getRoute({} as NextRequest, {
      params: Promise.resolve({ routeId: 'route-1' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith(['drivers:read', 'orders:read']);
    expect(getRouteManifestMock).toHaveBeenCalledWith(AUTH_CONTEXT.tenantId, 'route-1');
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: 'route-1' } });
  });

  it('returns a stable not-found result when the tenant cannot access the route', async () => {
    getRouteManifestMock.mockResolvedValue(null);

    const response = await getRoute({} as NextRequest, {
      params: Promise.resolve({ routeId: 'route-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });

  it('loads a stop only for the authenticated tenant', async () => {
    getStopMock.mockResolvedValue({ id: 'stop-1', routeId: 'route-1' });

    const response = await getStop({} as NextRequest, {
      params: Promise.resolve({ stopId: 'stop-1' }),
    });

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith(['drivers:read', 'orders:read']);
    expect(getStopMock).toHaveBeenCalledWith(AUTH_CONTEXT.tenantId, 'stop-1');
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: 'stop-1' } });
  });

  it('returns a stable not-found result when the tenant cannot access the stop', async () => {
    getStopMock.mockResolvedValue(null);

    const response = await getStop({} as NextRequest, {
      params: Promise.resolve({ stopId: 'stop-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'STOP_NOT_FOUND' });
  });
});
