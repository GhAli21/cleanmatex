/**
 * Settings → General API tests.
 *
 * Style mirrors __tests__/api/v1/orders.test.ts: middleware mocked,
 * service mocked, focus on response shape, validation, and the
 * defence-in-depth contracts (tenant comes from session, not body).
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
    updateTenantGeneral: jest.fn(),
  };
});
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';

const validBody = {
  businessName: 'Acme Laundry',
  businessNameAr: 'مغسلة أكمي',
  email: 'a@a.com',
  phone: '+96891234567',
  address: '1 Street',
  city: 'Muscat',
  country: 'OM',
  timezone: 'Asia/Muscat',
  currency: 'OMR',
  defaultLanguage: 'en',
  businessHours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  },
};

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

describe('GET /api/v1/settings/general', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current tenant profile', async () => {
    const { GET } = require('@/app/api/v1/settings/general/route');
    const { getTenantProfile } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    getTenantProfile.mockResolvedValue({
      general: { ...validBody, isLocked: { currency: false, country: false } },
      branding: {},
    });

    const res = await GET(new NextRequest('http://localhost/api/v1/settings/general'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(getTenantProfile).toHaveBeenCalledWith(TENANT_A);
  });
});

describe('PUT /api/v1/settings/general', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 on valid payload and uses session tenant, not body id', async () => {
    const { PUT } = require('@/app/api/v1/settings/general/route');
    const { updateTenantGeneral } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantGeneral.mockResolvedValue({
      ...validBody,
      isLocked: { currency: false, country: false },
    });

    const req = new NextRequest('http://localhost/api/v1/settings/general', {
      method: 'PUT',
      body: JSON.stringify({ ...validBody, id: TENANT_B }), // attacker id
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(updateTenantGeneral).toHaveBeenCalledTimes(1);
    expect(updateTenantGeneral.mock.calls[0][0]).toBe(TENANT_A); // not TENANT_B
  });

  it('400 on invalid email', async () => {
    const { PUT } = require('@/app/api/v1/settings/general/route');
    authedAs(TENANT_A);
    const req = new NextRequest('http://localhost/api/v1/settings/general', {
      method: 'PUT',
      body: JSON.stringify({ ...validBody, email: 'not-an-email' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors.email).toBeTruthy();
  });

  it('400 on bad business-hours time format', async () => {
    const { PUT } = require('@/app/api/v1/settings/general/route');
    authedAs(TENANT_A);
    const broken = {
      ...validBody,
      businessHours: { ...validBody.businessHours, monday: { open: '9am', close: '18:00', closed: false } },
    };
    const req = new NextRequest('http://localhost/api/v1/settings/general', {
      method: 'PUT',
      body: JSON.stringify(broken),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('409 when service throws CURRENCY_LOCKED', async () => {
    const { PUT } = require('@/app/api/v1/settings/general/route');
    const { updateTenantGeneral, TenantProfileError } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantGeneral.mockRejectedValue(
      new TenantProfileError('CURRENCY_LOCKED', 'Currency cannot be changed after orders have been created')
    );
    const req = new NextRequest('http://localhost/api/v1/settings/general', {
      method: 'PUT',
      body: JSON.stringify(validBody),
    });
    const res = await PUT(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe('CURRENCY_LOCKED');
    expect(json.fieldErrors.currency).toBeTruthy();
  });

  it('409 when service throws EMAIL_TAKEN', async () => {
    const { PUT } = require('@/app/api/v1/settings/general/route');
    const { updateTenantGeneral, TenantProfileError } = require('@/lib/services/tenant-profile.service');
    authedAs(TENANT_A);
    updateTenantGeneral.mockRejectedValue(new TenantProfileError('EMAIL_TAKEN', 'Email is already in use'));
    const req = new NextRequest('http://localhost/api/v1/settings/general', {
      method: 'PUT',
      body: JSON.stringify(validBody),
    });
    const res = await PUT(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe('EMAIL_TAKEN');
  });
});
