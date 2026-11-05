/**
 * GET /api/v1/orders/[id]/discounts
 * Returns non-voided discount audit lines for the order.
 * Used by print/receipt pages to display per-source discount breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const lines = await getDiscountLinesForOrder(auth.tenantId, id);
    return NextResponse.json({ discountLines: lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch discount lines';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
