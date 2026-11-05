/** @jest-environment node */

/**
 * Line-Level P8-01: the tax report adds the taxable amount per tax category from the
 * order headers, for the session tenant only, and leaves cancelled orders out.
 */
import { NextRequest, NextResponse } from 'next/server';

const findMany = jest.fn();
const aggregate = jest.fn();
const queryRaw = jest.fn();
let allowed = true;

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => (allowed ? { tenantId: 'tenant-1', userId: 'u1' } : NextResponse.json({}, { status: 403 })),
}));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: (_t: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { findMany: (...a: unknown[]) => findMany(...a), aggregate: (...a: unknown[]) => aggregate(...a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));

import { GET } from '@/app/api/v1/finance/reports/tax-report/route';

const req = () => new NextRequest(new URL('http://localhost/api/v1/finance/reports/tax-report?from=2026-01-01&to=2026-01-31'));

beforeEach(() => {
  allowed = true;
  findMany.mockReset();
  aggregate.mockReset();
  queryRaw.mockReset();
});

describe('GET /api/v1/finance/reports/tax-report', () => {
  it('returns the category totals for the session tenant, without cancelled orders', async () => {
    findMany.mockResolvedValue([{ id: 'o1' }]);
    queryRaw.mockResolvedValue([{ tax_type: 'VAT', label: 'VAT', total_taxable: 100, total_tax: 5, cnt: BigInt(1) }]);
    aggregate.mockResolvedValue({ _sum: { taxable_amount: 100, zero_rated_amount: 3, exempt_amount: 14, out_of_scope_amount: 2 } });

    const body = await (await GET(req())).json();

    expect(body.data.categories).toEqual([
      { taxCategoryCode: 'STANDARD', amount: 100 },
      { taxCategoryCode: 'ZERO_RATED', amount: 3 },
      { taxCategoryCode: 'EXEMPT', amount: 14 },
      { taxCategoryCode: 'OUT_OF_SCOPE', amount: 2 },
    ]);
    expect(body.data.grandTotal).toBe(5);
    // An Edit retires old tax rows; counting them would overstate the tax.
    expect((queryRaw.mock.calls[0][0] as string[]).join('')).toContain('rec_status = 1');
    for (const where of [findMany.mock.calls[0][0].where, aggregate.mock.calls[0][0].where]) {
      expect(where).toMatchObject({ tenant_org_id: 'tenant-1', NOT: { status: 'cancelled' } });
    }
  });

  it('answers an empty period with no categories', async () => {
    findMany.mockResolvedValue([]);
    const body = await (await GET(req())).json();
    expect(body.data).toEqual({ rows: [], grandTotal: 0, categories: [] });
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('refuses without the permission', async () => {
    allowed = false;
    expect((await GET(req())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});
