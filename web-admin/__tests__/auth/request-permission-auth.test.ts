/** @jest-environment node */

import { NextRequest } from 'next/server';

const requirePermissionFactoryMock = jest.fn();
const permissionHandlerMock = jest.fn();
const getUserMock = jest.fn();
const rpcMock = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionFactoryMock(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createBearerSupabaseClient: jest.fn(() => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
    rpc: (...args: unknown[]) => rpcMock(...args),
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

import {
  requireRequestPermission,
  usesBearerAuthentication,
} from '@/lib/auth/request-permission-auth';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function request(headers: Record<string, string> = {}) {
  return new NextRequest('https://cmx.cleanmatex.com/api/v1/pickup/orders/order/complete', {
    method: 'POST',
    headers,
  });
}

describe('request permission authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionHandlerMock.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: USER_ID,
      userName: 'Session User',
    });
    requirePermissionFactoryMock.mockReturnValue(permissionHandlerMock);
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'api.user@cleanmatex.test',
          user_metadata: { tenant_org_id: TENANT_ID, full_name: 'API User' },
        },
      },
      error: null,
    });
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it('preserves cookie-session permission checks when no bearer header exists', async () => {
    const result = await requireRequestPermission(request(), 'orders:transition');

    expect(result).toMatchObject({ tenantId: TENANT_ID, userId: USER_ID, mode: 'session' });
    expect(requirePermissionFactoryMock).toHaveBeenCalledWith('orders:transition');
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('verifies a bearer token and evaluates the permission through its RLS context', async () => {
    const result = await requireRequestPermission(
      request({ Authorization: 'Bearer verified-mobile-jwt' }),
      'orders:transition',
    );

    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      userId: USER_ID,
      userName: 'API User',
      mode: 'bearer',
    });
    expect(getUserMock).toHaveBeenCalledWith('verified-mobile-jwt');
    expect(rpcMock).toHaveBeenCalledWith('has_permission', { p_permission: 'orders:transition' });
  });

  it('rejects malformed authorization instead of falling back to a browser session', async () => {
    const result = await requireRequestPermission(
      request({ Authorization: 'Basic unsafe-fallback' }),
      'orders:transition',
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(requirePermissionFactoryMock).not.toHaveBeenCalled();
  });

  it('reports bearer authorization as explicit so cookie CSRF is not applied to it', () => {
    expect(usesBearerAuthentication(request({ Authorization: 'Bearer verified-mobile-jwt' }))).toBe(true);
    expect(usesBearerAuthentication(request())).toBe(false);
  });
});
