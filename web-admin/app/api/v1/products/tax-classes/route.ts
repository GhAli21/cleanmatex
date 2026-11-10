/** GET /api/v1/products/tax-classes: the sales tax classes a product can be given. */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('products:read')(request);
  if (auth instanceof NextResponse) return auth;

  // Tenant resolved server-side by requirePermission; the query is scoped to it.
  const data = await withTenantContext(auth.tenantId, () =>
    prisma.org_tax_item_classes_cf.findMany({
      where: { tenant_org_id: auth.tenantId, tax_flow_code: 'OUTPUT', is_active: true, rec_status: 1 },
      select: { class_code: true, name: true, name2: true, is_default: true },
      orderBy: { display_order: 'asc' },
    }),
  );
  return NextResponse.json({ data });
}
