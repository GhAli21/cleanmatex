/**
 * Tests: app/actions/orders/get-order-financial.ts — BF-09 (Reusable Order Fin View)
 *
 * The action used to accept a caller-supplied tenantId and had no permission
 * check. It now takes only the order id, resolves the tenant from the session,
 * requires orders:read, and never returns internal error text.
 */

const mockGetAuthContext = jest.fn();
const mockHasPermissionServer = jest.fn();
const mockGetOrderFinancialSummary = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: (...a: unknown[]) => mockGetAuthContext(...a),
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/services/order-financial-summary.service', () => ({
  getOrderFinancialSummary: (...a: unknown[]) => mockGetOrderFinancialSummary(...a),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: (...a: unknown[]) => mockLoggerError(...a) },
}));

import { getOrderFinancialAction } from '@/app/actions/orders/get-order-financial';

const SESSION_TENANT = 'tenant-session-001';
const ORDER = 'order-001';

describe('getOrderFinancialAction (BF-09)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ tenantId: SESSION_TENANT, userId: 'user-001' });
    mockHasPermissionServer.mockResolvedValue(true);
    mockGetOrderFinancialSummary.mockResolvedValue({ snapshot: {} });
  });

  it('accepts only the order id (no caller-supplied tenant)', () => {
    expect(getOrderFinancialAction.length).toBe(1);
  });

  it('loads the summary for the session tenant, never another tenant', async () => {
    const result = await getOrderFinancialAction(ORDER);

    expect(result.success).toBe(true);
    expect(mockGetOrderFinancialSummary).toHaveBeenCalledTimes(1);
    expect(mockGetOrderFinancialSummary).toHaveBeenCalledWith(SESSION_TENANT, ORDER);
  });

  it('requires orders:read', async () => {
    mockHasPermissionServer.mockResolvedValue(false);

    const result = await getOrderFinancialAction(ORDER);

    expect(mockHasPermissionServer).toHaveBeenCalledWith('orders:read');
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(mockGetOrderFinancialSummary).not.toHaveBeenCalled();
  });

  it('rejects when there is no session tenant', async () => {
    mockGetAuthContext.mockResolvedValue({ tenantId: null, userId: null });

    const result = await getOrderFinancialAction(ORDER);

    expect(result).toEqual({ success: false, error: 'UNAUTHENTICATED' });
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
    expect(mockGetOrderFinancialSummary).not.toHaveBeenCalled();
  });

  it('logs the internal error and returns only a generic code', async () => {
    mockGetOrderFinancialSummary.mockRejectedValue(
      new Error('No org_orders_mst found for id order-001 in tenant tenant-session-001'),
    );

    const result = await getOrderFinancialAction(ORDER);

    expect(result).toEqual({ success: false, error: 'FETCH_FAILED' });
    expect(JSON.stringify(result)).not.toContain('org_orders_mst');
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });
});
