import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const rows = await withTenantContext(tenantId, () =>
      prisma.org_fin_exp_cat_cf.findMany({
        where: { tenant_org_id: tenantId, is_active: true },
        orderBy: { rec_order: 'asc' },
        select: {
          id: true,
          sys_cat_code: true,
          custom_name: true,
          custom_name2: true,
          is_active: true,
        },
      })
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch expense categories';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
