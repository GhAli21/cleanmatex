import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listCustomerOpenBalancesForApi } from '@/lib/services/customer-open-balance-query.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:overpayment_allocate')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: customerId } = await params;
    const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;
    const currencyCode = request.nextUrl.searchParams.get('currencyCode') ?? undefined;
    const excludeOrderId = request.nextUrl.searchParams.get('excludeOrderId') ?? undefined;

    const targets = await listCustomerOpenBalancesForApi(auth.tenantId, customerId, {
      branchId,
      currencyCode,
      excludeOrderId,
    });

    return NextResponse.json({ success: true, data: { targets } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load open balances';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
