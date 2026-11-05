/** @jest-environment node */

// tenant-settings.service exports a module-level TenantSettingsService instance
// that calls createClient() (browser client) at import time — mock it before any imports.
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('@/lib/supabase/server', () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ data: [{ quantity: 2, total_price: 2.1 }], error: null }) }) })
      }),
    }),
  } as any;
});

// P6-03: the rate comes from the tenant's default tax profiles, never from a setting.
const mockGetDefaultVatRate = jest.fn();
jest.mock('@/lib/services/tax-engine.service', () => ({ getDefaultVatRate: (...a: unknown[]) => mockGetDefaultVatRate(...a) }));

jest.mock('@/lib/config/features', () => ({ isPreparationEnabled: () => true }));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ user: { id: 'u1' }, tenantId: 't1', userId: 'u1', userName: 'U1' }),
}));

import { GET } from '@/app/api/v1/preparation/[id]/preview/route';

describe('GET /api/v1/preparation/:id/preview', () => {
  it('returns totals taxed at the default profile rate', async () => {
    mockGetDefaultVatRate.mockResolvedValueOnce(0.05);
    const res = await GET({} as any, { params: { id: 'o1' } });
    // @ts-ignore
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockGetDefaultVatRate).toHaveBeenCalledWith('t1');
    expect(json.data.tax).toBeCloseTo(0.105);
    expect(json.data.total).toBeCloseTo(2.205);
  });

  it('charges no tax when the tenant has no tax profile (no assumed 5%)', async () => {
    mockGetDefaultVatRate.mockResolvedValueOnce(0);
    const res = await GET({} as any, { params: { id: 'o1' } });
    // @ts-ignore
    const json = await res.json();
    expect(json.data.tax).toBe(0);
    expect(json.data.total).toBeCloseTo(2.1);
  });
});
