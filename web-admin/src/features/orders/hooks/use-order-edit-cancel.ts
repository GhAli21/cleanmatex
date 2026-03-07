/**
 * useOrderEditCancel Hook
 * Handles cancel edit flow: unlock order and navigate back
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNewOrderDispatch } from '../ui/context/new-order-context';
import { cmxMessage } from '@ui/feedback';
import { useTranslations } from 'next-intl';

/**
 * Hook to cancel order editing: release lock and navigate to order detail
 */
export function useOrderEditCancel(orderId: string | null) {
  const router = useRouter();
  const dispatch = useNewOrderDispatch();
  const t = useTranslations('orders.edit');
  const [isCancelling, setIsCancelling] = useState(false);

  const cancelEditOrder = useCallback(async () => {
    if (!orderId) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorMessage = (json.error as string) || t('error') || 'Failed to release lock';
        cmxMessage.error(errorMessage);
        return;
      }

      dispatch({ type: 'EXIT_EDIT_MODE' });
      router.push(`/dashboard/orders/${orderId}`);
    } catch (err) {
      const error = err as Error;
      cmxMessage.error(error.message || t('error') || 'Failed to release lock');
    } finally {
      setIsCancelling(false);
    }
  }, [orderId, router, dispatch, t]);

  return { cancelEditOrder, isCancelling };
}
