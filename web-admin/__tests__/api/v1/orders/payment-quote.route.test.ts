/** @jest-environment node */
/** Exercises the real transport schema, authorization ordering and safe quote failure envelope. */
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/v1/orders/payment-quote/route';
import { CurrencyResolutionError, CURRENCY_RESOLUTION_ERRORS } from '@/lib/money/currency-resolution';

const mockAuth = jest.fn();
const mockCsrf = jest.fn();
const mockQuote = jest.fn();
const mockOverrides = jest.fn();
const mockPermission = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (permission: string) => (request: unknown) => mockAuth(permission, request) }));
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: (...args: unknown[]) => mockCsrf(...args) }));
jest.mock('@/lib/services/payment-quote.service', () => ({
  quotePayment: (...args: unknown[]) => mockQuote(...args),
  PaymentQuoteError: class extends Error {
    constructor(readonly code: string, readonly status = 503) { super(code); }
  },
}));
jest.mock('@/lib/services/price-override-policy.service', () => ({ assertPriceOverridesAllowed: (...args: unknown[]) => mockOverrides(...args) }));
jest.mock('@/lib/api/price-override-http', () => ({ priceOverrideErrorResponse: () => null }));
jest.mock('@/lib/services/permission-service-server', () => ({ hasPermissionServer: (...args: unknown[]) => mockPermission(...args) }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));

const input = { requestId: 'quote-1', customerId: '22222222-2222-4222-8222-222222222222',
  items: [{ productId: '33333333-3333-4333-8333-333333333333', quantity: 1 }] };
function request(body: unknown = input): NextRequest {
  return new NextRequest('http://localhost/api/v1/orders/payment-quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST payment-quote', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCsrf.mockResolvedValue(null);
    mockAuth.mockResolvedValue({ tenantId: 'tenant-A', userId: 'staff-A' });
    mockPermission.mockResolvedValue(false);
    mockQuote.mockResolvedValue({ requestId: 'quote-1', saleTotal: 115 });
  });
  it('rejects CSRF before authorization and financial reads', async () => {
    mockCsrf.mockResolvedValue(NextResponse.json({ error: 'csrf' }, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockQuote).not.toHaveBeenCalled();
  });
  it('requires orders:create before reading quote inputs', async () => {
    mockAuth.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mockAuth).toHaveBeenCalledWith('orders:create', expect.any(NextRequest));
    expect(mockQuote).not.toHaveBeenCalled();
  });
  it('uses authenticated identity and separately gates rich balance visibility', async () => {
    const response = await POST(request({ ...input, tenantId: 'forged', userId: 'forged' }));
    expect(response.status).toBe(200);
    expect(mockQuote).toHaveBeenCalledWith(expect.not.objectContaining({ tenantId: 'forged' }), {
      tenantId: 'tenant-A', userId: 'staff-A', canViewStoredValueBalances: false,
    }, expect.anything());
    expect(mockPermission).toHaveBeenCalledWith('stored_value:view_balances');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toContain('auth;dur=');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
  it.each([null, { ...input, requestId: 'unsafe\r\nid' }, { ...input, branchId: 'bad-id' },
    { ...input, items: [] }, { ...input, items: [{ productId: input.items[0].productId, quantity: -1 }] }])('rejects invalid quote input', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(mockQuote).not.toHaveBeenCalled();
  });
  it('bounds the streamed body even without Content-Length', async () => {
    const response = await POST(request({ ...input, extra: 'x'.repeat(1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(mockQuote).not.toHaveBeenCalled();
  });
  it('returns a controlled malformed JSON error', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/orders/payment-quote', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe('MALFORMED_JSON');
  });
  it.each([[CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY, 422],
    [CURRENCY_RESOLUTION_ERRORS.TENANT_CURRENCY_UNAVAILABLE, 503]])('preserves currency recovery code %s', async (code, status) => {
    mockQuote.mockRejectedValueOnce(new CurrencyResolutionError(code as typeof CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect((await response.json()).errorCode).toBe(code);
  });
  it('keeps provider/database details out of failure responses', async () => {
    mockQuote.mockRejectedValueOnce(new Error('database connection secret'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
  });
  it('bounds an unresponsive quote without an automatic retry', async () => {
    jest.useFakeTimers();
    try {
      mockQuote.mockReturnValueOnce(new Promise(() => {}));
      const pending = POST(request());
      await jest.advanceTimersByTimeAsync(0);
      expect(mockQuote).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(15_000);
      const response = await pending;
      expect(response.status).toBe(504);
      expect((await response.json()).errorCode).toBe('PAYMENT_QUOTE_TIMEOUT');
      expect(mockQuote).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
