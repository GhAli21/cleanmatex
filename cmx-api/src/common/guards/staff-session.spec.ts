import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantGuard } from './tenant.guard';
import { StaffSessionService } from '../session/staff-session.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const SECRET = 'test-secret-test-secret-test-secret';
const SESSION_ORG = '11111111-1111-4111-8111-111111111111';
const CLAIM_ORG = '22222222-2222-4222-8222-222222222222';
const HEADER_ORG = '33333333-3333-4333-8333-333333333333';

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('staff session authority', () => {
  const rpc = jest.fn();

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
    rpc.mockReset();
    (createClient as jest.Mock).mockReturnValue({ rpc });
  });

  it('ignores a tenant claim on the token', () => {
    const token = jwt.sign({ sub: 'user-1', tenant_org_id: CLAIM_ORG }, SECRET);
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    expect(new JwtAuthGuard().canActivate(contextFor(request))).toBe(true);
    expect(request.userId).toBe('user-1');
    expect(request.tenantOrgId).toBeUndefined();
    expect(request.accessToken).toBe(token);
  });

  it('uses the ACTIVE session organization and ignores X-Tenant-Id', async () => {
    rpc.mockResolvedValue({
      data: [{ state: 'ACTIVE', tenant_org_id: SESSION_ORG }],
      error: null,
    });
    const token = jwt.sign({ sub: 'user-1', tenant_org_id: CLAIM_ORG }, SECRET);
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': HEADER_ORG },
      tenantOrgId: CLAIM_ORG,
    };
    new JwtAuthGuard().canActivate(contextFor(request));

    const config = {
      get: (key: string) => (key === 'SUPABASE_URL' ? 'http://localhost' : key === 'SUPABASE_ANON_KEY' ? 'anon' : undefined),
    } as ConfigService;
    const guard = new TenantGuard(new StaffSessionService(config));
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.tenantOrgId).toBe(SESSION_ORG);
    expect(createClient).toHaveBeenCalledWith(
      'http://localhost',
      'anon',
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    expect(rpc).toHaveBeenCalledWith('fn_auth_session_validate', { p_touch: false });
  });

  it('rejects a pending sign-in even when a header names an organization', async () => {
    rpc.mockResolvedValue({
      data: [{ state: 'PENDING', tenant_org_id: null }],
      error: null,
    });
    const config = {
      get: (key: string) => (key === 'SUPABASE_URL' ? 'http://localhost' : 'anon'),
    } as ConfigService;
    const guard = new TenantGuard(new StaffSessionService(config));
    const request = {
      headers: { 'x-tenant-id': HEADER_ORG },
      accessToken: 'token',
      tenantOrgId: HEADER_ORG,
    };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.tenantOrgId).toBe(HEADER_ORG);
  });
});
