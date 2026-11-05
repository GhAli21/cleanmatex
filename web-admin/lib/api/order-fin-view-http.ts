import 'server-only';

import { NextResponse } from 'next/server';

import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';

/** One Order Fin View error code (PR-05). */
export type OrderFinApiErrorCode = (typeof ORDER_FIN_API_ERRORS)[keyof typeof ORDER_FIN_API_ERRORS];

// Money is per order and changes with every payment: never cached by a browser or proxy.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * Success envelope for every Order Fin View route.
 * @param data - the view, headers map or edit view
 * @returns 200 `{ success: true, data }` with `Cache-Control: no-store`
 */
export function finViewOk<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { headers: NO_STORE });
}

/**
 * Error envelope (PR-05): `{ success: false, error: { code, messageKey } }`.
 * The message key is translated by the client; internal error text is never sent.
 * @param status - HTTP status
 * @param code - stable error code
 * @param headers - extra headers (for example `Retry-After` on 429)
 * @param reason - the engine's own code when a quote was refused (stable, safe to show as a reason)
 */
export function finViewError(
  status: number,
  code: OrderFinApiErrorCode,
  headers: Record<string, string> = {},
  reason?: string,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, messageKey: `orders.finView.errors.${code}`, ...(reason ? { reason } : {}) } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

/**
 * Maps a `requirePermission` / CSRF / rate-limit failure response onto the envelope.
 * @param res - the failure the middleware returned
 */
export function finViewFromGuard(res: NextResponse): NextResponse {
  if (res.status === 401) return finViewError(401, ORDER_FIN_API_ERRORS.UNAUTHENTICATED);
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    return finViewError(429, ORDER_FIN_API_ERRORS.RATE_LIMITED, retryAfter ? { 'Retry-After': retryAfter } : {});
  }
  if (res.status === 403) return finViewError(403, ORDER_FIN_API_ERRORS.PERMISSION_DENIED);
  return finViewError(res.status >= 500 ? 500 : 400, res.status >= 500 ? ORDER_FIN_API_ERRORS.INTERNAL_ERROR : ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
}

/**
 * The public routes answer 404 for every refusal (bad token, foreign order, unhealthy snapshot),
 * so a caller cannot tell which (PR-06).
 */
export function finViewPublicNotFound(): NextResponse {
  return finViewError(404, ORDER_FIN_API_ERRORS.ORDER_NOT_FOUND);
}
