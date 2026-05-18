import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const from     = searchParams.get('from');
  const to       = searchParams.get('to');
  const branchId = searchParams.get('branchId') ?? undefined;
  const page     = Number(searchParams.get('page') ?? '1');
  const limit    = Number(searchParams.get('limit') ?? '50');

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };

  try {
    const where = {
      tenant_org_id: tenantId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
    };

    const [orders, total, aggregates] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_orders_mst.findMany({
          where,
          select: {
            id: true, order_no: true, created_at: true, payment_status: true,
            total_paid_amount: true, total_tax_amount: true, total_discount_amount: true,
            outstanding_amount: true, currency_code: true,
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ),
      withTenantContext(tenantId, () => prisma.org_orders_mst.count({ where })),
      withTenantContext(tenantId, () =>
        prisma.org_orders_mst.aggregate({
          where,
          _sum: { total_paid_amount: true, total_tax_amount: true, total_discount_amount: true },
          _count: { id: true },
        })
      ),
    ]);

    const kpis = {
      totalOrders:    aggregates._count.id,
      grossRevenue:   toNumber(aggregates._sum.total_paid_amount),
      totalTax:       toNumber(aggregates._sum.total_tax_amount),
      totalDiscounts: toNumber(aggregates._sum.total_discount_amount),
    };

    return NextResponse.json({ success: true, data: { orders, total, page, limit, kpis } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate orders summary';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
