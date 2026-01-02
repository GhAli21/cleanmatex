/**
 * Delivery Hooks
 * React hooks for delivery operations
 * PRD-013: Delivery Management & POD
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { logger } from '@/lib/utils/logger';

export function useCreateRoute() {
  const { currentTenant, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderIds,
      driverId,
    }: {
      orderIds: string[];
      driverId?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/v1/delivery/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds,
          driverId,
        }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          routeId: result.routeId,
        };
      }
      throw new Error(result.error || 'Failed to create route');
    },
    onError: (error: Error) => {
      logger.error('Failed to create route', error, {
        tenantId: currentTenant?.id,
      });
    },
  });
}

export function useGenerateOTP() {
  const { currentTenant, user } = useAuth();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/v1/delivery/orders/${orderId}/generate-otp`,
        {
          method: 'POST',
        }
      );
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          otpCode: result.otpCode,
        };
      }
      throw new Error(result.error || 'Failed to generate OTP');
    },
    onError: (error: Error, orderId: string) => {
      logger.error('Failed to generate OTP', error, {
        tenantId: currentTenant?.id,
        orderId,
      });
    },
  });
}

export function useVerifyOTP() {
  const { currentTenant } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderId,
      otpCode,
    }: {
      orderId: string;
      otpCode: string;
    }) => {
      if (!currentTenant) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/v1/delivery/orders/${orderId}/verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpCode }),
        }
      );
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          isValid: result.isValid,
        };
      }
      throw new Error(result.error || 'OTP verification failed');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to verify OTP', error, {
        tenantId: currentTenant?.id,
        orderId: variables.orderId,
      });
    },
  });
}

export function useCapturePOD() {
  const { currentTenant, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      stopId,
      podMethodCode,
      ...options
    }: {
      stopId: string;
      podMethodCode: string;
      otpCode?: string;
      signatureUrl?: string;
      photoUrls?: string[];
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/delivery/stops/${stopId}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podMethodCode,
          ...options,
        }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          podId: result.podId,
        };
      }
      throw new Error(result.error || 'POD capture failed');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to capture POD', error, {
        tenantId: currentTenant?.id,
        stopId: variables.stopId,
      });
    },
  });
}

