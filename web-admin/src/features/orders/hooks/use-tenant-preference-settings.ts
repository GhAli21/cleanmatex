/**
 * useTenantPreferenceSettings
 * Fetches SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS for new order auto-apply flow.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  tenantSettingsService,
  SETTING_CODES,
} from '@/lib/services/tenant-settings.service';

export interface TenantPreferenceSettings {
  autoApplyCustomerPrefs: boolean;
}

interface UseTenantPreferenceSettingsOptions {
  tenantId: string | null | undefined;
  branchId?: string | null;
  userId?: string | null;
  enabled?: boolean;
}

export function useTenantPreferenceSettings(options: UseTenantPreferenceSettingsOptions) {
  const { tenantId, branchId, userId, enabled = true } = options;

  const { data: autoApply, isLoading } = useQuery({
    queryKey: [
      'tenant-preference-settings',
      tenantId,
      branchId ?? null,
      userId ?? null,
    ],
    queryFn: async () => {
      if (!tenantId) return false;
      return tenantSettingsService.checkIfSettingAllowed(
        tenantId,
        SETTING_CODES.SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS,
        branchId,
        userId
      );
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    autoApplyCustomerPrefs: autoApply ?? false,
    isLoading,
  };
}
