'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { checkoutLineOf } from '../model/checkout-line-intent';
import { useNewOrderStateWithDispatch } from './use-new-order-state';
import { useCartQuote } from './use-cart-quote';

/**
 * The New Order cart quote, built from the cart state (Line-Level P5-03).
 *
 * One request builder for every New Order consumer: the cart and summary rail
 * show it, and submit confirms each line's unit price against it (D26). They
 * share one React Query cache entry, so the cart is priced once.
 * Order Edit is never quoted as a new order (disabled in edit mode).
 * @returns the `useCartQuote` state for the current cart; scoped to the authenticated tenant
 * @example const cartQuote = useNewOrderCartQuote(); cartQuote.data?.totals.saleTotal;
 */
export function useNewOrderCartQuote() {
  const state = useNewOrderStateWithDispatch();
  const { currentTenant } = useAuth();
  const { trackByPiece, packingPerPieceEnabled } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();
  const { items, orderServicePrefs, branchId, customer, serviceSpeed, isEditMode } = state.state;

  const request = useMemo(
    () => ({
      items: items.map((item) => checkoutLineOf(item, { trackByPiece, packingPerPieceEnabled })),
      orderServicePrefs: orderServicePrefs?.length ? orderServicePrefs : undefined,
      branchId: branchId || undefined,
      customerId: customer?.id || undefined,
      serviceSpeed,
      serviceCategories: Array.from(
        new Set(items.map((item) => item.serviceCategoryCode).filter((code): code is string => !!code)),
      ),
    }),
    [items, orderServicePrefs, branchId, customer?.id, serviceSpeed, trackByPiece, packingPerPieceEnabled],
  );

  const quote = useCartQuote({
    enabled: !isEditMode,
    tenantOrgId: currentTenant?.tenant_id,
    request,
    csrfReady: !csrfLoading,
    csrfToken,
  });
  return { ...quote, request };
}
