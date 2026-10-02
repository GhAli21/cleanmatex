/** @jest-environment node */
/**
 * WP01 executes POST /api/v1/orders/submit-order and its real schema.
 * Auth, CSRF decisions, and data services are injected boundaries; these tests verify
 * handler sequencing and tenant propagation, not session security or database rollback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/v1/orders/submit-order/route';

const mockAuth = jest.fn();
const mockCsrf = jest.fn();
const mockSubmit = jest.fn();
const mockBranch = jest.fn();
const mockFindHash = jest.fn();
const mockStake = jest.fn();
const mockStore = jest.fn();
const mockDelete = jest.fn();
const mockOrderRead = jest.fn();
const mockQuery = jest.fn();
const mockExecute = jest.fn();
const mockNotify = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (permission: string) => (request: unknown) => mockAuth(permission, request) }));
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: (...args: unknown[]) => mockCsrf(...args) }));
jest.mock('@/lib/services/order-submit-orchestrator.service', () => ({
  submitOrder: (...args: unknown[]) => mockSubmit(...args), resolveOrderBranch: (...args: unknown[]) => mockBranch(...args),
}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {
  $queryRaw: (...args: unknown[]) => mockQuery(...args), $executeRaw: (...args: unknown[]) => mockExecute(...args),
  org_orders_mst: { findFirst: (...args: unknown[]) => mockOrderRead(...args) },
} }));
jest.mock('@/lib/utils/idempotency', () => ({
  hashPayload: () => 'payload-hash', findIdempotencyHash: (...args: unknown[]) => mockFindHash(...args),
  stakeIdempotencyHash: (...args: unknown[]) => mockStake(...args), storeIdempotencyHash: (...args: unknown[]) => mockStore(...args),
  deleteIdempotencyHash: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({ WorkflowProfileResolutionError: class extends Error {} }));
jest.mock('@/lib/services/workflow/initial-status-resolver.service', () => ({ SemanticInitialStatusResolutionError: class extends Error {} }));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('@lib/notifications/event-emitter', () => ({ emitNotificationEvent: (...args: unknown[]) => mockNotify(...args) }));
jest.mock('@lib/notifications/order-event-variables', () => ({ buildOrderCreatedNotificationVariables: (value: unknown) => value }));
jest.mock('@/lib/utils/request-audit', () => ({ getRequestAuditContext: () => ({ userIp: '127.0.0.1', userAgent: 'WP01' }) }));

const tenant = '11111111-1111-4111-8111-111111111111';
const payload = {
  customerId: '22222222-2222-4222-8222-222222222222',
  items: [{ productId: '33333333-3333-4333-8333-333333333333', quantity: 1, pricePerUnit: 20, totalPrice: 20 }],
  paymentMethod: 'CASH', idempotencyKey: 'wp01-route',
  clientTotals: { subtotal: 20, manualDiscount: 0, promoDiscount: 0, vatValue: 0, saleTotal: 20 },
};
const order = { id: 'order-1', order_no: 'ORD-1', current_status: 'intake' };

/**
 * Uses Next's real request implementation so request parsing and schema rejection remain meaningful.
 *
 * @param body - Value serialized as the POST payload.
 * @returns A request for the canonical submission endpoint.
 */
function request(body: unknown = payload): NextRequest {
  return new NextRequest('http://localhost/api/v1/orders/submit-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('WP01 canonical submit-order POST', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAuth.mockResolvedValue({ tenantId: tenant, userId: 'staff-1', userName: 'Staff' });
    mockCsrf.mockResolvedValue(null);
    mockFindHash.mockResolvedValue(null);
    mockQuery.mockResolvedValue([]);
    mockExecute.mockResolvedValue(1);
    mockStake.mockResolvedValue({ conflict: false, resourceId: null });
    mockStore.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockOrderRead.mockResolvedValue(null);
    mockBranch.mockResolvedValue('branch-1');
    mockNotify.mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue({ order: { id: 'order-1', orderNo: 'ORD-1', currentStatus: 'intake' },
      effects: { orderPayments: [], creditApplications: [], cashMovements: [] }, warnings: [] });
  });

  it('rejects CSRF before auth, schema or submission', async () => {
    mockCsrf.mockResolvedValueOnce(NextResponse.json({ error: 'csrf' }, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  it('enforces orders:create before reserving a key', async () => {
    mockAuth.mockResolvedValueOnce(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mockAuth).toHaveBeenCalledWith('orders:create', expect.any(NextRequest));
    expect(mockStake).not.toHaveBeenCalled();
  });
  it.each([{ ...payload, idempotencyKey: undefined }, { ...payload, items: [] }, null])('rejects invalid input before idempotency/data writes: %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mockStake).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  it('reserves the key before submission and uses authenticated tenant/actor context', async () => {
    const response = await POST(request({ ...payload, tenantId: 'forged-tenant', userId: 'forged-user' }));
    expect(response.status).toBe(200);
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, userId: 'staff-1', branchId: 'branch-1' }));
    expect(mockStake).toHaveBeenCalledWith(tenant, 'wp01-route', 'submit_order', 'payload-hash');
    expect(mockStake.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0]);
    expect(mockStore).toHaveBeenCalledWith(tenant, 'wp01-route', 'submit_order', 'payload-hash', 'order-1');
    expect((await response.json()).data.order.id).toBe('order-1');
  });
  it('replays within tenant scope without repeating submission or notifications', async () => {
    mockFindHash.mockResolvedValueOnce({ hash: 'payload-hash', resourceId: 'order-1' });
    mockOrderRead.mockResolvedValueOnce(order);
    const response = await POST(request());
    expect((await response.json()).data.fromCache).toBe(true);
    expect(mockOrderRead).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order-1', tenant_org_id: tenant } }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
  it('rejects a changed payload hash for an existing key', async () => {
    mockFindHash.mockResolvedValueOnce({ hash: 'different-hash', resourceId: 'order-1' });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe('IDEMPOTENCY_CONFLICT');
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  it('fails closed if staking fails', async () => {
    mockStake.mockRejectedValueOnce(new Error('stake unavailable'));
    expect((await POST(request())).status).toBe(500);
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  it.each([['AMOUNT_MISMATCH', 400], ['CASH_DRAWER_SESSION_CLOSED', 422], ['unexpected failure', 500]])('maps %s and releases the failed claim', async (message, status) => {
    mockSubmit.mockRejectedValueOnce(new Error(String(message)));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(mockDelete).toHaveBeenCalledWith(tenant, 'wp01-route', 'submit_order');
    expect(mockOrderRead).toHaveBeenCalledWith(expect.objectContaining({ where: { tenant_org_id: tenant, idempotency_key: 'wp01-route' } }));
  });
  it('recovers an already committed order after an orchestration response failure', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('response read failed'));
    mockOrderRead.mockResolvedValueOnce(order);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.fromCache).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
