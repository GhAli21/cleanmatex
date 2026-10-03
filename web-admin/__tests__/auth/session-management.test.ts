/**
 * Session management rules — who may see/revoke which sessions.
 *
 * @jest-environment node
 */

const mockList = jest.fn();
const mockGet = jest.fn();
const mockEnd = jest.fn();
const mockRevokeUser = jest.fn();

jest.mock('@/lib/services/auth/session/auth-session.repository', () => ({
  listSessions: (...a: unknown[]) => mockList(...a),
  getSessionById: (...a: unknown[]) => mockGet(...a),
  endSession: (...a: unknown[]) => mockEnd(...a),
  revokeUserSessions: (...a: unknown[]) => mockRevokeUser(...a),
}));

import {
  SessionManagementError,
  listOwnSessions,
  listTenantSessions,
  revokeOtherOwnSessions,
  revokeOwnSession,
  revokeTenantSessions,
} from '@/lib/services/auth/session/use-cases/session-management';
import type { UserSessionRow } from '@/lib/types/auth-session';

const TENANT = 'tenant-1';
const ME = 'user-me';
const OTHER = 'user-other';
const CURRENT = 'auth-sess-current';

const row = (over: Partial<UserSessionRow> = {}): UserSessionRow => ({
  id: 'row-1',
  authSessionId: 'auth-sess-1',
  authUserId: ME,
  tenantOrgId: TENANT,
  status: 'ACTIVE',
  endReasonCode: null,
  endedAt: null,
  isRememberMe: false,
  expiresAt: '2030-01-01T00:00:00Z',
  lastActivityAt: '2029-01-01T00:00:00Z',
  loginIp: '10.0.0.1',
  lastIp: '10.0.0.2',
  deviceLabel: 'Chrome on Windows',
  createdAt: '2029-01-01T00:00:00Z',
  ...over,
});

// A fake admin client only needs the org_users_mst owner lookup used by listTenantSessions.
function adminWithOwners(owners: Array<Record<string, unknown>> = []) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.in = jest.fn(async () => ({ data: owners, error: null }));
  return { from: jest.fn(() => chain), __chain: chain } as never;
}
const admin = adminWithOwners();

beforeEach(() => {
  [mockList, mockGet, mockEnd, mockRevokeUser].forEach((m) => m.mockReset());
  mockEnd.mockResolvedValue(true);
});

describe('listOwnSessions', () => {
  it('lists only the caller ACTIVE sessions of the tenant, flags the current one and puts it first', async () => {
    mockList.mockResolvedValue({
      rows: [row({ id: 'a', authSessionId: 'x' }), row({ id: 'b', authSessionId: CURRENT })],
      total: 2,
    });
    const out = await listOwnSessions(admin, { tenantId: TENANT, userId: ME, currentAuthSessionId: CURRENT });

    expect(mockList).toHaveBeenCalledWith(admin, { tenantOrgId: TENANT, authUserId: ME, status: 'ACTIVE', limit: 100 });
    expect(out.map((s) => s.id)).toEqual(['b', 'a']);
    expect(out[0].isCurrent).toBe(true);
    expect(out[1].isCurrent).toBe(false);
  });

  it('never exposes the Supabase session id to the browser', async () => {
    mockList.mockResolvedValue({ rows: [row({ authSessionId: 'secret-session-id' })], total: 1 });
    const out = await listOwnSessions(admin, { tenantId: TENANT, userId: ME, currentAuthSessionId: null });
    expect(JSON.stringify(out)).not.toContain('secret-session-id');
    expect(out[0]).not.toHaveProperty('authSessionId');
  });
});

describe('revokeOwnSession', () => {
  const params = { tenantId: TENANT, userId: ME, currentAuthSessionId: CURRENT, sessionRowId: 'row-1' };

  it('ends another of the caller sessions as USER_REVOKED with the caller as actor', async () => {
    mockGet.mockResolvedValue(row({ authSessionId: 'auth-sess-1' }));
    await revokeOwnSession(admin, params);
    expect(mockGet).toHaveBeenCalledWith(admin, { tenantOrgId: TENANT, sessionRowId: 'row-1' });
    expect(mockEnd).toHaveBeenCalledWith(admin, { authSessionId: 'auth-sess-1', reason: 'USER_REVOKED', actorId: ME });
  });

  it('refuses to end the CURRENT session (that is sign out)', async () => {
    mockGet.mockResolvedValue(row({ authSessionId: CURRENT }));
    await expect(revokeOwnSession(admin, params)).rejects.toMatchObject({ code: 'CANNOT_REVOKE_CURRENT' });
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it("reports another user's session as NOT FOUND (no existence oracle) and never ends it", async () => {
    mockGet.mockResolvedValue(row({ authUserId: OTHER }));
    await expect(revokeOwnSession(admin, params)).rejects.toBeInstanceOf(SessionManagementError);
    await expect(revokeOwnSession(admin, params)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('NOT FOUND for unknown or already-ended sessions', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(revokeOwnSession(admin, params)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    mockGet.mockResolvedValueOnce(row({ status: 'ENDED' }));
    await expect(revokeOwnSession(admin, params)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});

describe('revokeOtherOwnSessions', () => {
  it('ends everything except the current session, as USER_REVOKED, scoped to the tenant', async () => {
    mockRevokeUser.mockResolvedValue(3);
    const n = await revokeOtherOwnSessions(admin, { tenantId: TENANT, userId: ME, currentAuthSessionId: CURRENT });
    expect(n).toBe(3);
    expect(mockRevokeUser).toHaveBeenCalledWith(admin, {
      authUserId: ME,
      tenantOrgId: TENANT,
      reason: 'USER_REVOKED',
      exceptAuthSessionId: CURRENT,
      actorId: ME,
    });
  });
});

describe('listTenantSessions (administrators)', () => {
  it('always filters by the admin tenant and attaches owner details from the same tenant', async () => {
    mockList.mockResolvedValue({ rows: [row({ authUserId: ME }), row({ id: 'row-2', authUserId: OTHER })], total: 2 });
    const a = adminWithOwners([{ user_id: ME, display_name: 'Mona', user_code: 'U000001', email: 'mona@x.com' }]);

    const out = await listTenantSessions(a, { tenantId: TENANT, currentAuthSessionId: null, limit: 25, offset: 50 });

    expect(mockList).toHaveBeenCalledWith(a, { tenantOrgId: TENANT, authUserId: undefined, status: 'ACTIVE', limit: 25, offset: 50 });
    expect(out.total).toBe(2);
    expect(out.sessions[0].user).toEqual({ userId: ME, displayName: 'Mona', userCode: 'U000001', email: 'mona@x.com' });
    // Owner without a row in the tenant (should not happen) degrades to nulls, never throws.
    expect(out.sessions[1].user).toEqual({ userId: OTHER, displayName: null, userCode: null, email: null });
    expect((a as never as { __chain: { eq: jest.Mock } }).__chain.eq).toHaveBeenCalledWith('tenant_org_id', TENANT);
  });
});

describe('revokeTenantSessions (administrators)', () => {
  const base = { tenantId: TENANT, actorId: 'admin-1', currentAuthSessionId: CURRENT };

  it('ends selected sessions of the tenant as ADMIN_REVOKED and counts unknown ids', async () => {
    mockGet
      .mockResolvedValueOnce(row({ id: 'r1', authSessionId: 's1' }))
      .mockResolvedValueOnce(null) // not in this tenant
      .mockResolvedValueOnce(row({ id: 'r3', authSessionId: 's3', status: 'ENDED' })); // already ended

    const res = await revokeTenantSessions(admin, { ...base, sessionRowIds: ['r1', 'r2', 'r3', 'r1'] });

    expect(res).toEqual({ revoked: 1, notFound: 2, skippedCurrent: false });
    expect(mockGet).toHaveBeenCalledTimes(3); // duplicate id de-duplicated
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledWith(admin, { authSessionId: 's1', reason: 'ADMIN_REVOKED', actorId: 'admin-1' });
  });

  it('never ends the administrator own current session, even when selected', async () => {
    mockGet.mockResolvedValueOnce(row({ id: 'r1', authSessionId: CURRENT }));
    const res = await revokeTenantSessions(admin, { ...base, sessionRowIds: ['r1'] });
    expect(res).toEqual({ revoked: 0, notFound: 0, skippedCurrent: true });
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('"all" ends every ACTIVE session of the tenant except the admin current one', async () => {
    mockList.mockResolvedValueOnce({
      rows: [row({ authSessionId: 's1' }), row({ authSessionId: CURRENT }), row({ authSessionId: 's3' })],
      total: 3,
    });
    const res = await revokeTenantSessions(admin, { ...base, all: true });
    expect(mockList).toHaveBeenCalledWith(admin, { tenantOrgId: TENANT, status: 'ACTIVE', limit: 200, offset: 0 });
    expect(res).toEqual({ revoked: 2, notFound: 0, skippedCurrent: true });
  });

  it('"all" pages through more than one page of sessions', async () => {
    const page = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => row({ id: `${prefix}${i}`, authSessionId: `${prefix}${i}` }));
    mockList.mockResolvedValueOnce({ rows: page(200, 'a'), total: 250 }).mockResolvedValueOnce({ rows: page(50, 'b'), total: 250 });
    const res = await revokeTenantSessions(admin, { ...base, all: true });
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenLastCalledWith(admin, { tenantOrgId: TENANT, status: 'ACTIVE', limit: 200, offset: 200 });
    expect(res.revoked).toBe(250);
  });

  it('does nothing when neither ids nor "all" are given', async () => {
    const res = await revokeTenantSessions(admin, base);
    expect(res).toEqual({ revoked: 0, notFound: 0, skippedCurrent: false });
    expect(mockEnd).not.toHaveBeenCalled();
  });
});
