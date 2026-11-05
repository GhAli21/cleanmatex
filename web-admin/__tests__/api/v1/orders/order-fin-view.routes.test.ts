/** @jest-environment node */

/**
 * Reusable Order Fin View P4 — routes and server action (PLAN P4-01…P4-09, PR-05/06/22).
 * Services are mocked: these tests prove the HTTP contract (guards, validation,
 * the one error envelope, no-store, uniform public 404, tenant/customer from the
 * session or token only), not the figures (the service and DB tests do that).
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));

const csrfMock = jest.fn();
const requirePermissionMock = jest.fn();
const viewMock = jest.fn();
const headersMock = jest.fn();
const publicViewMock = jest.fn();
const ownedMock = jest.fn();
const trackMock = jest.fn();
const sessionMock = jest.fn();
const runPreviewMock = jest.fn();
const editViewMock = jest.fn();
const touchMock = jest.fn();
const quoteLimitMock = jest.fn();
const publicLimitMock = jest.fn();
const actionGuardMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: (...a: unknown[]) => csrfMock(...a) }));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (...a: unknown[]) => requirePermissionMock(...a) }));
jest.mock('@/lib/middleware/rate-limit', () => ({
  checkEditQuoteRateLimit: (...a: unknown[]) => quoteLimitMock(...a),
  checkPublicFinancialViewRateLimit: (...a: unknown[]) => publicLimitMock(...a),
}));
jest.mock('@/lib/services/order-fin-view/order-fin-view.service', () => ({ getOrderFinancialView: (...a: unknown[]) => viewMock(...a) }));
jest.mock('@/lib/services/order-fin-view/order-fin-headers.service', () => ({ getOrderFinancialHeaders: (...a: unknown[]) => headersMock(...a) }));
jest.mock('@/lib/services/order-fin-view/public-view.service', () => ({
  PublicViewTooLargeError: class PublicViewTooLargeError extends Error {},
  getPublicOrderFinancialView: (...a: unknown[]) => publicViewMock(...a),
  resolveCustomerOwnedOrderId: (...a: unknown[]) => ownedMock(...a),
}));
jest.mock('@/lib/services/public-order-tracking.service', () => ({ resolvePublicTrackingReferenceByToken: (...a: unknown[]) => trackMock(...a) }));
jest.mock('@/lib/services/customer-mobile-session.service', () => ({ resolveCustomerMobileSession: (...a: unknown[]) => sessionMock(...a) }));
jest.mock('@/lib/services/order-change/order-change-preview-run', () => ({ runOrderChangePreview: (...a: unknown[]) => runPreviewMock(...a) }));
jest.mock('@/lib/services/order-fin-view/edit-view.service', () => ({ getOrderEditQuoteView: (...a: unknown[]) => editViewMock(...a) }));
jest.mock('@/lib/services/order-edit-session.service', () => ({
  touchOrderEditSession: (...a: unknown[]) => touchMock(...a),
  OrderEditSessionError: class OrderEditSessionError extends Error { code = 'EDIT_SESSION_EXPIRED'; },
}));
jest.mock('@/lib/services/order-change/order-change-context.service', () => ({
  OrderChangeContextError: class OrderChangeContextError extends Error { code = 'ORDER_NOT_FOUND'; status = 404; },
}));
jest.mock('@/lib/services/order-change/order-change-preview-reads', () => ({
  OrderChangePreviewReadError: class OrderChangePreviewReadError extends Error { code = 'PRICE_UNRESOLVED'; status = 422; },
}));
jest.mock('@/lib/auth/server-action-guard', () => ({
  ...jest.requireActual('@/lib/auth/server-action-guard'),
  resolveActionTenant: (...a: unknown[]) => actionGuardMock(...a),
}));

import { NotFoundError } from '@/lib/errors/base-errors';
import { GET as viewGET } from '@/app/api/v1/orders/[id]/financial-view/route';
import { POST as headersPOST } from '@/app/api/v1/orders/financial-headers/route';
import { POST as quotePOST } from '@/app/api/v1/orders/[id]/changes/quote/route';
import { GET as trackGET } from '@/app/api/v1/public/track/[token]/financial-view/route';
import { GET as portalGET } from '@/app/api/v1/public/customer/orders/[orderNo]/financial-view/route';
import { getOrderFinancialViewAction } from '@/app/actions/orders/get-order-financial-view';
import { PublicViewTooLargeError } from '@/lib/services/order-fin-view/public-view.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const ORDER = '22222222-2222-4222-8222-222222222222';
const VIEW = { schemaVersion: 1, sourceKind: 'saved' };

const signedIn = () => requirePermissionMock.mockReturnValue(async () => ({ tenantId: TENANT, userId: USER }));
const req = (url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(url, 'http://localhost'), init);
const params = <T>(p: T) => ({ params: Promise.resolve(p) });
async function expectError(res: NextResponse, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(await res.json()).toMatchObject({ success: false, error: { code, messageKey: `orders.finView.errors.${code}` } });
}

beforeEach(() => {
  jest.resetAllMocks();
  csrfMock.mockResolvedValue(null);
  quoteLimitMock.mockResolvedValue(null);
  publicLimitMock.mockResolvedValue(null);
  touchMock.mockResolvedValue({});
});

describe('GET /api/v1/orders/[id]/financial-view (P4-01)', () => {
  it('requires orders:read, resolves the request and answers no-store', async () => {
    signedIn();
    viewMock.mockResolvedValue(VIEW);
    const res = await viewGET(req(`/api/v1/orders/${ORDER}/financial-view?preset=detailed&sections=items:detail,taxes:total&x=1`), params({ id: ORDER }));
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:read');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: VIEW });
    const [tenant, order, resolved] = viewMock.mock.calls[0];
    expect([tenant, order]).toEqual([TENANT, ORDER]);
    expect(resolved).toMatchObject({ preset: 'detailed', sourceKind: 'saved', sections: { items: 'detail', taxes: 'total' } });
  });

  it('refuses unknown presets, sections or modes, and a non-uuid id', async () => {
    signedIn();
    for (const q of ['preset=everything', 'sections=secrets:detail', 'sections=items:open', 'sections=items:total,items:detail']) {
      await expectError(await viewGET(req(`/api/v1/orders/${ORDER}/financial-view?${q}`), params({ id: ORDER })), 400, 'VALIDATION_FAILED');
    }
    await expectError(await viewGET(req('/api/v1/orders/x/financial-view'), params({ id: 'x' })), 400, 'VALIDATION_FAILED');
    expect(viewMock).not.toHaveBeenCalled();
  });

  it('another tenant\'s order is 404; an internal failure is a generic 500', async () => {
    signedIn();
    viewMock.mockRejectedValueOnce(new NotFoundError('Order', ORDER));
    await expectError(await viewGET(req(`/api/v1/orders/${ORDER}/financial-view`), params({ id: ORDER })), 404, 'ORDER_NOT_FOUND');
    viewMock.mockRejectedValueOnce(new Error('db exploded: secret detail'));
    const res = await viewGET(req(`/api/v1/orders/${ORDER}/financial-view`), params({ id: ORDER }));
    expect(JSON.stringify(await res.clone().json())).not.toContain('secret');
    await expectError(res, 500, 'INTERNAL_ERROR');
  });

  it('maps the permission guard onto the envelope', async () => {
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({}, { status: 403 }));
    await expectError(await viewGET(req(`/api/v1/orders/${ORDER}/financial-view`), params({ id: ORDER })), 403, 'PERMISSION_DENIED');
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({}, { status: 401 }));
    await expectError(await viewGET(req(`/api/v1/orders/${ORDER}/financial-view`), params({ id: ORDER })), 401, 'UNAUTHENTICATED');
  });
});

describe('POST /api/v1/orders/financial-headers (P4-02)', () => {
  const post = (body: unknown) => headersPOST(req('/api/v1/orders/financial-headers', { method: 'POST', body: JSON.stringify(body) }));

  it('returns the header map for 1–100 ids, tenant from the session', async () => {
    signedIn();
    headersMock.mockResolvedValue({ [ORDER]: { orderId: ORDER } });
    const res = await post({ orderIds: [ORDER] });
    expect(res.status).toBe(200);
    expect(headersMock).toHaveBeenCalledWith(TENANT, [ORDER]);
  });

  it('refuses CSRF failures, empty or oversized lists and non-uuids', async () => {
    csrfMock.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    await expectError(await post({ orderIds: [ORDER] }), 403, 'CSRF_REJECTED');
    signedIn();
    await expectError(await post({ orderIds: [] }), 400, 'VALIDATION_FAILED');
    await expectError(await post({ orderIds: Array.from({ length: 101 }, () => ORDER) }), 400, 'VALIDATION_FAILED');
    await expectError(await post({ orderIds: ['nope'] }), 400, 'VALIDATION_FAILED');
    await expectError(await headersPOST(req('/api/v1/orders/financial-headers', { method: 'POST', body: '{bad' })), 400, 'VALIDATION_FAILED');
    expect(headersMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/orders/[id]/changes/quote (P4-08)', () => {
  const body = { expectedEditStateVersion: 1, expectedWfStateVersion: 1, sourceContext: 'staff_web', operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'x' } }] };
  const post = (q = '') => quotePOST(req(`/api/v1/orders/${ORDER}/changes/quote${q}`, { method: 'POST', body: JSON.stringify(body) }), params({ id: ORDER }));

  it('runs the Review calculation without a proof and returns status + the edit view', async () => {
    signedIn();
    runPreviewMock.mockResolvedValue({ ok: true, status: 'READY' });
    editViewMock.mockResolvedValue({ sourceKind: 'edit', header: { editOutcome: 'OUTSTANDING' } });
    const res = await post();
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:edit');
    expect(runPreviewMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, orderId: ORDER, issueProof: false }));
    expect(editViewMock.mock.calls[0][3]).toMatchObject({ preset: 'totals', sourceKind: 'edit' });
    expect(await res.json()).toEqual({ success: true, data: { status: 'READY', view: { sourceKind: 'edit', header: { editOutcome: 'OUTSTANDING' } } } });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('is limited per user, needs the live edit session, and maps engine refusals with their reason', async () => {
    signedIn();
    quoteLimitMock.mockResolvedValueOnce(NextResponse.json({}, { status: 429, headers: { 'Retry-After': '7' } }));
    const limited = await post();
    expect(limited.headers.get('retry-after')).toBe('7');
    await expectError(limited, 429, 'RATE_LIMITED');

    const { OrderEditSessionError } = jest.requireMock('@/lib/services/order-edit-session.service');
    touchMock.mockRejectedValueOnce(new OrderEditSessionError());
    await expectError(await post(), 403, 'EDIT_SESSION_INVALID');

    runPreviewMock.mockResolvedValueOnce({ ok: false, status: 409, code: 'EDIT_VERSION_CONFLICT' });
    const conflict = await post();
    expect((await conflict.clone().json()).error.reason).toBe('EDIT_VERSION_CONFLICT');
    await expectError(conflict, 409, 'ORDER_CHANGED');

    runPreviewMock.mockResolvedValueOnce({ ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' });
    await expectError(await post(), 422, 'QUOTE_REJECTED');
    await expectError(await post('?preset=nope'), 400, 'VALIDATION_FAILED');
    csrfMock.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    await expectError(await post(), 403, 'CSRF_REJECTED');
  });
});

describe('GET /api/v1/public/track/[token]/financial-view (P4-06)', () => {
  it('serves the projection for the token\'s own tenant and order', async () => {
    trackMock.mockResolvedValue({ tenantId: TENANT, orderId: ORDER });
    publicViewMock.mockResolvedValue({ sourceKind: 'saved', orderId: null });
    const res = await trackGET(req('/api/v1/public/track/tok/financial-view?preset=audit&tenantId=evil'), params({ token: 'tok' }));
    expect(res.status).toBe(200);
    expect(publicViewMock).toHaveBeenCalledWith(TENANT, ORDER);
  });

  it('every refusal is the same 404', async () => {
    trackMock.mockResolvedValueOnce(null);
    await expectError(await trackGET(req('/api/v1/public/track/bad/financial-view'), params({ token: 'bad' })), 404, 'ORDER_NOT_FOUND');
    trackMock.mockResolvedValue({ tenantId: TENANT, orderId: ORDER });
    publicViewMock.mockRejectedValueOnce(new PublicViewTooLargeError());
    await expectError(await trackGET(req('/api/v1/public/track/tok/financial-view'), params({ token: 'tok' })), 404, 'ORDER_NOT_FOUND');
    publicViewMock.mockRejectedValueOnce(new NotFoundError('Order', ORDER));
    await expectError(await trackGET(req('/api/v1/public/track/tok/financial-view'), params({ token: 'tok' })), 404, 'ORDER_NOT_FOUND');
  });

  it('is rate limited per client', async () => {
    publicLimitMock.mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    await expectError(await trackGET(req('/api/v1/public/track/tok/financial-view'), params({ token: 'tok' })), 429, 'RATE_LIMITED');
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/public/customer/orders/[orderNo]/financial-view (P4-07)', () => {
  const get = (auth = 'Bearer t') => portalGET(req(`/api/v1/public/customer/orders/1001/financial-view?tenantId=${TENANT}`, { headers: { authorization: auth } }), params({ orderNo: '1001' }));

  it('serves only the session customer\'s own order, matched on tenant and customer', async () => {
    sessionMock.mockResolvedValue({ tenantOrgId: TENANT, customerId: 'cust-1' });
    ownedMock.mockResolvedValue(ORDER);
    publicViewMock.mockResolvedValue({ sourceKind: 'saved' });
    expect((await get()).status).toBe(200);
    expect(ownedMock).toHaveBeenCalledWith(TENANT, 'cust-1', '1001');
    expect(publicViewMock).toHaveBeenCalledWith(TENANT, ORDER);
  });

  it('a bad session is 401; another customer\'s order is the same 404 as a missing one', async () => {
    sessionMock.mockResolvedValueOnce(null);
    await expectError(await get(), 401, 'UNAUTHENTICATED');
    await expectError(await get(''), 400, 'VALIDATION_FAILED');
    sessionMock.mockResolvedValue({ tenantOrgId: TENANT, customerId: 'cust-2' });
    ownedMock.mockRejectedValueOnce(new NotFoundError('Order', '1001'));
    await expectError(await get(), 404, 'ORDER_NOT_FOUND');
    expect(publicViewMock).not.toHaveBeenCalled();
  });
});

describe('getOrderFinancialViewAction (P4-03)', () => {
  it('tenant from the session only; config whitelisted; flat result with route codes', async () => {
    actionGuardMock.mockResolvedValue({ ok: true, tenantId: TENANT, userId: USER });
    viewMock.mockResolvedValue(VIEW);
    expect(await getOrderFinancialViewAction(ORDER, { preset: 'summary' })).toEqual({ success: true, data: VIEW });
    expect(viewMock.mock.calls[0][0]).toBe(TENANT);

    expect(await getOrderFinancialViewAction(ORDER, { preset: 'summary', tenantId: 'evil' } as never)).toEqual({ success: false, error: 'VALIDATION_FAILED' });
    expect(await getOrderFinancialViewAction('nope')).toEqual({ success: false, error: 'VALIDATION_FAILED' });
    viewMock.mockRejectedValueOnce(new NotFoundError('Order', ORDER));
    expect(await getOrderFinancialViewAction(ORDER)).toEqual({ success: false, error: 'ORDER_NOT_FOUND' });

    actionGuardMock.mockResolvedValue({ ok: false, error: 'FORBIDDEN' });
    expect(await getOrderFinancialViewAction(ORDER)).toEqual({ success: false, error: 'PERMISSION_DENIED' });
  });
});
