import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type { CartQuoteData } from '@/lib/types/cart-quote';
import type { CartQuoteRequest } from '@/lib/validations/new-order-payment-schemas';

/** A failed cart quote, with the server's error code for the EN/AR message. */
export class CartQuoteError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CartQuoteError';
  }
}

const isMoney = (value: unknown, signed = false): value is number =>
  typeof value === 'number' && Number.isFinite(value) && (signed || value >= 0);

/** Checks the wire shape before any figure reaches the screen (the server stays the authority). */
function isCartQuoteData(value: unknown, requestId: string): value is CartQuoteData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const totals = data.totals as Record<string, unknown> | undefined;
  return data.requestId === requestId && typeof data.currencyCode === 'string' &&
    typeof data.decimalPlaces === 'number' && typeof data.readyByAt === 'string' &&
    !!totals && ['subtotal', 'orderDiscountTotal', 'chargesTotal', 'taxTotal', 'saleTotal'].every((key) => isMoney(totals[key])) &&
    isMoney(totals.roundingAdjustmentAmount, true) &&
    Array.isArray(data.lines) && Array.isArray(data.disclosures);
}

/**
 * Prices the New Order cart on the server (`POST /api/v1/orders/quote`).
 * The session supplies tenant and user; the body never selects either.
 * @param request - Cart lines (codes only) and the order context.
 * @param csrfToken - Session token protecting the authenticated POST.
 * @param signal - Cancels a superseded cart.
 * @returns the cart quote
 * @throws {CartQuoteError} with the server's code, or `CART_QUOTE_UNAVAILABLE`
 */
export async function fetchCartQuote(
  request: CartQuoteRequest,
  csrfToken: string | null | undefined,
  signal: AbortSignal,
): Promise<CartQuoteData> {
  const response = await fetch('/api/v1/orders/quote', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
    body: JSON.stringify(request),
    signal,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null) as { success?: boolean; data?: unknown; errorCode?: string } | null;
  if (!response.ok || !result?.success) throw new CartQuoteError(result?.errorCode ?? 'CART_QUOTE_UNAVAILABLE');
  if (!isCartQuoteData(result.data, request.requestId)) throw new CartQuoteError('CART_QUOTE_UNAVAILABLE');
  return result.data;
}
