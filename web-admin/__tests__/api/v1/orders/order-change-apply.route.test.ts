/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));

const csrfMock = jest.fn();
const requirePermissionMock = jest.fn();
const contextMock = jest.fn();
const factsMock = jest.fn();
const permissionMock = jest.fn();
const previewMock = jest.fn();
const applyMock = jest.fn();
const transactionMock = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: (...args: unknown[]) => csrfMock(...args) }));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (...args: unknown[]) => requirePermissionMock(...args) }));
jest.mock('@/lib/services/order-change/order-change-context.service', () => ({
  getOrderChangeContext: (...args: unknown[]) => contextMock(...args),
  OrderChangeContextError: class OrderChangeContextError extends Error { code = 'ORDER_NOT_FOUND'; status = 404; },
}));
jest.mock('@/lib/services/order-change/order-change-preview-reads', () => ({
  loadOrderChangePreviewFacts: (...args: unknown[]) => factsMock(...args),
  OrderChangePreviewReadError: class OrderChangePreviewReadError extends Error { code = 'PRICE_UNRESOLVED'; status = 422; },
}));
jest.mock('@/lib/services/permission-service-server', () => ({ hasPermissionServer: (...args: unknown[]) => permissionMock(...args) }));
jest.mock('@/lib/services/order-change/order-change-preview.service', () => ({
  previewOrderChange: (...args: unknown[]) => previewMock(...args),
}));
jest.mock('@/lib/services/order-change/order-change-apply.service', () => ({
  applyOrderChange: (...args: unknown[]) => applyMock(...args),
}));
jest.mock('@/lib/db/prisma', () => ({ prisma: { $transaction: (...args: unknown[]) => transactionMock(...args) } }));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) => fn(_tenantId) }));

import { POST } from '@/app/api/v1/orders/[id]/changes/route';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function body() {
  return {
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'order-edit',
    reviewProof: 'proof-1',
    calculationFingerprint: 'fingerprint-1',
    operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Leave at desk' } }],
  };
}

function call(headers: Record<string, string> = { 'Idempotency-Key': 'key-1' }) {
  return POST(
    new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body()),
    }),
    { params: Promise.resolve({ id: ORDER_ID }) },
  );
}

describe('POST /api/v1/orders/[id]/changes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    csrfMock.mockResolvedValue(null);
    permissionMock.mockResolvedValue(true);
    requirePermissionMock.mockReturnValue(async () => ({ tenantId: TENANT_ID, userId: '33333333-3333-4333-8333-333333333333' }));
    contextMock.mockResolvedValue({ order: { currencyCode: 'OMR', paymentTypeCode: 'PAY_ON_COLLECTION' }, financial: { totalAmount: '10.0000' }, orderId: ORDER_ID });
    factsMock.mockResolvedValue({ featureEnabled: true, bindings: [], quotesByTargetId: {}, catalog: [], taxMode: 'TAX_EXCLUSIVE', taxRatePercent: '0.0000', currencyDecimalPlaces: 3, payments: [], credits: [], refunds: [], proofKey: null });
    previewMock.mockResolvedValue({ ok: true, status: 'READY', calculationFingerprint: 'fingerprint-1', reviewProof: 'proof-1' });
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    applyMock.mockImplementation(async (input: { runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }) => {
      await input.runInTransaction(async () => undefined);
      return { ok: true, replayed: false, orderChangeId: 'change-1', changeNo: 2, editStateVersionAfter: 4, requestHash: 'hash-1' };
    });
  });

  it('requires a valid Idempotency-Key before reading the order', async () => {
    const response = await call({ 'Idempotency-Key': '' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(contextMock).not.toHaveBeenCalled();
  });

  it('rejects the request when orders:edit is missing', async () => {
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({ ok: false }, { status: 403 }));
    const response = await call();
    expect(response.status).toBe(403);
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('commits through one transaction after a fresh preview', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { orderChangeId: 'change-1', replayed: false } });
    expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({ featureEnabled: true, tenantId: TENANT_ID }));
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-1', currencyCode: 'OMR', paymentTypeCode: 'PAY_ON_COLLECTION' }));
  });

  it('returns the apply rejection without treating it as a successful Change', async () => {
    applyMock.mockResolvedValue({ ok: false, status: 409, code: 'REVIEW_CHANGED' });
    const response = await call();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'REVIEW_CHANGED' } });
  });

  it('returns a safe error when the transaction throws', async () => {
    applyMock.mockRejectedValue(new Error('VERSION_CONFLICT'));
    const response = await call();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  });
});
