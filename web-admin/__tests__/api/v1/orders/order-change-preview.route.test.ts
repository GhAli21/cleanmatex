/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));

const csrfMock = jest.fn();
const requirePermissionMock = jest.fn();
const contextMock = jest.fn();
const factsMock = jest.fn();
const permissionMock = jest.fn();

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

import { POST } from '@/app/api/v1/orders/[id]/changes/preview/route';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ITEM = '55555555-5555-4555-8555-555555555555';

function context() {
  return {
    orderId: ORDER_ID,
    orderNo: '1001',
    committedAt: '2026-10-01T10:00:00.000Z',
    editStateVersion: 3,
    wfStateVersion: 5,
    workflow: { currentStatus: 'PROCESSING', profileId: null, profileVersionId: '44444444-4444-4444-8444-444444444444' },
    editAccess: { status: 'OPEN', reasonCode: null, reasonText: null, blockedUntil: null },
    permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
    configuration: { featureEnabled: false, newItemPricePolicy: null, existingDiscountPolicy: null, reasonPolicy: null, deferredReason: 'deferred' },
    order: { customer: { id: null }, customerSnapshot: { name: 'Ada', mobile: null, email: null }, branchId: null, currencyCode: 'OMR', paymentTypeCode: 'PAY_ON_COLLECTION', priority: 'NORMAL', serviceSpeed: 'STANDARD', readyBy: null, notes: 'Keep', customerNotes: null },
    items: [{ id: ITEM, orderId: ORDER_ID, productId: ITEM, productName: 'Shirt', productName2: null, serviceCategoryCode: null, quantity: 1, pricePerUnit: '10.0000', totalPrice: '10.0000', priceOverride: null, preferenceCharge: '0.0000', packingPreferenceCode: null, active: true }],
    pieces: [],
    preferences: [],
    financial: { totalAmount: '10.0000', netCollectedAmount: '0.0000', outstandingAmount: '10.0000', overpaidAmount: '0.0000' },
    capabilitySummary: { status: 'DEFERRED', reasonCode: 'CAPABILITY_POLICY_PENDING' },
  };
}

describe('POST /api/v1/orders/[id]/changes/preview', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    csrfMock.mockResolvedValue(null);
    permissionMock.mockResolvedValue(true);
  });

  it('requires orders:edit and previews with the authenticated organization', async () => {
    requirePermissionMock.mockReturnValue(async () => ({ tenantId: TENANT_ID, userId: '33333333-3333-4333-8333-333333333333' }));
    contextMock.mockResolvedValue(context());
    factsMock.mockResolvedValue({
      featureEnabled: true,
      bindings: [{
        editPolicyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        profileVersionId: '44444444-4444-4444-8444-444444444444',
        policyRevision: 3,
        workflowStatus: 'PROCESSING',
        operationCode: 'CHANGE_ORDER_NOTES',
        targetType: 'ORDER',
        decision: 'ALLOW',
        reasonCode: 'CAPABILITY_POLICY_ALLOWED',
        messageKey: 'orderChange.policy.allowed',
      }],
      quotesByTargetId: {},
      catalog: [],
      taxMode: 'TAX_EXCLUSIVE',
      taxRatePercent: '0.0000',
      currencyDecimalPlaces: 3,
      payments: [{ amount: '10.0000', payment_status: 'COMPLETED', payment_nature_snapshot: 'REAL_PAYMENT', payment_method_code: 'CASH' }],
      credits: [],
      refunds: [],
      proofKey: { keyId: 'preview-test', secret: 'preview-test-secret' },
    });
    const response = await POST(new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/changes/preview`, {
      method: 'POST',
      body: JSON.stringify({
        expectedEditStateVersion: 3,
        expectedWfStateVersion: 5,
        sourceContext: 'staff_web',
        changeReason: 'Customer asked for a correction.',
        operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Updated' } }],
      }),
    }), { params: Promise.resolve({ id: ORDER_ID }) });
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:edit');
    expect(contextMock).toHaveBeenCalledWith({ tenantId: TENANT_ID, orderId: ORDER_ID });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { status: 'READY', createsChange: true } });
  });

  it('does not load facts when permission is denied', async () => {
    requirePermissionMock.mockReturnValue(async () => NextResponse.json({ error: 'Denied' }, { status: 403 }));
    const response = await POST(new NextRequest(`http://localhost/api/v1/orders/${ORDER_ID}/changes/preview`, { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: ORDER_ID }) });
    expect(response.status).toBe(403);
    expect(factsMock).not.toHaveBeenCalled();
  });

  it('does not call a write API from the route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/v1/orders/[id]/changes/preview/route.ts'), 'utf8');
    expect(source).toMatch(/requirePermission\('orders:edit'\)/);
    expect(source).toMatch(/validateCSRF/);
    expect(source).not.toMatch(/\$executeRaw|outbox|idempotency|\.create\(|\.update\(|\.delete\(/);
  });
});
