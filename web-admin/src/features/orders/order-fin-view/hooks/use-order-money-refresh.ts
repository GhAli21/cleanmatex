'use client';

/**
 * After any write that moves an order's money (payment, refund, charge void,
 * tax-document issue, AR collection, edit apply): refresh the server props
 * and mark every cached Order Financial View of that order stale (P6-08).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { invalidateOrderFinancial } from './order-fin-view-cache';

/**
 * @returns `refresh(orderId)`: `router.refresh()` plus `invalidateOrderFinancial`
 * @example const refreshMoney = useOrderMoneyRefresh(); onSuccess: () => refreshMoney(orderId)
 */
export function useOrderMoneyRefresh(): (orderId: string) => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback((orderId: string) => {
    router.refresh();
    void invalidateOrderFinancial(queryClient, orderId);
  }, [queryClient, router]);
}
