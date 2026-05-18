import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requirePermission('stored_value:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { customerId } = await params;
  const page  = Number(request.nextUrl.searchParams.get('page') ?? '1');
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20');

  try {
    const wallet = await withTenantContext(tenantId, () =>
      prisma.org_customer_wallets_mst.findFirst({
        where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
      })
    );

    if (!wallet) return NextResponse.json({ success: true, data: { entries: [], total: 0 } });

    const [entries, total] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_wallet_txn_dtl.findMany({
          where:   { tenant_org_id: tenantId, wallet_id: wallet.id },
          orderBy: { created_at: 'desc' },
          skip:    (page - 1) * limit,
          take:    limit,
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_wallet_txn_dtl.count({ where: { tenant_org_id: tenantId, wallet_id: wallet.id } })
      ),
    ]);

    return NextResponse.json({ success: true, data: { entries, total, page, limit } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch ledger';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
