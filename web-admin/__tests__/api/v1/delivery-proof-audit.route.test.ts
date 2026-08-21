/** @jest-environment node */

import type { NextRequest } from 'next/server';

const requirePermissionFactory = jest.fn();
const permissionHandler = jest.fn();
const getOrderAuditMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionFactory(...args),
}));

jest.mock('@/lib/services/delivery/delivery-proof-audit.service', () => ({
  DeliveryProofAuditService: {
    getOrderAudit: (...args: unknown[]) => getOrderAuditMock(...args),
  },
}));

import { GET } from '@/app/api/v1/delivery/orders/[orderId]/proof/route';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-8222-222222222222';

describe('GET /api/v1/delivery/orders/[orderId]/proof', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionHandler.mockResolvedValue({ tenantId: TENANT_ID, userId: '33333333-3333-3333-8333-333333333333' });
    requirePermissionFactory.mockReturnValue(permissionHandler);
  });

  it('uses the authenticated tenant and does not accept tenant scope from the caller', async () => {
    getOrderAuditMock.mockResolvedValue({ order: { id: ORDER_ID }, entries: [] });

    const response = await GET({} as NextRequest, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(requirePermissionFactory).toHaveBeenCalledWith('orders:read');
    expect(getOrderAuditMock).toHaveBeenCalledWith(TENANT_ID, ORDER_ID);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { order: { id: ORDER_ID } } });
  });

  it('returns a stable not-found response when the order is outside the tenant scope', async () => {
    getOrderAuditMock.mockResolvedValue(null);

    const response = await GET({} as NextRequest, { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });
});
