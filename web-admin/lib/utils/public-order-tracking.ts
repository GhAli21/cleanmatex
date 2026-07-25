/**
 * Public order tracking URL helpers.
 *
 * Why:
 * Public tracking links are customer-facing and should not expose readable
 * tenant/order identifiers by default. These helpers centralize the opaque
 * `/track/{token}` contract while preserving a deliberate legacy fallback
 * path for older links during rollout.
 */

const PUBLIC_TRACKING_TOKEN_PATTERN = /^[a-z0-9_-]{16,128}$/i;

/**
 * Normalize and validate a public tracking token from a URL or payload.
 *
 * @param token Raw token value.
 * @returns Lowercased token when valid; otherwise null.
 */
export function normalizePublicTrackingToken(token: string | null | undefined): string | null {
  const normalized = String(token ?? '').trim().toLowerCase();
  if (!normalized || !PUBLIC_TRACKING_TOKEN_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Build the canonical opaque public tracking path.
 *
 * @param token Opaque public tracking token.
 * @returns Relative app path.
 */
export function buildPublicTrackingPath(token: string): string {
  return `/track/${encodeURIComponent(token)}`;
}

/**
 * Build the legacy readable public tracking path.
 *
 * @param tenantId Tenant UUID.
 * @param orderNo Human-readable order number.
 * @returns Relative app path.
 */
export function buildLegacyPublicTrackingPath(tenantId: string, orderNo: string): string {
  return `/public/orders/${encodeURIComponent(tenantId)}/${encodeURIComponent(orderNo)}`;
}

/**
 * Build an absolute public tracking URL from a relative path.
 *
 * @param baseUrl Site origin or configured base URL.
 * @param path Relative tracking path.
 * @returns Absolute tracking URL.
 */
export function buildAbsolutePublicTrackingUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}
