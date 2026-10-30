/**
 * HTTP mapping for the commercial calculator and its context loader (ADR-060, P5-02).
 * Shared by the payment quote, the totals preview, the cart quote and the submit-order routes,
 * so the same request fails the same way everywhere.
 */

import { NextResponse } from 'next/server';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial';
import { CommercialContextError } from '@/lib/services/commercial/commercial-context.loader';
import { logger } from '@/lib/utils/logger';
import { isInvalidDbInputError } from '@/lib/utils/db-input-error';
import { CURRENCY_RESOLUTION_ERRORS, CurrencyResolutionError } from '@/lib/money/currency-resolution';

/**
 * Maps a commercial error to its JSON response; any other error returns null.
 *
 * - A context error (unknown product, disabled preference, inactive tax
 *   profile, missing time zone) and a business rule the cashier can fix
 *   (discount above the base, price below the minimum) → 400 / 422 with the
 *   code and its figures; the client shows the EN/AR message for the code.
 * - A broken money invariant is a server fault: nothing was written, it is
 *   logged with its figures (PLAN.md §17) and answered 500.
 * @param error - Caught error.
 * @param context - Tenant and route, for the invariant log line.
 * @returns the response, or null when the error is not a commercial one
 */
export function commercialErrorResponse(
  error: unknown,
  context: { tenantId: string; route: string },
): NextResponse | null {
  if (error instanceof CommercialContextError) {
    // A missing time zone is tenant setup, not a bad request.
    const status = error.code === 'TIMEZONE_NOT_CONFIGURED' ? 422 : 400;
    return NextResponse.json(
      { success: false, errorCode: error.code, error: error.message, details: error.details },
      { status },
    );
  }
  if (error instanceof CommercialRuleError) {
    if (error.code === COMMERCIAL_ERROR_CODES.COMMERCIAL_INVARIANT_FAILED) {
      logger.error('[commercial] COMMERCIAL_INVARIANT_FAILED', error, {
        feature: 'orders', action: context.route, tenantId: context.tenantId, ...error.details,
      });
      return NextResponse.json(
        { success: false, errorCode: error.code, error: 'The order figures could not be verified. Nothing was saved.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, errorCode: error.code, error: error.message, details: error.details },
      { status: 422 },
    );
  }
  return null;
}

/**
 * Maps every error a checkout quote can raise to its JSON response; anything
 * else returns null (the route answers 500). Shared by the totals preview and
 * the cart quote, so both explain a bad cart the same way.
 * @param error - Caught error.
 * @param context - Tenant and route, for the invariant log line.
 * @returns the response, or null for an unexpected error
 */
export function checkoutQuoteErrorResponse(
  error: unknown,
  context: { tenantId: string; route: string },
): NextResponse | null {
  const commercial = commercialErrorResponse(error, context);
  if (commercial) return commercial;

  if (error instanceof CurrencyResolutionError) {
    const isMissingConfig = error.code === CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY;
    return NextResponse.json(
      {
        success: false,
        errorCode: error.code,
        error: isMissingConfig
          ? 'The Organization Base Currency is not configured.'
          : 'The Organization currency configuration could not be verified. Please retry.',
      },
      { status: isMissingConfig ? 422 : 503 },
    );
  }

  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Product not found:')) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        error: 'One or more products could not be found. They may have been removed from the catalog. Please remove them from your order.',
        productId: message.replace('Product not found: ', '').trim(),
      },
      { status: 400 },
    );
  }
  if (message === 'INVALID_TAX_PROFILE_SELECTION') {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_TAX_PROFILE_SELECTION', error: 'One or more selected tax profiles are invalid or no longer active.' },
      { status: 400 },
    );
  }
  if (isInvalidDbInputError(error)) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_ID_FORMAT', error: 'One or more ids in the request are not valid. Please reselect and try again.' },
      { status: 400 },
    );
  }
  return null;
}
