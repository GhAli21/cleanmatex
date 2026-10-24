/** GET /api/v1/orders/checkout-options — compatibility adapter for checkout consumers. */
import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { composeCheckoutOptions } from '@/lib/services/checkout-options.service';

/**
 * Preserves the existing operational response while the coordinated quote reuses its service.
 * @param request Branch, customer and order amount query parameters.
 * @returns Current checkout methods or an explicit availability failure.
 */
export async function GET(request: NextRequest) {
  // Tenant is resolved server-side from the authenticated session.
  const auth = await requireAnyPermission(['orders:create', 'orders:collect_payment'])(request);
  if (auth instanceof NextResponse) return auth;
  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;
  const customerId = request.nextUrl.searchParams.get('customerId') ?? undefined;
  const amount = Number(request.nextUrl.searchParams.get('amount') ?? '0');
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ success: false, error: 'INVALID_CHECKOUT_AMOUNT' }, { status: 400 });
  }
  try {
    const { paymentMethods, customerCredits } = await composeCheckoutOptions({
      tenantId: auth.tenantId, branchId, customerId, amount,
    });
    return NextResponse.json({ success: true, data: { paymentMethods, customerCredits } }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch checkout options';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
