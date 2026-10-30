/**
 * HTTP mapping for the price override policy (PF-01).
 * Shared by the submit-order route and the order totals preview routes.
 */

import { NextResponse } from 'next/server';
import {
  PRICE_OVERRIDE_ERRORS,
  PriceOverrideError,
} from '@/lib/services/price-override-policy.service';

/** One English fallback per code; the client shows the EN/AR message for the code. */
function priceOverrideMessage(code: PriceOverrideError['code']): string {
  switch (code) {
    case PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED: return 'You do not have permission to override item prices.';
    case PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_REASON_REQUIRED: return 'A reason is required for every price override.';
    case PRICE_OVERRIDE_ERRORS.LINE_DISCOUNT_NOT_PERMITTED: return 'You do not have permission to discount order lines.';
    case PRICE_OVERRIDE_ERRORS.ORDER_DISCOUNT_NOT_PERMITTED: return 'You do not have permission to give an order discount.';
    default: return 'A reason is required for every line discount.';
  }
}

/**
 * Maps a {@link PriceOverrideError} to its JSON response; any other error returns null.
 * @param error - Caught error.
 * @returns 403 (not permitted) / 400 (reason missing) response, or null.
 */
export function priceOverrideErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PriceOverrideError)) return null;
  return NextResponse.json(
    {
      success: false,
      errorCode: error.code,
      error: priceOverrideMessage(error.code),
      lineIndexes: error.lineIndexes,
    },
    { status: error.httpStatus },
  );
}
