/** @jest-environment node */

/**
 * Line-Level P7-05 (L18): HQ is the only writer of the pricing modes and the
 * calculation settings. The Organization app refuses them with
 * `403 FIELD_MANAGED_BY_HQ` before anything is written.
 */
import { NextRequest } from 'next/server';

jest.mock('server-only', () => ({}));

const updateTenantMock = jest.fn();
const branchUpdateMock = jest.fn();
jest.mock('@/lib/services/tenants.service', () => ({
  getCurrentTenant: async () => ({ id: 'tenant-1' }),
  updateTenant: (...a: unknown[]) => updateTenantMock(...a),
}));
jest.mock('@/lib/services/subscriptions.service', () => ({ getCurrentSubscription: jest.fn() }));
jest.mock('@/lib/services/usage-tracking.service', () => ({ getUsageMetrics: jest.fn() }));
jest.mock('@/lib/db/tenant-context', () => ({ getTenantIdFromSession: async () => 'tenant-1' }));
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: () => async () => ({ tenantId: 'tenant-1', userId: 'u1' }) }));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_branches_mst: { updateMany: (...a: unknown[]) => branchUpdateMock(...a) },
    sys_timezone_cd: { findFirst: async () => ({ code: 'Asia/Muscat' }) },
  },
}));

import { PATCH as tenantPATCH } from '@/app/api/v1/tenants/me/route';
import { PATCH as branchPATCH } from '@/app/api/v1/branches/[id]/route';

const patch = (url: string, body: unknown) => new NextRequest(new URL(url, 'http://localhost'), { method: 'PATCH', body: JSON.stringify(body) });

beforeEach(() => {
  updateTenantMock.mockReset().mockResolvedValue({ id: 'tenant-1' });
  branchUpdateMock.mockReset().mockResolvedValue({ count: 1 });
});

describe('HQ-managed pricing fields (L18)', () => {
  it.each(['tax_pricing_mode', 'extra_price_pricing_mode', 'commercial_level', 'disc_alloc_mode', 'disc_alloc_basis'])(
    'PATCH /tenants/me refuses %s and writes nothing',
    async (field) => {
      const res = await tenantPATCH(patch('/api/v1/tenants/me', { [field]: 'X', name: 'Ok' }));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'FIELD_MANAGED_BY_HQ', fields: [field] });
      expect(updateTenantMock).not.toHaveBeenCalled();
    },
  );

  it('PATCH /tenants/me still saves the fields the organization owns', async () => {
    const res = await tenantPATCH(patch('/api/v1/tenants/me', { brand_color_primary: '#112233' }));
    expect(res.status).toBe(200);
    expect(updateTenantMock).toHaveBeenCalled();
  });

  it('PATCH /branches/[id] refuses the overrides (even null) and writes nothing; the timezone still saves', async () => {
    for (const body of [{ tax_pricing_mode: 'TAX_INCLUSIVE' }, { extra_price_pricing_mode: null }]) {
      const res = await branchPATCH(patch('/api/v1/branches/b1', body), { params: Promise.resolve({ id: 'b1' }) });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('FIELD_MANAGED_BY_HQ');
    }
    expect(branchUpdateMock).not.toHaveBeenCalled();

    const ok = await branchPATCH(patch('/api/v1/branches/b1', { timezone_code: 'Asia/Muscat' }), { params: Promise.resolve({ id: 'b1' }) });
    expect(ok.status).toBe(200);
    expect(branchUpdateMock.mock.calls[0][0]).toMatchObject({ where: { id: 'b1', tenant_org_id: 'tenant-1' }, data: { timezone_code: 'Asia/Muscat' } });
  });
});
