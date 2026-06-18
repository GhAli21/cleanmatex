'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * React hooks for gift card data.
 */

import { useState, useEffect, useCallback } from 'react';
import { listGiftCards, getGiftCardTransactionsAction, listGiftCardTransactionsAction } from '@/app/actions/marketing/gift-card-actions';
import type { GiftCard, GiftCardStatus, GiftCardTransaction, GiftCardTransactionLogRow, GiftCardTransactionType } from '@/lib/types/payment';

interface UseGiftCardsParams {
  search?: string;
  status?: GiftCardStatus;
  page?: number;
  customerId?: string;
}

/**
 * Hook to list and paginate gift cards for the current tenant.
 * @param params
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
      if (result.success === false) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      setGiftCards(result.data);
      setTotal(result.total);
      setError(null);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [params.page, params.search, params.status, params.customerId, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { giftCards, total, isLoading, error, refetch };
}

interface UseGiftCardTransactionLogParams {
  page?: number;
  pageSize?: number;
  cardNumber?: string;
  transactionType?: GiftCardTransactionType;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Hook for the tenant-wide gift card transaction log with pagination and filters.
 * @param params
 */
export function useGiftCardTransactionLog(params: UseGiftCardTransactionLogParams = {}) {
  const [rows, setRows] = useState<GiftCardTransactionLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listGiftCardTransactionsAction({
      page: params.page,
      pageSize: params.pageSize,
      cardCode: params.cardNumber,
      transactionType: params.transactionType,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }).then((result) => {
      if (cancelled) return;
      if (result.success === false) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      setRows(result.data);
      setTotal(result.total);
      setError(null);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
     
  }, [params.page, params.pageSize, params.cardNumber, params.transactionType, params.dateFrom, params.dateTo]);

  return { rows, total, isLoading, error };
}

/**
 * Hook to fetch transaction history for a specific gift card.
 * @param giftCardId
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
