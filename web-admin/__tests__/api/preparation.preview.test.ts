/** @jest-environment node */

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({})) }));

const eqCalls: Array<[string, string]> = [];
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => {
    const q = {
      from: () => q,
      select: () => q,
      eq: (c: string, v: string) => { eqCalls.push([c, v]); return q; },
      maybeSingle: async () => ({
        data: { subtotal_amount: '2.1000', total_tax_amount: '0.1050', total_amount: '2.2050', total_items: 2 },
        error: null,
      }),
    };
    return q;
  },
}));
jest.mock('@/lib/config/features', () => ({ isPreparationEnabled: () => true }));
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ user: { id: 'u1' }, tenantId: 't1', userId: 'u1', userName: 'U1' }),
}));

import { GET } from '@/app/api/v1/preparation/[id]/preview/route';

describe('GET /api/v1/preparation/:id/preview', () => {
  it('returns the stored header figures for the session tenant', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET({} as any, { params: Promise.resolve({ id: 'o1' }) } as any);
    const json = await (res as Response).json();
    expect(json.data).toEqual({ subtotal: 2.1, tax: 0.105, total: 2.205, total_items: 2 });
    expect(eqCalls).toEqual([['tenant_org_id', 't1'], ['id', 'o1']]);
  });
});
