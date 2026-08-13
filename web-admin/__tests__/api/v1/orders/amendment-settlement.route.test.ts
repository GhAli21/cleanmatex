/**
 * Tests: POST /api/v1/orders/[id]/edit-history/[editHistoryId]/settlement (B12)
 *
 * Genuine coverage gap identified during a B28 audit: recordAmendmentSettlement
 * itself was unit-tested (order-amendment.service.test.ts), but this route —
 * the only real caller — had zero coverage. Covers:
 * - permission gate delegates to requirePermission('orders:post_settlement_edit')
 * - CSRF gate runs before permission/body parsing
 * - invalid body (schema violation) -> 400, service never called
 * - valid body -> service called with issuedBy = the authenticated userId
 *   (not a hardcoded/omitted actor — this is what makes the fiscal
 *   correction document's issued_by attribution correct, B14)
 * - service throws a "not found" message -> 404; any other error -> 500
 */

const requirePermissionMock = jest.fn();
const validateCSRFMock = jest.fn();
const recordAmendmentSettlementMock = jest.fn();

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
    if (this.body === undefined) {
      throw new Error('no body');
    }
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

jest.mock('@/lib/services/order-amendment.service', () => ({
  recordAmendmentSettlement: (...a: unknown[]) => recordAmendmentSettlementMock(...a),
}));

const { POST } = require('@/app/api/v1/orders/[id]/edit-history/[editHistoryId]/settlement/route') as {
  POST: (
    request: InstanceType<typeof MockNextRequest>,
    context: { params: Promise<{ id: string; editHistoryId: string }> }
  ) => Promise<InstanceType<typeof MockNextResponse>>;
};

const TENANT = 'tenant-settlement-route-001';
const ORDER = 'order-settlement-route-001';
const EDIT_HISTORY = 'edit-history-001';
const USER = 'user-settlement-001';

function makeRequest(body: unknown) {
  return new MockNextRequest(
    `https://x/api/v1/orders/${ORDER}/edit-history/${EDIT_HISTORY}/settlement`,
    body
  );
}

function callRoute(body: unknown) {
  return POST(makeRequest(body), {
    params: Promise.resolve({ id: ORDER, editHistoryId: EDIT_HISTORY }),
  });
}

const validBody = {
  paymentAdjustmentType: 'CHARGE',
  paymentAdjustmentAmount: 5,
  settlementLineage: { paymentId: '11111111-1111-4111-8111-111111111111' },
};

describe('POST /api/v1/orders/[id]/edit-history/[editHistoryId]/settlement (B12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateCSRFMock.mockResolvedValue(null);
    requirePermissionMock.mockResolvedValue({ tenantId: TENANT, userId: USER });
  });

  it('returns the CSRF response and never checks permission when CSRF validation fails', async () => {
    const csrfFailure = MockNextResponse.json({ success: false, error: 'csrf' }, { status: 403 });
    validateCSRFMock.mockResolvedValue(csrfFailure);

    const res = await callRoute(validBody);

    expect(res).toBe(csrfFailure);
    expect(requirePermissionMock).not.toHaveBeenCalled();
    expect(recordAmendmentSettlementMock).not.toHaveBeenCalled();
  });

  it('returns the permission-denied response and never parses the body when the actor lacks orders:post_settlement_edit', async () => {
    const denied = MockNextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    requirePermissionMock.mockResolvedValue(denied);

    const res = await callRoute(validBody);

    expect(res).toBe(denied);
    expect(recordAmendmentSettlementMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid body with 400 without calling the service', async () => {
    const res = await callRoute({ paymentAdjustmentType: 'CHARGE' });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(recordAmendmentSettlementMock).not.toHaveBeenCalled();
  });

  it('rejects settlementLineage with neither paymentId nor dispositionIds', async () => {
    const res = await callRoute({
      paymentAdjustmentType: 'REFUND',
      paymentAdjustmentAmount: 10,
      settlementLineage: {},
    });

    expect(res.status).toBe(400);
    expect(recordAmendmentSettlementMock).not.toHaveBeenCalled();
  });

  it('calls recordAmendmentSettlement with issuedBy = the authenticated userId (not omitted)', async () => {
    recordAmendmentSettlementMock.mockResolvedValue({ alreadySettled: false });

    const res = await callRoute(validBody);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { alreadySettled: false } });
    expect(recordAmendmentSettlementMock).toHaveBeenCalledWith({
      tenantId: TENANT,
      orderId: ORDER,
      editHistoryId: EDIT_HISTORY,
      paymentAdjustmentType: 'CHARGE',
      paymentAdjustmentAmount: 5,
      settlementLineage: validBody.settlementLineage,
      issuedBy: USER,
    });
  });

  it('accepts settlementLineage keyed by dispositionIds instead of paymentId', async () => {
    recordAmendmentSettlementMock.mockResolvedValue({ alreadySettled: false });

    const res = await callRoute({
      paymentAdjustmentType: 'REFUND',
      paymentAdjustmentAmount: 12.5,
      settlementLineage: { dispositionIds: ['22222222-2222-4222-8222-222222222222'] },
    });

    expect(res.status).toBe(200);
    expect(recordAmendmentSettlementMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentAdjustmentType: 'REFUND' })
    );
  });

  it('maps a "not found" service error to 404', async () => {
    recordAmendmentSettlementMock.mockRejectedValue(new Error('Edit history row not found for this order.'));

    const res = await callRoute(validBody);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
  });

  it('maps any other service error to 500', async () => {
    recordAmendmentSettlementMock.mockRejectedValue(new Error('unexpected db failure'));

    const res = await callRoute(validBody);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
  });

  it('returns idempotent-replay results unchanged (alreadySettled: true)', async () => {
    recordAmendmentSettlementMock.mockResolvedValue({ alreadySettled: true });

    const res = await callRoute(validBody);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ alreadySettled: true });
  });
});
