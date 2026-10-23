/**
 * Tests: lib/auth/server-action-guard.ts — BF-20
 */

const mockGetAuthContext = jest.fn();
const mockHasPermissionServer = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: (...a: unknown[]) => mockGetAuthContext(...a),
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockLoggerWarn(...a), error: jest.fn(), info: jest.fn() },
}));

import { resolveActionTenant } from '@/lib/auth/server-action-guard';

const SESSION_TENANT = 'tenant-session';
const USER = 'user-1';

describe('resolveActionTenant (BF-20)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ tenantId: SESSION_TENANT, userId: USER });
    mockHasPermissionServer.mockResolvedValue(true);
  });

  it('returns the session tenant and user', async () => {
    await expect(resolveActionTenant({ action: 't' })).resolves.toEqual({
      ok: true,
      tenantId: SESSION_TENANT,
      userId: USER,
    });
  });

  it('accepts a caller tenant equal to the session tenant', async () => {
    const result = await resolveActionTenant({ action: 't', expectedTenantId: SESSION_TENANT });
    expect(result.ok).toBe(true);
  });

  it('rejects and logs a caller tenant that differs from the session tenant', async () => {
    const result = await resolveActionTenant({ action: 'orders.getOrder', expectedTenantId: 'tenant-other' });

    expect(result).toEqual({ ok: false, error: 'TENANT_MISMATCH' });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('caller tenant differs'),
      expect.objectContaining({ sessionTenantId: SESSION_TENANT, callerTenantId: 'tenant-other', action: 'orders.getOrder' }),
    );
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
  });

  it('returns UNAUTHENTICATED when there is no session (getAuthContext throws)', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    await expect(resolveActionTenant({ action: 't' })).resolves.toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('returns UNAUTHENTICATED when the session has no tenant or user', async () => {
    mockGetAuthContext.mockResolvedValue({ tenantId: '', userId: USER });
    await expect(resolveActionTenant({ action: 't' })).resolves.toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('checks the required permission', async () => {
    mockHasPermissionServer.mockResolvedValue(false);

    const result = await resolveActionTenant({ action: 't', permission: 'orders:read' });

    expect(mockHasPermissionServer).toHaveBeenCalledWith('orders:read');
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('skips the permission check when none is required', async () => {
    await resolveActionTenant({ action: 't' });
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
  });
});
