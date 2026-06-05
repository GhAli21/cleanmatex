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
      auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: { tenant_org_id: 't1' } } } }) },
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ data: [{ quantity: 2, total_price: 2.1 }], error: null }) }) })
      }),
    }),
  } as any;
});

jest.mock('@/lib/config/features', () => ({ isPreparationEnabled: () => true }));

import { GET } from '@/app/api/v1/preparation/[id]/preview/route';

describe('GET /api/v1/preparation/:id/preview', () => {
  it('returns totals', async () => {
    const res = await GET({} as any, { params: { id: 'o1' } });
    // @ts-ignore
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });
});
