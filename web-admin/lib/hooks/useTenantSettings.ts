/**
 * useTenantSettings Hook
 *
 * React hook to fetch and cache tenant-specific settings.
 * Uses React Query for caching and automatic refetching.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  tenantSettingsService,
  type TenantProcessingSettings,
} from '@/lib/services/tenant-settings.service';

interface UseTenantSettingsOptions {
  tenantId: string;
  enabled?: boolean; // Allow conditional fetching
}

/**
 * Hook to fetch tenant processing settings
 * @param options - Configuration options
 * @returns Query result with settings data
 */
export function useTenantSettings(options: UseTenantSettingsOptions) {
  const { tenantId, enabled = true } = options;

  return useQuery<TenantProcessingSettings>({
    queryKey: ['tenant-settings', tenantId],
    queryFn: async () => {
      return tenantSettingsService.getProcessingSettings(tenantId);
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime)
    retry: 2, // Retry failed requests twice
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Hook to fetch a single setting value
 * @param tenantId - The tenant organization ID
 * @param settingCode - The setting code to fetch
 * @returns Query result with boolean value
 */
export function useTenantSetting(tenantId: string, settingCode: string) {
  return useQuery<boolean>({
    queryKey: ['tenant-setting', tenantId, settingCode],
    queryFn: async () => {
      return tenantSettingsService.checkIfSettingAllowed(tenantId, settingCode);
    },
    enabled: !!tenantId && !!settingCode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get settings with default values while loading
 * Useful for conditional rendering where you need immediate access to settings
 */
export function useTenantSettingsWithDefaults(tenantId: string) {
  const { data, isLoading, error } = useTenantSettings({ tenantId });

  console.log('[useTenantSettingsWithDefaults] Hook state:', {
    tenantId,
    data,
    isLoading,
    error
  });

  // Return defaults while loading or on error. Pieces are always used (trackByPiece forced true).
  const base = data || {
    splitOrderEnabled: true,
    rejectEnabled: true,
    trackByPiece: true,
    rejectColor: '#10B981',
  };
  const settings: TenantProcessingSettings = {
    ...base,
    trackByPiece: true, // Always use order item pieces; no longer gated by USE_TRACK_BY_PIECE
  };

  console.log('[useTenantSettingsWithDefaults] Final settings:', settings);

  return {
    settings,
    isLoading,
    error,
    // Individual flags for easier destructuring
    splitOrderEnabled: settings.splitOrderEnabled,
    rejectEnabled: settings.rejectEnabled,
    trackByPiece: settings.trackByPiece,
    rejectColor: settings.rejectColor,
  };
}
