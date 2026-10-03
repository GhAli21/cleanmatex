/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const requirePermissionMock = jest.fn();
const getOrderChangeContextMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (...args: unknown[]) => requirePermissionMock(...args) }));
jest.mock('@/lib/services/order-change/order-change-context.service', () => ({
  getOrderChangeContext: (...args: unknown[]) => getOrderChangeContextMock(...args),
  OrderChangeContextError: class OrderChangeContextError extends Error { code = 'ORDER_NOT_COMMITTED'; status = 422; },
}));

import { GET } from '@/app/api/v1/orders/[id]/change-context/route';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

describe('GET /api/v1/orders/[id]/change-context', () => {
  beforeEach(() => jest.resetAllMocks());

  it('uses existing read permission and derives tenant for the context loader', async () => {
    requirePermissionMock.mockReturnValue(async () => ({ tenantId: TENANT_ID, userId: '33333333-3333-3333-3333-333333333333' }));
    getOrderChangeContextMock.mockResolvedValue({ orderId: ORDER_ID });
    const response = await GET(new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/change-context`), { params: Promise.resolve({ id: ORDER_ID }) });
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:read');
    expect(getOrderChangeContextMock).toHaveBeenCalledWith({ tenantId: TENANT_ID, orderId: ORDER_ID });
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { orderId: ORDER_ID } });
  });

  it('returns the V3 envelope without invoking the loader when permission is denied', async () => {
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({ error: 'Denied' }, { status: 403 }));
    const response = await GET(new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/change-context`), { params: Promise.resolve({ id: ORDER_ID }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(getOrderChangeContextMock).not.toHaveBeenCalled();
  });
});
