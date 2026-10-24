/** POST /api/v1/orders/payment-quote — coordinated, authenticated payment preparation; never posts a payment. */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { assertPriceOverridesAllowed } from '@/lib/services/price-override-policy.service';
import { priceOverrideErrorResponse } from '@/lib/api/price-override-http';
import { BoundedJsonError, readBoundedJson } from '@/lib/api/bounded-json';
import { PAYMENT_QUOTE_LIMITS, paymentQuoteRequestSchema } from '@/lib/validations/payment-quote-schema';
import { PaymentQuoteError, quotePayment } from '@/lib/services/payment-quote.service';
import { PaymentQuoteTiming } from '@/lib/services/payment-quote-timing';
import { CurrencyResolutionError, CURRENCY_RESOLUTION_ERRORS } from '@/lib/money/currency-resolution';
import { logger } from '@/lib/utils/logger';

/**
 * Bounds the response wait. It does not claim to cancel database work already executing;
 * final payment writes are never started by this endpoint and late browser results are rejected by identity.
 * @param operation Financial preparation work that may continue after the response deadline.
 * @returns The operation result when it arrives before the configured deadline.
 * @throws PaymentQuoteError with HTTP 504 when the response budget expires.
 */
async function withinDeadline<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PaymentQuoteError('PAYMENT_QUOTE_TIMEOUT', 504)), PAYMENT_QUOTE_LIMITS.SERVER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * POST /api/v1/orders/payment-quote.
 * Validates security/input once and delegates orchestration for the authenticated Organization.
 * @param request CSRF-protected quote input; posted identifiers never establish tenant/user scope.
 * @returns A private, non-cacheable quote or a structured safe error response.
 */
export async function POST(request: NextRequest) {
  const timing = new PaymentQuoteTiming();
  const requestId = randomUUID();
  const headers = () => ({
    'Cache-Control': 'private, no-store',
    'Server-Timing': timing.toHeader(),
    'X-Request-Id': requestId,
  });
  try {
    // Preserve the existing cashier POST CSRF boundary against cross-origin quote requests.
    const csrf = await validateCSRF(request);
    if (csrf) return csrf;
    // Tenant and user are resolved from the validated session, never from posted identifiers.
    const auth = await timing.measure('auth', () => requirePermission('orders:create')(request));
    if (auth instanceof NextResponse) return auth;
    const parsed = paymentQuoteRequestSchema.safeParse(await readBoundedJson(request, PAYMENT_QUOTE_LIMITS.MAX_BODY_BYTES));
    if (!parsed.success) {
      return NextResponse.json({ success: false, errorCode: 'INVALID_QUOTE_INPUT', error: 'Invalid payment quote input.' }, { status: 400, headers: headers() });
    }
    const data = await timing.measure('quote', () => withinDeadline(async () => {
      // An override is a privileged money decision even though this endpoint only previews it.
      await assertPriceOverridesAllowed(parsed.data.items, { requireReason: false });
      const canViewStoredValueBalances = parsed.data.customerId
        ? await hasPermissionServer('stored_value:view_balances')
        : false;
      return quotePayment(parsed.data, {
        tenantId: auth.tenantId,
        userId: auth.userId,
        canViewStoredValueBalances,
      }, timing);
    }));
    logger.info('Payment quote completed', {
      feature: 'payment_quote', action: 'quote', requestId,
      itemCount: parsed.data.items.length, durationsMs: timing.snapshot(),
    });
    return NextResponse.json({ success: true, data }, { headers: headers() });
  } catch (error) {
    const overrideResponse = priceOverrideErrorResponse(error);
    if (overrideResponse) return overrideResponse;
    if (error instanceof BoundedJsonError || error instanceof PaymentQuoteError) {
      return NextResponse.json({ success: false, errorCode: error.code, error: 'Payment preparation could not complete.' }, { status: error.status, headers: headers() });
    }
    if (error instanceof CurrencyResolutionError) {
      const missing = error.code === CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY;
      return NextResponse.json({ success: false, errorCode: error.code, error: 'Organization currency could not be verified.' }, { status: missing ? 422 : 503, headers: headers() });
    }
    const message = error instanceof Error ? error.message : '';
    const invalidProduct = message.startsWith('Product not found:');
    const invalidTax = message === 'INVALID_TAX_PROFILE_SELECTION';
    const invalidGift = message === 'GIFT_CARD_INVALID';
    if (invalidProduct || invalidTax || invalidGift) {
      return NextResponse.json({ success: false, errorCode: invalidTax || invalidGift ? message : 'PRODUCT_NOT_FOUND', error: 'The current order configuration is no longer available.' }, { status: 400, headers: headers() });
    }
    // Keep database/provider errors out of financial API responses and payment identifiers out of telemetry.
    logger.warn('Payment quote failed', { feature: 'payment_quote', action: 'quote', requestId, durationsMs: timing.snapshot() });
    return NextResponse.json({ success: false, errorCode: 'PAYMENT_QUOTE_UNAVAILABLE', error: 'Payment preparation is temporarily unavailable. Retry.' }, { status: 503, headers: headers() });
  }
}
