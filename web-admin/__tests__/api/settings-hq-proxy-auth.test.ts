/** @jest-environment node */
/**
 * Settings HQ proxy authorization tests.
 *
 * Browser requests use cookie-backed sessions, so every proxy must pass the
 * server-resolved bearer token to HQ and effective settings must stay tenant-bound.
 */

import { NextRequest } from 'next/server';

const requireAuth = jest.fn();
const getSessionAuthorizationHeader = jest.fn();
const getCurrentTenant = jest.fn();
const getSettingsCategories = jest.fn();
const getSettingsCatalog = jest.fn();
const getEffectiveSettings = jest.fn();

jest.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => requireAuth(...args),
  getSessionAuthorizationHeader: (...args: unknown[]) => getSessionAuthorizationHeader(...args),
}));
jest.mock('@/lib/services/tenants.service', () => ({
  getCurrentTenant: (...args: unknown[]) => getCurrentTenant(...args),
}));
jest.mock('@/lib/api/hq-api-client', () => ({
  hqApiClient: {
    getSettingsCategories: (...args: unknown[]) => getSettingsCategories(...args),
    getSettingsCatalog: (...args: unknown[]) => getSettingsCatalog(...args),
    getEffectiveSettings: (...args: unknown[]) => getEffectiveSettings(...args),
  },
}));

import { GET as getCategories } from '@/app/api/settings/categories/route';
import { GET as getCatalog } from '@/app/api/settings/catalog/route';
import { GET as getEffective } from '@/app/api/settings/tenants/[tenantId]/effective/route';

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';
const auth = { user: { id: 'user-1' }, supabase: {} };

function effectiveRequest(tenantId: string, query = '') {
  return getEffective(
    new NextRequest(`http://localhost/api/settings/tenants/${tenantId}/effective${query}`),
    { params: Promise.resolve({ tenantId }) },
  );
}

describe('settings HQ proxy authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuth.mockResolvedValue(auth);
    getSessionAuthorizationHeader.mockResolvedValue('Bearer tenant-session-token');
    getCurrentTenant.mockResolvedValue({ id: TENANT_A });
    getSettingsCategories.mockResolvedValue({ data: [] });
    getSettingsCatalog.mockResolvedValue({ data: [] });
    getEffectiveSettings.mockResolvedValue([]);
  });

  it('uses the server-resolved session bearer token for shared settings catalogs', async () => {
    expect((await getCategories(new NextRequest('http://localhost/api/settings/categories'))).status).toBe(200);
    expect(getSettingsCategories).toHaveBeenCalledWith(expect.objectContaining({ authHeader: 'Bearer tenant-session-token' }));

    expect((await getCatalog(new NextRequest('http://localhost/api/settings/catalog'))).status).toBe(200);
    expect(getSettingsCatalog).toHaveBeenCalledWith(expect.objectContaining({ authHeader: 'Bearer tenant-session-token' }));
  });

  it('uses the authenticated tenant and session token for effective settings', async () => {
    const response = await effectiveRequest('me', '?userId=me');

    expect(response.status).toBe(200);
    expect(getEffectiveSettings).toHaveBeenCalledWith(TENANT_A, {
      branchId: undefined,
      userId: 'user-1',
      authHeader: 'Bearer tenant-session-token',
    });
  });

  it('rejects an explicit tenant ID that differs from the server-resolved tenant', async () => {
    const response = await effectiveRequest(TENANT_B);

    expect(response.status).toBe(403);
    expect(getEffectiveSettings).not.toHaveBeenCalled();
  });

  it('does not fall back to a shared token when the authenticated session has no access token', async () => {
    getSessionAuthorizationHeader.mockResolvedValue(null);

    const response = await effectiveRequest('me');

    expect(response.status).toBe(401);
    expect(getEffectiveSettings).not.toHaveBeenCalled();
  });
});
