/**
 * POST /api/v1/orders/quote — New Order cart quote (Line-Level P5-03, C12).
 *
 * The cart and summary rail read their figures here: the same checkout quote
 * the payment modal and submit use, so every screen shows what will be stored.
 * Read only; nothing is written.
 */

import { NextRequest, NextResponse } from 'next/server';
import { quoteCheckout } from '@/lib/services/commercial/commercial-checkout.service';
import { toCartQuote } from '@/lib/services/commercial/commercial-cart-quote';
import { checkoutQuoteErrorResponse } from '@/lib/api/commercial-http';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { cartQuoteRequestSchema } from '@/lib/validations/new-order-payment-schemas';
import { assertPriceOverridesAllowed } from '@/lib/services/price-override-policy.service';
import { priceOverrideErrorResponse } from '@/lib/api/price-override-http';
import { logger } from '@/lib/utils/logger';

/**
 * Prices the cart on the server.
 * @param request - Cart lines (codes only, each with an optional own speed), order preferences, branch, customer, order speed.
 * @returns `{ success, data: CartQuoteData }`, or the error code the cart explains
 */
export async function POST(request: NextRequest) {
  // CSRF: a cross-site page must not be able to read the tenant's prices through the session cookie.
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  // Tenant and user are resolved server-side from the authenticated session.
  const authCheck = await requirePermission('orders:create')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId, userId } = authCheck;

  const parsed = cartQuoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // PF-01: a quoted cashier price needs `pricing:override`, as on submit.
  try {
    await assertPriceOverridesAllowed(parsed.data.items, { requireReason: false });
  } catch (error) {
    const priceOverrideResponse = priceOverrideErrorResponse(error);
    if (priceOverrideResponse) return priceOverrideResponse;
    throw error;
  }

  try {
    const checkout = await quoteCheckout({
      tenantId,
      branchId: parsed.data.branchId,
      userId,
      customerId: parsed.data.customerId,
      items: parsed.data.items,
      orderServicePrefs: parsed.data.orderServicePrefs,
      serviceSpeed: parsed.data.serviceSpeed,
      serviceCategories: parsed.data.serviceCategories,
    });
    return NextResponse.json({ success: true, data: toCartQuote(checkout, parsed.data.requestId) });
  } catch (error) {
    const checkoutResponse = checkoutQuoteErrorResponse(error, { tenantId, route: 'cart_quote' });
    if (checkoutResponse) return checkoutResponse;
    logger.error('[cart-quote] quote failed', error as Error, { feature: 'orders', action: 'cart_quote', tenantId });
    return NextResponse.json(
      { success: false, errorCode: 'CART_QUOTE_UNAVAILABLE', error: 'The cart could not be priced. Please retry.' },
      { status: 500 },
    );
  }
}
