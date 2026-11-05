'use client';

/**
 * Saved-order view query (DESIGN §1 client data flow, PLAN PR-21). Money must
 * never look fresh when it isn't: `staleTime: 0`, refetch on focus and
 * reconnect, and one invalidation helper for every writer.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/auth-context';
import { ORDER_FIN_HEADERS_MAX } from '@/lib/constants/order-fin-view';
import type { OrderFinHeaderView, OrderFinancialView } from '@/lib/types/order-fin-view';
import { fetchOrderFinancialHeaders, fetchOrderFinancialView, type OrderFinViewRequest } from '../api/order-fin-view-api';
import { ORDER_FIN_VIEW_QUERY_ROOT } from './order-fin-view-cache';

export { ORDER_FIN_VIEW_QUERY_ROOT, invalidateOrderFinancial } from './order-fin-view-cache';

/**
 * The query key: tenant, order and the request, so two presets of one order never share a cache entry.
 * @param tenantId - session tenant (scopes the cache to the signed-in organization)
 * @param orderId - order id
 * @param request - preset and section overrides
 */
export function orderFinViewQueryKey(tenantId: string | undefined, orderId: string, request: OrderFinViewRequest) {
  return [ORDER_FIN_VIEW_QUERY_ROOT, tenantId ?? '', orderId, request.preset ?? 'summary', request.sections ?? {}] as const;
}

/**
 * The saved order's financial view.
 * @param orderId - order id; null disables the query
 * @param request - preset and section overrides
 * @returns the TanStack query (data = `OrderFinancialView`); scoped to the authenticated tenant
 * @example const { data, isLoading, refetch } = useOrderFinancialView(orderId, { preset: 'detailed' });
 */
export function useOrderFinancialView(orderId: string | null, request: OrderFinViewRequest) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  return useQuery<OrderFinancialView>({
    queryKey: orderFinViewQueryKey(tenantId, orderId ?? '', request),
    queryFn: ({ signal }) => fetchOrderFinancialView(orderId as string, request, signal),
    // Prevent the query before the tenant is confirmed.
    enabled: Boolean(orderId && tenantId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  });
}

/**
 * Header figures of many orders in one request (lists, AR invoice links; P4-02).
 * @param orderIds - order ids (deduplicated, sorted for a stable key; the first 100 are read)
 * @returns the TanStack query; data maps order id → header view (missing = not visible to this tenant)
 * @example const { data } = useOrderFinancialHeaders(rows.map((r) => r.order_id));
 */
export function useOrderFinancialHeaders(orderIds: readonly string[]) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const ids = [...new Set(orderIds.filter(Boolean))].sort().slice(0, ORDER_FIN_HEADERS_MAX);
  return useQuery<Record<string, OrderFinHeaderView>>({
    queryKey: [ORDER_FIN_VIEW_QUERY_ROOT, tenantId ?? '', 'headers', ids],
    queryFn: ({ signal }) => fetchOrderFinancialHeaders(ids, signal),
    enabled: Boolean(tenantId) && ids.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
