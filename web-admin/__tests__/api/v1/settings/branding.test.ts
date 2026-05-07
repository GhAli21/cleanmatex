/**
 * Settings → Branding API tests.
 *
 * Covers Zod hex validation and the host-validation guard that prevents
 * arbitrary URLs from being committed to org_tenants_mst.logo_url.
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
jest.mock('@/lib/storage/tenant-logo', () => ({
  deleteTenantLogo: jest.fn().mockResolvedValue(true),
  uploadTenantLogo: jest.fn(),
  getFileUrl: jest.fn(),
}));

const TENANT_A = '00000000-0000-0000-0000-00000000000a';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_STORAGE_URL = 'http://storage.example';
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

  it('400 on logo URL hosted off the storage domain', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    authedAs(TENANT_A);
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
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors.logo).toBeTruthy();
  });

  it('400 on logo URL hosted on storage domain but wrong tenant prefix', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    authedAs(TENANT_A);
    const req = new NextRequest('http://localhost/api/v1/settings/branding', {
      method: 'PUT',
      body: JSON.stringify({
        logo: 'http://storage.example/cleanmatex/tenants/other-tenant/logo/x.png',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('200 on valid storage-hosted logo and proper hex colors', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    const { updateTenantBranding } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantBranding.mockResolvedValue({
      branding: {
        logo: `http://storage.example/cleanmatex/tenants/${TENANT_A}/logo/x.png`,
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      },
      previousLogoUrl: null,
    });
    const req = new NextRequest('http://localhost/api/v1/settings/branding', {
      method: 'PUT',
      body: JSON.stringify({
        logo: `http://storage.example/cleanmatex/tenants/${TENANT_A}/logo/x.png`,
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(updateTenantBranding).toHaveBeenCalledTimes(1);
    expect(updateTenantBranding.mock.calls[0][0]).toBe(TENANT_A);
  });

  it('200 with empty logo (clearing)', async () => {
    const { PUT } = require('@/app/api/v1/settings/branding/route');
    const { updateTenantBranding } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantBranding.mockResolvedValue({
      branding: {
        logo: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      },
      previousLogoUrl: null,
    });
    const req = new NextRequest('http://localhost/api/v1/settings/branding', {
      method: 'PUT',
      body: JSON.stringify({
        logo: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        accentColor: '#F59E0B',
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });
});
