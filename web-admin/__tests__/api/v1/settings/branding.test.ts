/** @jest-environment node */
/**
 * Settings → Branding API (Organization saved themes, PR-07).
 *
 * The tenant always comes from the session, bodies are strict Zod (no ids, no
 * tenant, no logo URL), writes need settings:branding + CSRF, and service
 * refusals map to clear statuses.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: jest.fn() }));
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: jest.fn() }));
jest.mock('@/lib/middleware/rate-limit', () => ({ checkAPIRateLimitTenant: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/services/feature-flags.service', () => ({ getFeatureFlags: jest.fn() }));
jest.mock('@/lib/services/org-ui-theme.service', () => {
  const actual = jest.requireActual('@/lib/services/org-ui-theme.service') as Record<string, unknown>;
  return {
    UiThemeError: actual.UiThemeError,
    uiThemeErrorStatus: actual.uiThemeErrorStatus,
    listOrgThemes: jest.fn(),
    getUiThemeCatalog: jest.fn(),
    createOrgTheme: jest.fn(),
    updateOrgTheme: jest.fn(),
    activateOrgTheme: jest.fn(),
    deleteOrgTheme: jest.fn(),
  };
});
jest.mock('server-only', () => ({}));

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const ID = '3f2b8c1e-4a5d-4e6f-8a7b-1c2d3e4f5a6b';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = () => require('@/lib/services/org-ui-theme.service') as Record<string, any>;
const params = { params: Promise.resolve({ id: ID }) };

function authedAs(tenantId: string) {
  const { requirePermission } = require('@/lib/middleware/require-permission');
  requirePermission.mockImplementation(() => async () => ({ user: {}, tenantId, userId: 'user-1', userName: 'tester' }));
  require('@/lib/middleware/csrf').validateCSRF.mockResolvedValue(null);
  require('@/lib/middleware/rate-limit').checkAPIRateLimitTenant.mockResolvedValue(null);
  require('@/lib/services/feature-flags.service').getFeatureFlags.mockResolvedValue({ custom_branding: true, white_label: false });
}

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/v1/settings/branding/themes', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  authedAs(TENANT_A);
});

describe('GET /api/v1/settings/branding', () => {
  it('returns the session Organization themes, the HQ catalog and the plan limits', async () => {
    const { GET } = require('@/app/api/v1/settings/branding/route');
    svc().listOrgThemes.mockResolvedValue([{ id: ID }]);
    svc().getUiThemeCatalog.mockResolvedValue({ themes: [], radii: [], fonts: [] });
    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    expect(svc().listOrgThemes).toHaveBeenCalledWith(TENANT_A);
    expect((await res.json()).data).toEqual({
      themes: [{ id: ID }],
      catalog: { themes: [], radii: [], fonts: [] },
      plan: { customBranding: true, whiteLabel: false },
    });
    expect(require('@/lib/middleware/require-permission').requirePermission).toHaveBeenCalledWith('settings:read');
  });
});

describe('POST /api/v1/settings/branding/themes', () => {
  it('creates for the session Organization with settings:branding', async () => {
    const { POST } = require('@/app/api/v1/settings/branding/themes/route');
    svc().createOrgTheme.mockResolvedValue({ id: ID });
    const res = await POST(req('POST', { theme_name: 'Main', ui_theme_code: 'OCEAN' }));
    expect(res.status).toBe(201);
    expect(svc().createOrgTheme).toHaveBeenCalledWith(TENANT_A, { theme_name: 'Main', ui_theme_code: 'OCEAN' }, expect.objectContaining({ userId: 'user-1' }));
    expect(require('@/lib/middleware/require-permission').requirePermission).toHaveBeenCalledWith('settings:branding');
  });

  it('400 on a bad colour or on any field outside the schema (tenant, id, logo)', async () => {
    const { POST } = require('@/app/api/v1/settings/branding/themes/route');
    expect((await POST(req('POST', { theme_name: 'X', ui_theme_code: 'OCEAN', brand_color_primary: 'blue' }))).status).toBe(400);
    expect((await POST(req('POST', { theme_name: 'X', ui_theme_code: 'OCEAN', tenant_org_id: 'other' }))).status).toBe(400);
    expect((await POST(req('POST', { theme_name: 'X', ui_theme_code: 'OCEAN', logo_url: 'https://evil' }))).status).toBe(400);
    expect(svc().createOrgTheme).not.toHaveBeenCalled();
  });

  it('403 when the plan does not include the override', async () => {
    const { POST } = require('@/app/api/v1/settings/branding/themes/route');
    svc().createOrgTheme.mockRejectedValue(new (svc().UiThemeError)('FEATURE_NOT_IN_PLAN', 'no'));
    const res = await POST(req('POST', { theme_name: 'X', ui_theme_code: 'OCEAN', brand_color_primary: '#FACC15' }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FEATURE_NOT_IN_PLAN');
  });
});

describe('PATCH, DELETE and activate on /themes/[id]', () => {
  it('PATCH and activate pass the session tenant and the path id', async () => {
    const { PATCH } = require('@/app/api/v1/settings/branding/themes/[id]/route');
    const { POST } = require('@/app/api/v1/settings/branding/themes/[id]/activate/route');
    expect((await PATCH(req('PATCH', { theme_name: 'X', ui_theme_code: 'OCEAN' }), params)).status).toBe(200);
    expect(svc().updateOrgTheme.mock.calls[0].slice(0, 2)).toEqual([TENANT_A, ID]);
    expect((await POST(req('POST'), params)).status).toBe(200);
    expect(svc().activateOrgTheme.mock.calls[0].slice(0, 2)).toEqual([TENANT_A, ID]);
  });

  it('DELETE of the theme in use is 409; of a theme that is not ours is 404', async () => {
    const { DELETE } = require('@/app/api/v1/settings/branding/themes/[id]/route');
    svc().deleteOrgTheme.mockRejectedValueOnce(new (svc().UiThemeError)('THEME_IN_USE', 'in use'));
    expect((await DELETE(req('DELETE'), params)).status).toBe(409);
    svc().deleteOrgTheme.mockRejectedValueOnce(new (svc().UiThemeError)('NOT_FOUND', 'nope'));
    expect((await DELETE(req('DELETE'), params)).status).toBe(404);
  });

  it('a malformed id is 400 before any service call', async () => {
    const { DELETE } = require('@/app/api/v1/settings/branding/themes/[id]/route');
    expect((await DELETE(req('DELETE'), { params: Promise.resolve({ id: 'x' }) })).status).toBe(400);
    expect(svc().deleteOrgTheme).not.toHaveBeenCalled();
  });
});
