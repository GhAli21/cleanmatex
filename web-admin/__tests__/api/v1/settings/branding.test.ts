/** @jest-environment node */
/**
 * Settings → Branding API tests.
 *
 * Covers Zod hex validation and that the route never takes a logo URL from the client
 * (the logo is a File Util upload that publishes org_tenants_mst.logo_url itself).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: jest.fn(),
}));
jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: jest.fn(),
}));
jest.mock('@/lib/middleware/rate-limit', () => ({
  checkAPIRateLimitTenant: jest.fn(),
}));
jest.mock('@/lib/services/tenant-profile.service', () => {
  const actual = jest.requireActual('@/lib/services/tenant-profile.service');
  return {
    ...(actual as object),
    getTenantProfile: jest.fn(),
    updateTenantBranding: jest.fn(),
  };
});
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const TENANT_A = '00000000-0000-0000-0000-00000000000a';

beforeEach(() => {
  jest.clearAllMocks();
});

function authedAs(tenantId: string) {
  const { requirePermission } = require('@/lib/middleware/require-permission');
  requirePermission.mockReturnValue(async () => ({
    user: {},
    tenantId,
    userId: 'user-1',
    userName: 'tester',
  }));
  const { validateCSRF } = require('@/lib/middleware/csrf');
  validateCSRF.mockResolvedValue(null);
  const { checkAPIRateLimitTenant } = require('@/lib/middleware/rate-limit');
  checkAPIRateLimitTenant.mockResolvedValue(null);
}

describe('PUT /api/v1/settings/branding', () => {
  it('400 on invalid hex color', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    authedAs(TENANT_A);
    const req = new NextRequest('http://localhost/api/v1/settings/branding', {
      method: 'PUT',
      body: JSON.stringify({
        logo: '',
        primaryColor: 'blue',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors.primaryColor).toBeTruthy();
  });

  it('ignores a logo URL sent by the client and saves only colors', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    const { updateTenantBranding } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantBranding.mockResolvedValue({
      branding: { logo: '', primaryColor: '#3B82F6', secondaryColor: '#10B981', accentColor: '#F59E0B' },
    });
    const req = new NextRequest('http://localhost/api/v1/settings/branding', {
      method: 'PUT',
      body: JSON.stringify({
        logo: 'https://attacker.example/evil.svg',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(updateTenantBranding.mock.calls[0][0]).toBe(TENANT_A);
    expect(updateTenantBranding.mock.calls[0][1]).toEqual({
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
      accentColor: '#F59E0B',
    });
  });
});
