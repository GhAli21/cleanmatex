import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const requirePermissionMock = jest.fn();
const getStoredValueSummaryMock = jest.fn();

class MockNextRequest {
  url: string;
  nextUrl: URL;

  constructor(url: string) {
    this.url = url;
    this.nextUrl = new URL(url);
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
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  getStoredValueSummary: (...args: unknown[]) => getStoredValueSummaryMock(...args),
}));

const { NextRequest, NextResponse } = require('next/server') as {
  NextRequest: typeof MockNextRequest;
  NextResponse: typeof MockNextResponse;
};
const { GET } = require('@/app/api/v1/customers/[id]/stored-value/route') as {
  GET: (
    request: InstanceType<typeof MockNextRequest>,
    context: { params: Promise<{ id: string }> }
  ) => Promise<InstanceType<typeof MockNextResponse>>;
};

describe('GET /api/v1/customers/[id]/stored-value', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires stored_value:view_balances and returns the tenant-scoped summary shape', async () => {
    const summary = {
      wallet: { walletId: 'wallet-1', balance: 45, currencyCode: 'OMR' },
      advance: { advanceId: null, balance: 0, currencyCode: null },
      creditNoteTotal: 10,
      creditNotes: [
        { id: 'cn-1', remaining_balance: 10, currency_code: 'OMR' },
      ],
    };

    requirePermissionMock.mockReturnValue(async () => ({ tenantId: 'tenant-1' }));
    getStoredValueSummaryMock.mockResolvedValue(summary);

    const response = await GET(
      new NextRequest('http://localhost/api/v1/customers/customer-1/stored-value'),
      { params: Promise.resolve({ id: 'customer-1' }) }
    );

    expect(requirePermissionMock).toHaveBeenCalledWith('stored_value:view_balances');
    expect(getStoredValueSummaryMock).toHaveBeenCalledWith('tenant-1', 'customer-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: summary });
  });

  it('passes through the auth response when permission middleware blocks access', async () => {
    const authResponse = NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    requirePermissionMock.mockReturnValue(async () => authResponse);

    const response = await GET(
      new NextRequest('http://localhost/api/v1/customers/customer-1/stored-value'),
      { params: Promise.resolve({ id: 'customer-1' }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Forbidden' });
    expect(getStoredValueSummaryMock).not.toHaveBeenCalled();
  });
});
