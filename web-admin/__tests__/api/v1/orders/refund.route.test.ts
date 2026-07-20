/**
 * Tests: POST /api/v1/orders/[id]/refund — REFUND_AND_REBILL permission gate (B27)
 *
 * Before this package REFUND_AND_REBILL was hardcoded-rejected regardless of
 * permission (B01 §13). Covers:
 * - REFUND_AND_REBILL without orders:rebill_authorize → 403, same error code
 *   as before (REFUND_AND_REBILL_NOT_AVAILABLE) — a caller-visible regression
 *   guard, not just an internal refactor
 * - REFUND_AND_REBILL with the permission → passes rebillAuthorized: true to
 *   initiateRefund
 * - a non-rebill context is unaffected (never calls hasPermissionServer for
 *   the rebill check)
 *
 * The sibling route (app/api/v1/orders/[id]/refunds/route.ts, plural) carries
 * the identical duplicated logic — not re-tested here to avoid a redundant
 * suite; both were fixed together (see B27 Completion evidence).
 */

const requirePermissionMock = jest.fn();
const validateCSRFMock = jest.fn();
const hasPermissionServerMock = jest.fn();
const initiateRefundMock = jest.fn();

class MockNextRequest {
  url: string;
  nextUrl: URL;
  private body: unknown;
  constructor(url: string, body: unknown) {
    this.url = url;
    this.nextUrl = new URL(url);
    this.body = body;
  }
  async json() {
    return this.body;
  }
}

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

jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => (..._a: unknown[]) => requirePermissionMock(),
}));

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...a: unknown[]) => validateCSRFMock(...a),
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => hasPermissionServerMock(...a),
}));

jest.mock('@/lib/services/order-refund.service', () => {
  const actual = jest.requireActual('@/lib/services/order-refund.service');
  return {
    ...actual,
    initiateRefund: (...a: unknown[]) => initiateRefundMock(...a),
  };
});

const { POST } = require('@/app/api/v1/orders/[id]/refund/route') as {
  POST: (
    request: InstanceType<typeof MockNextRequest>,
    context: { params: Promise<{ id: string }> }
  ) => Promise<InstanceType<typeof MockNextResponse>>;
};

const TENANT = 'tenant-refund-route-001';
const ORDER = 'order-refund-route-001';

function makeRequest(body: Record<string, unknown>) {
  return new MockNextRequest(`https://x/api/v1/orders/${ORDER}/refund`, body);
}

const baseBody = {
  amount: 30,
  reason: 'OVERCHARGE',
  method: 'CASH',
  currencyCode: 'OMR',
  idempotencyKey: 'refund-route-key-1',
};

describe('POST /api/v1/orders/[id]/refund — REFUND_AND_REBILL gate (B27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateCSRFMock.mockResolvedValue(null);
    requirePermissionMock.mockResolvedValue({ tenantId: TENANT, userId: 'user-1' });
  });

  it('rejects REFUND_AND_REBILL with 403 REFUND_AND_REBILL_NOT_AVAILABLE when the actor lacks orders:rebill_authorize', async () => {
    hasPermissionServerMock.mockResolvedValue(false);

    const res = await POST(
      makeRequest({ ...baseBody, refundContext: 'REFUND_AND_REBILL' }),
      { params: Promise.resolve({ id: ORDER }) }
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toMatchObject({ success: false, code: 'REFUND_AND_REBILL_NOT_AVAILABLE' });
    expect(initiateRefundMock).not.toHaveBeenCalled();
  });

  it('allows REFUND_AND_REBILL and passes rebillAuthorized: true when the actor holds orders:rebill_authorize', async () => {
    hasPermissionServerMock.mockResolvedValue(true);
    initiateRefundMock.mockResolvedValue({ id: 'refund-1' });

    const res = await POST(
      makeRequest({ ...baseBody, refundContext: 'REFUND_AND_REBILL' }),
      { params: Promise.resolve({ id: ORDER }) }
    );

    expect(res.status).toBe(201);
    expect(hasPermissionServerMock).toHaveBeenCalledWith('orders:rebill_authorize');
    expect(initiateRefundMock).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ rebillAuthorized: true })
    );
  });

  it('a non-rebill context never checks orders:rebill_authorize and forwards rebillAuthorized: false', async () => {
    initiateRefundMock.mockResolvedValue({ id: 'refund-2' });

    const res = await POST(
      makeRequest({ ...baseBody, refundContext: 'STANDARD' }),
      { params: Promise.resolve({ id: ORDER }) }
    );

    expect(res.status).toBe(201);
    expect(hasPermissionServerMock).not.toHaveBeenCalledWith('orders:rebill_authorize');
    expect(initiateRefundMock).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ rebillAuthorized: false })
    );
  });
});
