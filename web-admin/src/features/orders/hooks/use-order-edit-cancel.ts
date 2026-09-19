/**
 * useOrderEditCancel Hook
 * Handles cancel edit flow: unlock order and navigate back
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cmxMessage } from '@ui/feedback';
import { useTranslations } from 'next-intl';

/**
 * Hook to cancel order editing: release lock and navigate to order detail
 * @param orderId
 * @param allowNextNavigation - Skip the unsaved-changes intercept; Cancel Edit already confirmed
 */
export function useOrderEditCancel(
  orderId: string | null,
  allowNextNavigation?: () => void
) {
  const router = useRouter();
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

      // Stay in edit mode until this page unmounts. EXIT_EDIT_MODE here keeps
      // the cart loaded and flips the /edit route into a create-order screen
      // if navigation is cancelled or delayed.
      allowNextNavigation?.();
      router.push(`/dashboard/orders/${orderId}`);
    } catch (err) {
      const error = err as Error;
      cmxMessage.error(error.message || t('error') || 'Failed to release lock');
    } finally {
      setIsCancelling(false);
    }
  }, [orderId, router, t, allowNextNavigation]);

  return { cancelEditOrder, isCancelling };
}
