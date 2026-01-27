/**
 * use-tenant-currency Hook
 * Currency from tenant settings
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 * Default currency - can be overridden by tenant settings
 */
const DEFAULT_CURRENCY = ORDER_DEFAULTS.CURRENCY || 'USD';

/**
 * Hook to get tenant currency
 * @returns Currency code
 */
export function useTenantCurrency(): string {
  const { currentTenant } = useAuth();

  const currency = useMemo(() => {
    // TODO: Get currency from tenant settings when available
    // Currency is retrieved from tenant settings via useTenantSettingsWithDefaults
    // For now, return default currency

    // return currentTenant?.currency || DEFAULT_CURRENCY;
    return DEFAULT_CURRENCY;
  }, []);
  //}, [currentTenant]);
  //return DEFAULT_CURRENCY;
  return currency;
}

