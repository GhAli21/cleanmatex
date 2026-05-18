import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const from     = searchParams.get('from');
  const to       = searchParams.get('to');
  const branchId = searchParams.get('branchId') ?? undefined;
  const format   = searchParams.get('format'); // 'csv' returns CSV text

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };

  try {
    const orderWhere = {
      tenant_org_id: tenantId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
    };

    const orderIds = await withTenantContext(tenantId, () =>
      prisma.org_orders_mst.findMany({
        where:  orderWhere,
        select: { id: true },
      })
    );

    const ids = orderIds.map((o) => o.id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { rows: [], grandTotal: 0 } });
    }

    type TaxRow = { tax_type: string; label: string; total_taxable: number; total_tax: number; cnt: bigint };
    const taxRows = await withTenantContext(tenantId, () =>
      prisma.$queryRaw<TaxRow[]>`
        SELECT tax_type, label,
               COALESCE(SUM(taxable_amount), 0)::float8 AS total_taxable,
               COALESCE(SUM(tax_amount),     0)::float8 AS total_tax,
               COUNT(*)                                  AS cnt
        FROM org_order_taxes_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ANY(${ids}::uuid[])
        GROUP BY tax_type, label`
    );

    const rows = taxRows.map((r) => ({
      taxType:    r.tax_type,
      label:      r.label,
      baseAmount: r.total_taxable,
      taxAmount:  r.total_tax,
      orderCount: Number(r.cnt),
    }));

    const grandTotal = rows.reduce((s, r) => s + r.taxAmount, 0);

    if (format === 'csv') {
      const header = 'Tax Type,Label,Base Amount,Tax Amount,Order Count\n';
      const lines  = rows.map((r) => `${r.taxType},${r.label},${r.baseAmount},${r.taxAmount},${r.orderCount}`).join('\n');
      return new NextResponse(header + lines, {
        headers: {
          'Content-Type':        'text/csv',
          'Content-Disposition': 'attachment; filename="tax-report.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: { rows, grandTotal } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate tax report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
