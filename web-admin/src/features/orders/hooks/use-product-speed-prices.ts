'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import type { Product } from '../model/new-order-types';
import { useCartQuote } from './use-cart-quote';
import { useNewOrderStateWithDispatch } from './use-new-order-state';

/**
 * The price of one unit of each product on screen at the order speed, for the
 * product cards (PLAN §11.1). It asks the calculator through the cart quote, so a card
 * never disagrees with the line it adds: same customer list, branch and speed rule.
 * No request at Standard speed, where the card's catalog price is already right.
 * @param products - the products on the current page; retail items take no speed price
 * @returns price per product id, or null while unavailable (the card keeps the catalog price and says the cart prices it); scoped to the authenticated tenant
 * @example const prices = useProductSpeedPrices(state.state.products);
 */
export function useProductSpeedPrices(products: readonly Product[]): ReadonlyMap<string, number> | null {
  const state = useNewOrderStateWithDispatch();
  const { currentTenant } = useAuth();
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();
  const { branchId, customer, serviceSpeed, isEditMode } = state.state;

  const priced = useMemo(() => products.filter((p) => !p.is_retail_item), [products]);
  const request = useMemo(
    () => ({
      items: priced.map((p) => ({ productId: p.id, quantity: 1 })),
      branchId: branchId || undefined,
      customerId: customer?.id || undefined,
      serviceSpeed,
      serviceCategories: Array.from(new Set(priced.map((p) => p.service_category_code).filter((code): code is string => !!code))),
    }),
    [priced, branchId, customer?.id, serviceSpeed],
  );
  const quote = useCartQuote({
    enabled: !isEditMode && serviceSpeed !== SERVICE_SPEEDS.STANDARD,
    tenantOrgId: currentTenant?.tenant_id,
    request,
    csrfReady: !csrfLoading,
    csrfToken,
  });

  const lines = quote.current ? quote.data?.lines : undefined;
  return useMemo(
    // The line's gross at quantity 1 also carries a once-per-line premium, which the unit price leaves out.
    () => (lines ? new Map(lines.map((line) => [priced[line.index]?.id ?? '', line.grossAmount])) : null),
    [lines, priced],
  );
}
