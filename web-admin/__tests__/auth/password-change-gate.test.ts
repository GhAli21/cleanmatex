/**
 * Forced-password-change gate of the API validator: while an administrator-set temporary password is pending,
 * business endpoints answer 403 PASSWORD_CHANGE_REQUIRED and only /api/auth/* stays reachable.
 *
 * @jest-environment node
 */

const mockGuardSession = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@example.com' } }, error: null }) } }),
}));
jest.mock('@/lib/auth/session-guard', () => ({
  guardSession: (...a: unknown[]) => mockGuardSession(...a),
  isSessionActive: (v: { state: string }) => v.state === 'ACTIVE',
  sessionEndedResponse: () => new Response(null, { status: 401 }),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';

const active = (mustChangePassword: boolean) => ({
  state: 'ACTIVE',
  endReason: null,
  tenantOrgId: 'tenant-1',
  idleRemainingSec: 100,
  absoluteRemainingSec: 1000,
  idleWarningSec: 60,
  mustChangePassword,
});

function req(pathname: string) {
  return { nextUrl: { pathname }, headers: new Headers(), cookies: { get: () => undefined } } as never;
}

beforeEach(() => mockGuardSession.mockReset());

describe('validateJWTWithTenant — pending forced password change', () => {
  it('blocks business endpoints with PASSWORD_CHANGE_REQUIRED', async () => {
    mockGuardSession.mockResolvedValue(active(true));
    const res = (await validateJWTWithTenant(req('/api/orders'))) as Response;
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('still allows the auth endpoints (change password, sign out, heartbeat)', async () => {
    mockGuardSession.mockResolvedValue(active(true));
    const ctx = await validateJWTWithTenant(req('/api/auth/password/change'));
    expect(ctx).toMatchObject({ tenantId: 'tenant-1', userId: 'u1', mustChangePassword: true });
  });

  it('does not interfere when no change is pending', async () => {
    mockGuardSession.mockResolvedValue(active(false));
    const ctx = await validateJWTWithTenant(req('/api/orders'));
    expect(ctx).toMatchObject({ tenantId: 'tenant-1', mustChangePassword: false });
  });
});
