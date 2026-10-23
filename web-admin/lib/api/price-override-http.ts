/**
 * HTTP mapping for the price override policy (PF-01).
 * Shared by the submit-order route and the order totals preview routes.
 */

import { NextResponse } from 'next/server';
import {
  PRICE_OVERRIDE_ERRORS,
  PriceOverrideError,
} from '@/lib/services/price-override-policy.service';

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
      error:
        error.code === PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED
          ? 'You do not have permission to override item prices.'
          : 'A reason is required for every price override.',
      lineIndexes: error.lineIndexes,
    },
    { status: error.httpStatus },
  );
}
