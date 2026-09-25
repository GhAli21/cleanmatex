/**
 * Tests: POST /api/v1/orders/[id]/payments/[paymentId]/verify (CLF W10)
 *
 * The order-screen Verify button now delegates to the canonical VERIFY
 * transition (transitionPaymentTx) — the same path as the pending-payments
 * worklist — so a verified cash leg is recognised in the drawer ledger. The
 * legacy verifyPaymentTx (which skipped the ledger) was deleted.
 *
 * Covers: delegation shape (action VERIFY, deterministic idempotency key,
 * actor), legacy response fields kept for the UI, cash-drawer ledger refusal
 * → 422 with `code`, transition errors → mapped status, permission denial.
 */

const requirePermissionMock = jest.fn();
const validateCSRFMock = jest.fn();
const transitionPaymentTxMock = jest.fn();

class MockNextResponse {
  status: number;
  private payload: unknown;
  constructor(payload: unknown, init?: { status?: number }) {
    this.payload = payload;
    this.status = init?.status ?? 200;
  }
  static json(payload: unknown, init?: { status?: number }) {
    return new MockNextResponse(payload, init);
  }
  async json() {
    return this.payload;
  }
}

// Lazy getter: the route module is imported (hoisted) before this class is initialised.
jest.mock('next/server', () => ({
  NextRequest: class {},
  get NextResponse() {
    return MockNextResponse;
  },
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (code: string) => () => requirePermissionMock(code),
}));

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...a: unknown[]) => validateCSRFMock(...a),
}));

jest.mock('@/lib/services/payment-transition.service', () => ({
  transitionPaymentTx: (...a: unknown[]) => transitionPaymentTxMock(...a),
}));

import { POST } from '@/app/api/v1/orders/[id]/payments/[paymentId]/verify/route';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';

const TENANT = 'tenant-1';
const USER = 'user-1';
const ORDER = 'order-1';
const PAYMENT = 'payment-1';

const ctx = { params: Promise.resolve({ id: ORDER, paymentId: PAYMENT }) };
const call = () => POST({} as never, ctx) as unknown as Promise<MockNextResponse>;

beforeEach(() => {
  jest.clearAllMocks();
  validateCSRFMock.mockResolvedValue(null);
  requirePermissionMock.mockResolvedValue({ tenantId: TENANT, userId: USER });
  transitionPaymentTxMock.mockResolvedValue({
    paymentId: PAYMENT,
    action: 'VERIFY',
    previousStatus: 'PENDING',
    newStatus: 'COMPLETED',
    transitionedAt: '2026-09-25T10:00:00.000Z',
    orderPaymentStatus: 'PAID',
    outstanding: 0,
    flipped: true,
    fallbackClassification: null,
    reclassifiedPaymentType: false,
    deferredCashMovementCreated: true,
    compensatingCashMovementCreated: false,
  });
});

describe('POST /orders/[id]/payments/[paymentId]/verify', () => {
  it('delegates to the VERIFY transition with a deterministic per-payment idempotency key', async () => {
    await call();
    expect(requirePermissionMock).toHaveBeenCalledWith('orders:verify_payment');
    expect(transitionPaymentTxMock).toHaveBeenCalledWith({
      orderId: ORDER,
      paymentId: PAYMENT,
      tenantId: TENANT,
      actorId: USER,
      action: 'VERIFY',
      idempotencyKey: `order_payment_verify:${PAYMENT}`,
    });
  });

  it('keeps the legacy response fields the order screen reads, plus cashRecognized', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        paymentId: PAYMENT,
        previousStatus: 'PENDING',
        newStatus: 'COMPLETED',
        verifiedAt: '2026-09-25T10:00:00.000Z',
        orderPaymentStatus: 'PAID',
        outstanding: 0,
        flipped: true,
        cashRecognized: true,
      },
    });
  });

  it('returns 422 with the ledger code when the drawer gate refuses the cash line', async () => {
    transitionPaymentTxMock.mockRejectedValue(new CashDrawerLedgerError('CASH_DRAWER_REQUIRED'));
    const res = await call();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ success: false, code: 'CASH_DRAWER_REQUIRED', error: 'CASH_DRAWER_REQUIRED' });
  });

  it.each([
    ['PAYMENT_NOT_FOUND', 404],
    ['ILLEGAL_TRANSITION', 409],
    ['IDEMPOTENCY_CONFLICT', 409],
  ])('maps %s to HTTP %i with a code', async (message, status) => {
    transitionPaymentTxMock.mockRejectedValue(new Error(message));
    const res = await call();
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ success: false, code: message, error: message });
  });

  it('returns the permission denial without calling the service', async () => {
    const denied = MockNextResponse.json({ success: false }, { status: 403 });
    requirePermissionMock.mockResolvedValue(denied);
    const res = await call();
    expect(res).toBe(denied);
    expect(transitionPaymentTxMock).not.toHaveBeenCalled();
  });
});
