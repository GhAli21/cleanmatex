vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: { tenant_org_id: 't1' } } } }) },
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ data: [{ quantity: 2, total_price: 2.1 }], error: null }) }) })
      }),
    }),
  } as any;
});

vi.mock('@/lib/config/features', () => ({ isPreparationEnabled: () => true }));

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


