/**
 * Receipts Hooks
 * React hooks for receipt operations
 * PRD-006: Digital Receipts
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { logger } from '@/lib/utils/logger';

export interface ReceiptRecord {
  id: string;
  receiptTypeCode: string;
  deliveryChannelCode: string;
  deliveryStatusCode: string;
  sentAt?: string;
  deliveredAt?: string;
  retryCount: number;
}

export function useReceipts(orderId: string) {
  const { currentTenant } = useAuth();

  return useQuery<ReceiptRecord[]>({
    queryKey: ['receipts', orderId, currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant || !orderId) throw new Error('No tenant or order ID');

      const response = await fetch(`/api/v1/receipts/orders/${orderId}`);
      const result = await response.json();

      if (result.success && result.receipts) {
        return result.receipts;
      }
      throw new Error(result.error || 'Failed to load receipts');
    },
    enabled: !!currentTenant && !!orderId,
  });
}

export function useSendReceipt() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      receiptTypeCode,
      deliveryChannels,
      language = 'en',
    }: {
      orderId: string;
      receiptTypeCode: string;
      deliveryChannels: string[];
      language?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/receipts/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptTypeCode,
          deliveryChannels,
          language,
        }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          receiptIds: result.receiptIds,
        };
      }
      throw new Error(result.error || 'Failed to send receipt');
    },
    onSuccess: (_, variables) => {
      // Invalidate receipts query
      queryClient.invalidateQueries({
        queryKey: ['receipts', variables.orderId, currentTenant?.id],
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to send receipt', error, {
        tenantId: currentTenant?.id,
        orderId: variables.orderId,
      });
    },
  });
}

export function useResendReceipt() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/receipts/${receiptId}/resend`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'Failed to resend receipt');
    },
    onSuccess: () => {
      // Invalidate all receipt queries
      queryClient.invalidateQueries({
        queryKey: ['receipts'],
      });
    },
    onError: (error: Error, receiptId: string) => {
      logger.error('Failed to resend receipt', error, {
        tenantId: currentTenant?.id,
        receiptId,
      });
    },
  });
}

