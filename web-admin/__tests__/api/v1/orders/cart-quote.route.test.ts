/** @jest-environment node */
/**
 * P5-03 — POST /api/v1/orders/quote: the New Order cart reads the same
 * checkout quote as the payment modal and submit; tenant from the session.
 */

import { NextRequest, NextResponse } from 'next/server';

const requirePermissionMock = jest.fn();
const quoteCheckoutMock = jest.fn();
const toCartQuoteMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (...args: unknown[]) => requirePermissionMock(...args) }));
jest.mock('@/lib/services/price-override-policy.service', () => ({ assertPriceOverridesAllowed: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/services/commercial/commercial-checkout.service', () => ({
  quoteCheckout: (...args: unknown[]) => quoteCheckoutMock(...args),
}));
jest.mock('@/lib/services/commercial/commercial-cart-quote', () => ({
  toCartQuote: (...args: unknown[]) => toCartQuoteMock(...args),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn() } }));

import { POST } from '@/app/api/v1/orders/quote/route';
import { CommercialContextError } from '@/lib/services/commercial/commercial-context.loader';

const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/v1/orders/quote', { method: 'POST', body: JSON.stringify(body) }));
const body = {
  requestId: 'r-1',
  items: [{ productId: PRODUCT_ID, quantity: 2, servicePrefs: [{ preference_code: 'STARCH' }] }],
  serviceSpeed: 'EXPRESS',
};

describe('POST /api/v1/orders/quote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockReturnValue(async () => ({ tenantId: TENANT_ID, userId: 'u-1' }));
  });

  it('quotes the cart for the session tenant and returns the cart view', async () => {
    quoteCheckoutMock.mockResolvedValue({ totals: {} });
    toCartQuoteMock.mockReturnValue({ requestId: 'r-1', totals: { saleTotal: 4.62 } });
    const response = await post({ ...body, tenantId: 'someone-else' });
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:create');
    expect(quoteCheckoutMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID, serviceSpeed: 'EXPRESS', items: body.items,
    }));
    // The screen's ready-by and payment-step inputs are never part of the cart quote.
    expect(quoteCheckoutMock.mock.calls[0][0]).not.toHaveProperty('readyByAt');
    expect(toCartQuoteMock).toHaveBeenCalledWith({ totals: {} }, 'r-1');
    await expect(response.json()).resolves.toEqual({ success: true, data: { requestId: 'r-1', totals: { saleTotal: 4.62 } } });
  });

  it('rejects a body without a request id or items', async () => {
    const response = await post({ items: [] });
    expect(response.status).toBe(400);
    expect(quoteCheckoutMock).not.toHaveBeenCalled();
  });

  it('stops before pricing when permission is denied', async () => {
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({ error: 'Denied' }, { status: 403 }));
    const response = await post(body);
    expect(response.status).toBe(403);
    expect(quoteCheckoutMock).not.toHaveBeenCalled();
  });

  it('answers a cart the catalog cannot price with its code', async () => {
    quoteCheckoutMock.mockRejectedValue(new CommercialContextError('PREFERENCE_NOT_AVAILABLE', 'disabled', { code: 'STARCH' }));
    const response = await post(body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, errorCode: 'PREFERENCE_NOT_AVAILABLE' });
  });

  it('an unexpected failure is logged and answered without internals', async () => {
    quoteCheckoutMock.mockRejectedValue(new Error('db down'));
    const response = await post(body);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ errorCode: 'CART_QUOTE_UNAVAILABLE' }));
  });
});
