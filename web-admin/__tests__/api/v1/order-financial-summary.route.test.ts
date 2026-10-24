/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { NotFoundError } from '@/lib/errors/base-errors';

const requirePermissionFactory = jest.fn();
const permissionHandler = jest.fn();
const getOrderFinancialSummaryMock = jest.fn();
const loggerErrorMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionFactory(...args),
}));

jest.mock('@/lib/services/order-financial-summary.service', () => ({
  getOrderFinancialSummary: (...args: unknown[]) => getOrderFinancialSummaryMock(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerErrorMock(...args) },
}));

import { GET } from '@/app/api/v1/orders/[id]/financial-summary/route';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER = '33333333-3333-3333-3333-333333333333';
const call = () =>
  GET({} as NextRequest, { params: Promise.resolve({ id: ORDER }) });

describe('GET /api/v1/orders/[id]/financial-summary (BF-10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionFactory.mockReturnValue(permissionHandler);
    permissionHandler.mockResolvedValue({ tenantId: TENANT, userId: 'u1' });
  });

  it('returns the summary for the session tenant', async () => {
    getOrderFinancialSummaryMock.mockResolvedValue({ snapshot: { orderId: ORDER } });

    const response = await call();

    expect(requirePermissionFactory).toHaveBeenCalledWith('orders:view_financial_breakdown');
    expect(getOrderFinancialSummaryMock).toHaveBeenCalledWith(TENANT, ORDER);
    expect(response.status).toBe(200);
  });

  it('answers 404 for a missing order', async () => {
    getOrderFinancialSummaryMock.mockRejectedValue(new NotFoundError('Order', ORDER));

    const response = await call();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Order not found',
      code: 'ORDER_NOT_FOUND',
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('answers a generic 500, logs the error and never echoes internal text', async () => {
    getOrderFinancialSummaryMock.mockRejectedValue(new Error('relation "secret_table" does not exist'));

    const response = await call();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch financial summary');
    expect(JSON.stringify(body)).not.toContain('secret_table');
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });
});
