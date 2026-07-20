/**
 * Tests: app/actions/billing/refund-actions.ts — initiateOrderRefund
 * REFUND_AND_REBILL permission gate (B27)
 *
 * Before this fix `rebillAuthorized` was only excluded from the param type
 * via `Omit<InitiateRefundParams, 'requestedBy'>` — `rebillAuthorized` itself
 * was NOT omitted, so a direct call to this server action (bypassing the UI,
 * which never sets it) could pass `rebillAuthorized: true` straight through.
 * This action must now resolve it itself, server-side, from the real
 * permission — ignoring anything the caller might try to pass.
 */

const mockGetAuthContext = jest.fn();
const mockHasPermissionServer = jest.fn();
const mockInitiateRefund = jest.fn();

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: (...a: unknown[]) => mockGetAuthContext(...a),
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/services/order-refund.service', () => {
  const actual = jest.requireActual('@/lib/services/order-refund.service');
  return {
    ...actual,
    initiateRefund: (...a: unknown[]) => mockInitiateRefund(...a),
  };
});

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { initiateOrderRefund } from '@/app/actions/billing/refund-actions';

const TENANT = 'tenant-refund-action-001';

const baseParams = {
  orderId: 'order-1',
  amount: 30,
  reason: 'OVERCHARGE' as const,
  method: 'CASH' as const,
  currencyCode: 'OMR',
  idempotencyKey: 'refund-action-key-1',
};

describe('initiateOrderRefund — rebillAuthorized server-resolved (B27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ tenantId: TENANT, userId: 'user-1' });
  });

  it('denies REFUND_AND_REBILL when the actor lacks orders:rebill_authorize, without calling initiateRefund', async () => {
    mockHasPermissionServer.mockResolvedValue(false);

    const result = await initiateOrderRefund({
      ...baseParams,
      refundContext: 'REFUND_AND_REBILL' as never,
    });

    expect(result).toEqual({
      success: false,
      error: 'Permission denied: orders:rebill_authorize required for REFUND_AND_REBILL',
    });
    expect(mockInitiateRefund).not.toHaveBeenCalled();
  });

  it('forwards rebillAuthorized: true when the actor holds orders:rebill_authorize', async () => {
    mockHasPermissionServer.mockResolvedValue(true);
    mockInitiateRefund.mockResolvedValue({ id: 'refund-1' });

    const result = await initiateOrderRefund({
      ...baseParams,
      refundContext: 'REFUND_AND_REBILL' as never,
    });

    expect(result).toEqual({ success: true, data: { id: 'refund-1' } });
    expect(mockInitiateRefund).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ rebillAuthorized: true })
    );
  });

  it('ignores a client-supplied rebillAuthorized on a non-rebill context — always forwards false', async () => {
    mockInitiateRefund.mockResolvedValue({ id: 'refund-2' });

    const result = await initiateOrderRefund({
      ...baseParams,
      refundContext: 'STANDARD' as never,
      // @ts-expect-error — rebillAuthorized is intentionally excluded from the accepted type
      rebillAuthorized: true,
    });

    expect(result).toEqual({ success: true, data: { id: 'refund-2' } });
    expect(mockInitiateRefund).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ rebillAuthorized: false })
    );
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
  });
});
