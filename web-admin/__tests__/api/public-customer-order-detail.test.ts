/** @jest-environment node */

/**
 * Tests: GET /api/v1/public/customer/orders/[orderNo] — BF-16 follow-up
 *
 * The mobile customer app's secure replacement for the retired readable
 * order path. The tenant id is trusted only after the bearer token resolves
 * to a customer session of that tenant, and the order is returned only when
 * it belongs to that customer (same tenant + session phone).
 */

import { NextRequest } from 'next/server';

const mockResolveSession = jest.fn();
const mockGetOwned = jest.fn();

jest.mock('@/lib/services/customer-mobile-session.service', () => ({
  resolveCustomerMobileSession: (...a: unknown[]) => mockResolveSession(...a),
}));

jest.mock('@/lib/services/public-order-tracking.service', () => ({
  getCustomerOwnedOrderTrackingResponse: (...a: unknown[]) => mockGetOwned(...a),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/utils/public-api-log-context', () => ({
  buildPublicApiLogContext: jest.fn(() => ({})),
}));

import { GET } from '@/app/api/v1/public/customer/orders/[orderNo]/route';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER_NO = 'ORD-20261023-0001';

function makeRequest(opts: { tenantId?: string; token?: string } = {}) {
  const url = new URL(`http://localhost/api/v1/public/customer/orders/${ORDER_NO}`);
  if (opts.tenantId !== undefined) url.searchParams.set('tenantId', opts.tenantId);
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return new NextRequest(url, { headers });
}

const params = Promise.resolve({ orderNo: ORDER_NO });

describe('customer order detail route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a request without a bearer token (400) and never loads an order', async () => {
    const response = await GET(makeRequest({ tenantId: TENANT }), { params });

    expect(response.status).toBe(400);
    expect(mockResolveSession).not.toHaveBeenCalled();
    expect(mockGetOwned).not.toHaveBeenCalled();
  });

  it('rejects a token that does not resolve for the tenant (401)', async () => {
    mockResolveSession.mockResolvedValue(null);

    const response = await GET(makeRequest({ tenantId: TENANT, token: 'bad-token' }), { params });

    expect(response.status).toBe(401);
    expect(mockResolveSession).toHaveBeenCalledWith({ tenantId: TENANT, verificationToken: 'bad-token' });
    expect(mockGetOwned).not.toHaveBeenCalled();
  });

  it('loads the order scoped to the resolved session tenant and customer phone', async () => {
    mockResolveSession.mockResolvedValue({
      customerId: 'cust-1',
      phoneNumber: '+96890000000',
      tenantOrgId: TENANT,
    });
    mockGetOwned.mockResolvedValue({ status: 200, body: { success: true, data: { order: {} } } });

    const response = await GET(makeRequest({ tenantId: TENANT, token: 'good-token' }), { params });

    expect(response.status).toBe(200);
    expect(mockGetOwned).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      orderNo: ORDER_NO,
      customerPhone: '+96890000000',
    });
  });

  it("answers 404 for another customer's order (no difference from a missing one)", async () => {
    mockResolveSession.mockResolvedValue({
      customerId: 'cust-1',
      phoneNumber: '+96890000000',
      tenantOrgId: TENANT,
    });
    mockGetOwned.mockResolvedValue({ status: 404, body: { success: false, error: 'Order not found' } });

    const response = await GET(makeRequest({ tenantId: TENANT, token: 'good-token' }), { params });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Order not found' });
  });
});
