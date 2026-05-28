'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { UserTenant } from '@/types/auth';

/** Supported payment modal variants exposed for demo tenant comparison. */
export const PAYMENT_MODAL_VERSIONS = {
  V02_ENHANCED: 'v02-enhanced',
  V3: 'v3',
  V4: 'v4',
} as const;

/** Union of persisted payment modal version values. */
export type PaymentModalVersion =
  (typeof PAYMENT_MODAL_VERSIONS)[keyof typeof PAYMENT_MODAL_VERSIONS];

/** Default fallback so non-demo tenants always use the production-ready payment experience. */
export const DEFAULT_PAYMENT_MODAL_VERSION: PaymentModalVersion = PAYMENT_MODAL_VERSIONS.V4;

const PAYMENT_MODAL_VERSION_STORAGE_KEY = 'cmx:new-order:payment-modal-version';
const PAYMENT_MODAL_VERSION_SYNC_EVENT = 'cmx:new-order:payment-modal-version-changed';
type DemoTenantCandidate = Pick<UserTenant, 'tenant_id'> | null | undefined;

function isSupportedPaymentModalVersion(value: string): value is PaymentModalVersion {
  return Object.values(PAYMENT_MODAL_VERSIONS).includes(value as PaymentModalVersion);
}

/**
 * Normalizes arbitrary persisted values back into a supported modal version.
 *
 * @param value Raw stored value from local storage or external input.
 * @returns A supported payment modal version, defaulting to `v4`.
 */
export function coercePaymentModalVersion(value?: string | null): PaymentModalVersion {
  if (value && isSupportedPaymentModalVersion(value)) {
    return value;
  }
  return DEFAULT_PAYMENT_MODAL_VERSION;
}

/**
 * Reads the HQ demo flag from the current tenant row to gate the selector safely.
 *
 * @param tenantId Tenant identifier from the authenticated tenant context.
 * @returns `true` when the tenant is explicitly marked as an HQ demo/test tenant.
 */
export async function fetchPaymentModalDemoTenantFlag(tenantId: string): Promise<boolean> {
  if (!tenantId) {
    return false;
  }

  const { data, error } = await supabase
    .from('org_tenants_mst')
    .select('is_hq_test_demo')
    .eq('id', tenantId)
    .single();

  if (error) {
    return false;
  }

  return data?.is_hq_test_demo === true;
}

function getPaymentModalVersionStorageKey(tenantId: string): string {
  return `${PAYMENT_MODAL_VERSION_STORAGE_KEY}:${tenantId}`;
}

function readStoredPaymentModalVersion(tenantId?: string | null): PaymentModalVersion {
  if (!tenantId || typeof window === 'undefined') {
    return DEFAULT_PAYMENT_MODAL_VERSION;
  }

  return coercePaymentModalVersion(window.localStorage.getItem(getPaymentModalVersionStorageKey(tenantId)));
}

/**
 * Shares the selected payment modal version across the order screen and modal container.
 *
 * @param currentTenant Active tenant context used to resolve the HQ demo flag and storage key.
 * @returns Selector visibility plus the active modal version and updater.
 */
export function usePaymentModalVersion(currentTenant: DemoTenantCandidate) {
  const tenantId = currentTenant?.tenant_id ?? '';
  const { data: showPaymentModalVersionSelector = false } = useQuery({
    queryKey: ['orders', 'payment-modal-version-selector', tenantId],
    queryFn: () => fetchPaymentModalDemoTenantFlag(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined' || !showPaymentModalVersionSelector || !tenantId) {
      return () => undefined;
    }

    const storageKey = getPaymentModalVersionStorageKey(tenantId);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        onStoreChange();
      }
    };

    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ tenantId?: string }>;
      if (customEvent.detail?.tenantId === tenantId) {
        onStoreChange();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(PAYMENT_MODAL_VERSION_SYNC_EVENT, handleSync as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(PAYMENT_MODAL_VERSION_SYNC_EVENT, handleSync as EventListener);
    };
  }, [showPaymentModalVersionSelector, tenantId]);

  const getSnapshot = useCallback(() => {
    if (!showPaymentModalVersionSelector) {
      return DEFAULT_PAYMENT_MODAL_VERSION;
    }
    return readStoredPaymentModalVersion(tenantId);
  }, [showPaymentModalVersionSelector, tenantId]);

  const paymentModalVersion = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_PAYMENT_MODAL_VERSION
  );

  const setPaymentModalVersion = useCallback(
    (nextVersion: PaymentModalVersion) => {
      const normalizedVersion = coercePaymentModalVersion(nextVersion);

      if (!showPaymentModalVersionSelector || !tenantId || typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(
        getPaymentModalVersionStorageKey(tenantId),
        normalizedVersion
      );
      window.dispatchEvent(
        new CustomEvent(PAYMENT_MODAL_VERSION_SYNC_EVENT, {
          detail: {
            tenantId,
            version: normalizedVersion,
          },
        })
      );
    },
    [showPaymentModalVersionSelector, tenantId]
  );

  return {
    paymentModalVersion: showPaymentModalVersionSelector
      ? paymentModalVersion
      : DEFAULT_PAYMENT_MODAL_VERSION,
    setPaymentModalVersion,
    showPaymentModalVersionSelector,
  };
}
