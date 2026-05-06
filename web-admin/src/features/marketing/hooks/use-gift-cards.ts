'use client';

/**
 * React hooks for gift card data.
 */

import { useState, useEffect, useCallback } from 'react';
import { listGiftCards, getGiftCardTransactionsAction } from '@/app/actions/marketing/gift-card-actions';
import type { GiftCard, GiftCardStatus, GiftCardTransaction } from '@/lib/types/payment';

interface UseGiftCardsParams {
  search?: string;
  status?: GiftCardStatus;
  page?: number;
  customerId?: string;
}

/**
 * Hook to list and paginate gift cards for the current tenant.
 */
export function useGiftCards(params: UseGiftCardsParams = {}) {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listGiftCards({
      page: params.page,
      search: params.search,
      status: params.status,
      customerId: params.customerId,
    }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setGiftCards(result.data);
        setTotal(result.total);
        setError(null);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [params.page, params.search, params.status, params.customerId, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { giftCards, total, isLoading, error, refetch };
}

/**
 * Hook to fetch transaction history for a specific gift card.
 */
export function useGiftCardTransactions(giftCardId: string) {
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getGiftCardTransactionsAction(giftCardId).then((result) => {
      if (cancelled) return;
      if (result.success) setTransactions(result.data);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [giftCardId]);

  return { transactions, isLoading };
}
