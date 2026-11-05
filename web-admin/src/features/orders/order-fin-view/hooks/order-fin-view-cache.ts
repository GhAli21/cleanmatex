/**
 * Order Fin View cache keys and invalidation. Kept free of auth and fetch
 * imports so any writer (dialogs, the Edit workspace) can invalidate cheaply.
 */
import type { QueryClient } from '@tanstack/react-query';

/** Root of every Order Fin View query key; `invalidateOrderFinancial` matches on it. */
export const ORDER_FIN_VIEW_QUERY_ROOT = 'order-fin-view';

/**
 * Marks every cached view of one order stale (all presets, and any batch header list that holds it).
 * Call after payment, refund, charge void, order-edit apply and tax-document issue (P6-08).
 * @param queryClient - the app query client
 * @param orderId - the order whose money changed
 * @example await invalidateOrderFinancial(queryClient, orderId)
 */
export function invalidateOrderFinancial(queryClient: QueryClient, orderId: string): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === ORDER_FIN_VIEW_QUERY_ROOT
      && (query.queryKey[2] === orderId || (query.queryKey[2] === 'headers' && (query.queryKey[3] as string[]).includes(orderId))),
  });
}
