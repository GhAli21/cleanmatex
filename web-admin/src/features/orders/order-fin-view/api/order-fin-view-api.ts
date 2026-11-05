/**
 * Browser client for the Order Fin View routes (PLAN P4). Every call reads the
 * one error envelope (PR-05) and throws `OrderFinApiError` with its code, so
 * callers show `orders.finView.errors.<code>`. No money is computed here.
 */
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type { OrderFinHeaderView, OrderFinancialView, OrderFinSectionKey, OrderFinSectionMode, OrderFinPreset } from '@/lib/types/order-fin-view';
import { getCSRFToken } from '@/lib/utils/csrf-token';

/** A refused Order Fin View request; `code` is an `ORDER_FIN_API_ERRORS` value. */
export class OrderFinApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    /** The engine's own code for a refused Edit quote. */
    public readonly reason?: string,
    /** Seconds to wait after a 429. */
    public readonly retryAfter?: number,
  ) {
    super(code);
  }
}

/** The display request the routes accept (whitelisted on the server). */
export interface OrderFinViewRequest {
  preset?: OrderFinPreset;
  sections?: Partial<Record<OrderFinSectionKey, OrderFinSectionMode>>;
}

/** `?preset=…&sections=key:mode,…`, in a stable order so equal requests share a cache entry. */
export function orderFinViewQuery(request: OrderFinViewRequest): string {
  const params = new URLSearchParams();
  if (request.preset) params.set('preset', request.preset);
  const pairs = Object.entries(request.sections ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, m]) => `${k}:${m}`);
  if (pairs.length) params.set('sections', pairs.join(','));
  const q = params.toString();
  return q ? `?${q}` : '';
}

/**
 * Reads a route response: the `data` on success, otherwise throws the envelope's code.
 * @param res - fetch response from an Order Fin View route
 */
export async function readOrderFinResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code?: string; reason?: string } } | null;
  if (res.ok && body?.success) return body.data as T;
  const retry = Number(res.headers.get('Retry-After'));
  throw new OrderFinApiError(body?.error?.code ?? 'INTERNAL_ERROR', res.status, body?.error?.reason, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

/**
 * GET the saved order's view (`orders:read`; tenant from the session).
 * @param orderId - order id
 * @param request - preset and section overrides
 * @param signal - abort signal (TanStack Query passes one)
 */
export async function fetchOrderFinancialView(orderId: string, request: OrderFinViewRequest, signal?: AbortSignal): Promise<OrderFinancialView> {
  const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/financial-view${orderFinViewQuery(request)}`, {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  return readOrderFinResponse<OrderFinancialView>(res);
}

/**
 * POST the batch header reader (P4-02): many orders' header figures in one call.
 * @param orderIds - 1 to 100 order ids
 * @param signal - abort signal
 * @returns header views keyed by order id (orders of another tenant are absent)
 */
export async function fetchOrderFinancialHeaders(orderIds: string[], signal?: AbortSignal): Promise<Record<string, OrderFinHeaderView>> {
  const res = await fetch('/api/v1/orders/financial-headers', {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(await getCSRFToken()) },
    body: JSON.stringify({ orderIds }),
  });
  return readOrderFinResponse<Record<string, OrderFinHeaderView>>(res);
}
