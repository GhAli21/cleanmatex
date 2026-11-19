/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

const mockRequirePermission = jest.fn();
const mockValidateCSRF = jest.fn();
const mockRateLimit = jest.fn();
const mockGetScreenData = jest.fn();
const mockUpsertBatch = jest.fn();
const mockResetKey = jest.fn();
const mockResetAll = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => mockRequirePermission,
}));

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

jest.mock('@/lib/middleware/rate-limit', () => ({
  checkAPIRateLimitTenant: (...args: unknown[]) => mockRateLimit(...args),
}));

jest.mock('@/lib/services/tenant-extra-config.service', () => {
  const actual = jest.requireActual('@/lib/services/tenant-extra-config.service');
  return {
    ...actual,
    getExtraConfigScreenData: (...args: unknown[]) => mockGetScreenData(...args),
    upsertTenantExtraConfigBatch: (...args: unknown[]) => mockUpsertBatch(...args),
    resetTenantExtraConfigKey: (...args: unknown[]) => mockResetKey(...args),
    resetAllTenantExtraConfig: (...args: unknown[]) => mockResetAll(...args),
  };
});

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { DELETE as DELETE_ALL, GET, PUT } from '@/app/api/v1/settings/extra-config/route';
import { DELETE as DELETE_KEY } from '@/app/api/v1/settings/extra-config/[key]/route';
import { ExtraConfigError } from '@/lib/services/tenant-extra-config.service';

describe('/api/v1/settings/extra-config routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermission.mockResolvedValue({ tenantId: 't-1', userId: 'u-1' });
    mockValidateCSRF.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(null);
  });

  it('GET returns screen payload with Cache-Control: private, no-store', async () => {
    mockGetScreenData.mockResolvedValueOnce({ resolved: { numberScript: 'LATN' }, items: [] });
    const req = new NextRequest('http://localhost/api/v1/settings/extra-config');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockGetScreenData).toHaveBeenCalledWith('t-1');
  });

  it('PUT enforces CSRF and Zod schema before calling upsert', async () => {
    mockValidateCSRF.mockResolvedValueOnce(
      NextResponse.json({ error: 'Invalid CSRF' }, { status: 403 })
    );
    const csrfReq = new NextRequest('http://localhost/api/v1/settings/extra-config', {
      method: 'PUT',
      body: JSON.stringify({ entries: [{ config_key: 'NUMBER_SCRIPT', config_value: 'ARAB' }] }),
    });
    expect((await PUT(csrfReq)).status).toBe(403);
    expect(mockUpsertBatch).not.toHaveBeenCalled();

    const badReq = new NextRequest('http://localhost/api/v1/settings/extra-config', {
      method: 'PUT',
      body: JSON.stringify({ entries: [] }),
    });
    expect((await PUT(badReq)).status).toBe(400);
    expect(mockUpsertBatch).not.toHaveBeenCalled();
  });

  it('PUT maps ExtraConfigError to proper HTTP status and DELETE resets key/all', async () => {
    mockUpsertBatch.mockRejectedValueOnce(
      new ExtraConfigError('FEATURE_NOT_IN_PLAN', 'Plan restricted', 'NUMBER_SCRIPT')
    );
    const putReq = new NextRequest('http://localhost/api/v1/settings/extra-config', {
      method: 'PUT',
      body: JSON.stringify({ entries: [{ config_key: 'NUMBER_SCRIPT', config_value: 'ARAB' }] }),
    });
    const res = await PUT(putReq);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FEATURE_NOT_IN_PLAN');

    mockResetKey.mockResolvedValueOnce({ resolved: {}, items: [] });
    const delKeyRes = await DELETE_KEY(
      new NextRequest('http://localhost/api/v1/settings/extra-config/NUMBER_SCRIPT', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ key: 'NUMBER_SCRIPT' }) }
    );
    expect(delKeyRes.status).toBe(200);
    expect(mockResetKey).toHaveBeenCalledWith('t-1', 'NUMBER_SCRIPT', expect.any(Object));

    mockResetAll.mockResolvedValueOnce({ resolved: {}, items: [] });
    const delAllRes = await DELETE_ALL(
      new NextRequest('http://localhost/api/v1/settings/extra-config', { method: 'DELETE' })
    );
    expect(delAllRes.status).toBe(200);
    expect(mockResetAll).toHaveBeenCalledWith('t-1', expect.any(Object));
  });
});
