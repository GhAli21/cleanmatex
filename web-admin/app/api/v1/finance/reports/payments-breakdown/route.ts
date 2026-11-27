import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { civilInstantRange } from '@/lib/utils/operational-time';
import { leadingCivilDate } from '@/lib/clock/api-input';
import { screenClock } from '@/lib/clock/api-clock.server';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if ((from && !leadingCivilDate(from)) || (to && !leadingCivilDate(to))) {
    return NextResponse.json({ success: false, error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }
  const zone = from || to ? await resolveOperationalTimeZone(tenantId, 'invoice', null) : null;
  if ((from || to) && !zone) {
    return NextResponse.json({ success: false, error: 'TIMEZONE_NOT_CONFIGURED' }, { status: 422 });
  }
  const dateFilter = zone ? civilInstantRange(from, to, zone) : {};

  try {
    const where = {
      tenant_org_id: tenantId,
      status:        'COMPLETED',
      ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
    };

    const payments = await withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.groupBy({
        by:    ['org_payment_method_id'],
        where,
        _sum:  { amount: true },
        _count:{ id: true },
      })
    );

    const methodIds = payments.map((p) => p.org_payment_method_id).filter(Boolean) as string[];
    const methods = methodIds.length > 0
      ? await withTenantContext(tenantId, () =>
          prisma.org_payment_methods_cf.findMany({
            where:  { id: { in: methodIds }, tenant_org_id: tenantId },
            select: { id: true, display_name: true, display_name2: true, payment_method_code: true },
          })
        )
      : [];

    const methodMap = Object.fromEntries(methods.map((m) => [m.id, m]));

    const breakdown = payments.map((p) => ({
      methodId:    p.org_payment_method_id,
      method:      p.org_payment_method_id ? methodMap[p.org_payment_method_id] : null,
      totalAmount: Number(p._sum.amount ?? 0),
      count:       p._count.id,
    }));

    const clock = await screenClock(tenantId, { operation: 'invoice' });
    return NextResponse.json({ success: true, data: breakdown, clock });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate payments breakdown';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
