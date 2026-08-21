const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_ORDER_DETAILS_RETURN_URL = '/dashboard/orders';

export interface BuildOrderDetailsHrefParams {
  tenantOrgId?: string | null;
  orderId?: string | null;
  orderNo?: string | null;
  returnUrl?: string | null;
  returnLabel?: string | null;
  tab?: string | null;
}

function trimOrNull(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isUuidLike(value?: string | null): boolean {
  const normalized = trimOrNull(value);
  return normalized ? UUID_REGEX.test(normalized) : false;
}

export function sanitizeOrderDetailsReturnUrl(
  value?: string | null,
  fallback: string = DEFAULT_ORDER_DETAILS_RETURN_URL,
): string {
  const normalized = trimOrNull(value);
  if (!normalized) return fallback;
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback;

  try {
    const parsed = new URL(normalized, 'https://cleanmatex.local');
    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!parsed.pathname.startsWith('/dashboard')) return fallback;
    return safePath;
  } catch {
    return fallback;
  }
}

export function buildOrderDetailsHref({
  tenantOrgId,
  orderId,
  orderNo,
  returnUrl,
  returnLabel,
  tab,
}: BuildOrderDetailsHrefParams): string | null {
  const identifier = trimOrNull(orderId) ?? trimOrNull(orderNo);
  if (!identifier) return null;

  const params = new URLSearchParams();
  const normalizedTenantOrgId = trimOrNull(tenantOrgId);
  if (normalizedTenantOrgId) {
    params.set('tenantOrgId', normalizedTenantOrgId);
  }

  const normalizedReturnUrl = trimOrNull(returnUrl);
  if (normalizedReturnUrl) {
    params.set('returnUrl', sanitizeOrderDetailsReturnUrl(normalizedReturnUrl));
  }

  const normalizedReturnLabel = trimOrNull(returnLabel);
  if (normalizedReturnLabel) {
    params.set('returnLabel', normalizedReturnLabel);
  }

  const normalizedTab = trimOrNull(tab);
  if (normalizedTab) {
    params.set('tab', normalizedTab);
  }

  const query = params.toString();
  const basePath = `/dashboard/orders/${encodeURIComponent(identifier)}`;
  return query ? `${basePath}?${query}` : basePath;
}
