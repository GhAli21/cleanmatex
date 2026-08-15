/** @jest-environment node */

import type { NextRequest } from 'next/server';

const requireAllPermissionsFactory = jest.fn();
const permissionHandler = jest.fn();
const listDeliveryPodMethodsMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requireAllPermissions: (...args: unknown[]) => requireAllPermissionsFactory(...args),
}));

jest.mock('@/lib/services/delivery/delivery-pod-method.service', () => ({
  listDeliveryPodMethods: (...args: unknown[]) => listDeliveryPodMethodsMock(...args),
}));

import { GET } from '@/app/api/v1/delivery/pod-methods/route';

describe('GET /api/v1/delivery/pod-methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAllPermissionsFactory.mockReturnValue(permissionHandler);
    permissionHandler.mockResolvedValue({
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
    });
  });

  it('requires the same completion permissions and returns server-configured methods', async () => {
    listDeliveryPodMethodsMock.mockResolvedValue([{ code: 'SIGNATURE', name: 'Signature' }]);

    const response = await GET({} as NextRequest);

    expect(requireAllPermissionsFactory).toHaveBeenCalledWith(['delivery:pod', 'orders:transition']);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ code: 'SIGNATURE', name: 'Signature' }],
    });
  });
});
