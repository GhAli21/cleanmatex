/**
 * Tab-scoped Order Edit session.
 * The address never carries the token, so a copied URL cannot reopen the editor.
 */

import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getCSRFToken } from '@/lib/utils/csrf-token';
import { ORDER_EDIT_SESSION_HEADER } from '@/lib/constants/order-edit-session';

const STORAGE_KEY = 'cmx.order-edit.session';

export type OrderEditLeaveReason = 'user_exit' | 'applied' | 'navigate_away' | 'unload';

/** What this tab remembers after a successful Edit start. */
export interface OrderEditTabSession {
  orderId: string;
  token: string;
  returnTo: string;
  expiresAt: string;
}

export interface OrderEditSessionResult {
  ok: boolean;
  code: string;
  expiresAt: string | null;
}

let leaveBypass: (() => void) | null = null;

/**
 * Lets the edit page skip the unsaved-changes prompt after the user already confirmed Exit.
 * @param bypass - Callback from the new-order unsaved-changes hook, or null on unmount.
 */
export function setEditLeaveBypass(bypass: (() => void) | null): void {
  leaveBypass = bypass;
}

/**
 * Consumes the one-shot leave bypass immediately before navigation.
 */
export function allowEditLeave(): void {
  leaveBypass?.();
}

/**
 * @param orderId - Order this tab is editing.
 * @returns The stored session when it belongs to this order.
 */
export function readOrderEditTabSession(orderId: string): OrderEditTabSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderEditTabSession>;
    if (parsed.orderId !== orderId || typeof parsed.token !== 'string' || typeof parsed.returnTo !== 'string') {
      return null;
    }
    return {
      orderId: parsed.orderId,
      token: parsed.token,
      returnTo: parsed.returnTo,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : '',
    };
  } catch {
    return null;
  }
}

/**
 * @returns Any edit session this tab still holds, including a different order.
 */
export function readAnyOrderEditTabSession(): OrderEditTabSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderEditTabSession>;
    if (typeof parsed.orderId !== 'string' || typeof parsed.token !== 'string' || typeof parsed.returnTo !== 'string') {
      return null;
    }
    return {
      orderId: parsed.orderId,
      token: parsed.token,
      returnTo: parsed.returnTo,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : '',
    };
  } catch {
    return null;
  }
}

/**
 * @param session - Session granted by the server.
 */
export function writeOrderEditTabSession(session: OrderEditTabSession): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Drops the tab session so the next visit cannot reuse a finished edit.
 * @param orderId - When set, a session for a different order is left in place.
 */
export function clearOrderEditTabSession(orderId?: string): void {
  if (typeof window === 'undefined') return;
  if (!orderId) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  const current = readAnyOrderEditTabSession();
  if (current?.orderId === orderId) {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Remembers a newer expiry after claim or heartbeat.
 * @param orderId - Order whose session should move forward.
 * @param expiresAt - Server expiry ISO string.
 */
export function rememberOrderEditExpiry(orderId: string, expiresAt: string): void {
  const current = readOrderEditTabSession(orderId);
  if (!current) return;
  writeOrderEditTabSession({ ...current, expiresAt });
}

/**
 * Keeps Edit from returning to itself or to an off-site address.
 * Collection after Apply lands on the order payments tab only when the caller was order details.
 * @param orderId - Order being edited.
 * @param candidate - Path captured when Edit was clicked.
 * @param paymentsTab - Whether the follow-up asked the cashier to collect on the existing screen.
 * @returns A same-app path.
 */
export function safeOrderEditReturnPath(orderId: string, candidate: string | null | undefined, paymentsTab = false): string {
  const fallback = `/dashboard/orders/${orderId}`;
  const parsed = parseInternalPath(candidate);
  const path = parsed && isAllowedReturnPath(orderId, parsed.pathname) ? parsed.pathname : fallback;
  const params = new URLSearchParams();
  if (parsed && path === parsed.pathname) {
    for (const key of ['tab', 'returnUrl', 'returnLabel'] as const) {
      const value = parsed.searchParams.get(key);
      if (value && isSafeQueryValue(value)) params.set(key, value);
    }
  }
  if (paymentsTab && path === fallback) {
    params.set('tab', 'payments-credits');
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * @param orderId - Order being edited.
 * @param pathname - Pathname only, without a query.
 * @returns True when Exit may navigate there.
 */
function isAllowedReturnPath(orderId: string, pathname: string): boolean {
  if (!pathname.startsWith('/dashboard/')) return false;
  if (pathname.includes('/edit') || pathname.includes('\\') || pathname.includes('//')) return false;
  const orderRoot = `/dashboard/orders/${orderId}`;
  if (pathname === orderRoot || pathname === `${orderRoot}/full` || pathname === `${orderRoot}/workspace`) return true;
  if (pathname === '/dashboard/preparation' || pathname.startsWith('/dashboard/preparation/')) return true;
  return false;
}

/**
 * @param candidate - Raw return path from the caller.
 * @returns A parsed same-origin path, or null when it is not an in-app path.
 */
function parseInternalPath(candidate: string | null | undefined): URL | null {
  if (!candidate || candidate.includes('://') || candidate.startsWith('//')) return null;
  try {
    return new URL(candidate, 'http://cmx.local');
  } catch {
    return null;
  }
}

/**
 * @param value - Query value copied from the previous page.
 * @returns True when the value cannot redirect off-site.
 */
function isSafeQueryValue(value: string): boolean {
  return value.length > 0 && value.length <= 500 && !value.includes('://') && !value.startsWith('//');
}

/**
 * @returns The current dashboard path, used as the Edit return target.
 */
export function currentOrderEditReturnPath(): string {
  if (typeof window === 'undefined') return '/dashboard/orders';
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * @param token - Tab session token.
 * @returns Headers for Edit reads and writes.
 */
export function orderEditSessionHeaders(token: string): Record<string, string> {
  return { [ORDER_EDIT_SESSION_HEADER]: token };
}

/**
 * Calls the edit-session route. The token is never placed in the URL.
 * @param orderId - Order the action applies to.
 * @param body - Session action payload.
 * @param keepalive - True for tab-close requests that must outlive the page.
 * @returns The server outcome. Network failure is `code: 'NETWORK'`.
 */
export async function postOrderEditSession(
  orderId: string,
  body: Record<string, unknown>,
  keepalive = false,
): Promise<OrderEditSessionResult> {
  try {
    const csrf = await getCSRFToken();
    const response = await fetch(`/api/v1/orders/${orderId}/edit-session`, {
      method: 'POST',
      credentials: 'include',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        ...getCSRFHeader(csrf),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as { data?: { expiresAt?: string }; error?: { code?: string } } | null;
    if (!response.ok) {
      return { ok: false, code: payload?.error?.code ?? 'UNKNOWN', expiresAt: null };
    }
    return { ok: true, code: 'OK', expiresAt: payload?.data?.expiresAt ?? null };
  } catch {
    return { ok: false, code: 'NETWORK', expiresAt: null };
  }
}
