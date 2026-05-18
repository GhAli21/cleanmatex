import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('payment_config:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const methods = await withTenantContext(tenantId, () =>
      prisma.org_payment_methods_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          rec_status:    1,
          ...(branchId ? { branch_id: branchId } : {}),
        },
        orderBy: { rec_order: 'asc' },
      })
    );
    return NextResponse.json({ success: true, data: methods });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment methods';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
