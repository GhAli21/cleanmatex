'use client';

/**
 * Lightweight client context carrying server-resolved Extra Tenant Configuration.
 * Initialized once per request in `app/layout.tsx` -> `AppProviders` without
 * shipping raw catalog JSON or issuing extra client fetches on navigation.
 *
 * @module lib/context/tenant-extra-config-context
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_RESOLVED_EXTRA_CONFIG } from '@/lib/constants/tenant-extra-config';
import type { ResolvedExtraConfig } from '@/lib/types/tenant-extra-config';

const DEFAULT_CONTEXT_VALUE: ResolvedExtraConfig = {
  ...DEFAULT_RESOLVED_EXTRA_CONFIG,
  valuesByKey: {},
};

const TenantExtraConfigContext = createContext<ResolvedExtraConfig>(DEFAULT_CONTEXT_VALUE);

/**
 * Provides server-resolved Organization extra settings to client components and formatters.
 */
export function TenantExtraConfigProvider({
  value,
  children,
}: {
  value?: ResolvedExtraConfig;
  children: ReactNode;
}) {
  const memoized = useMemo<ResolvedExtraConfig>(
    () => value ?? DEFAULT_CONTEXT_VALUE,
    [value]
  );

  return (
    <TenantExtraConfigContext.Provider value={memoized}>
      {children}
    </TenantExtraConfigContext.Provider>
  );
}

/** Read resolved extra tenant configuration (safe outside provider with GCC defaults). */
export function useTenantExtraConfig(): ResolvedExtraConfig {
  return useContext(TenantExtraConfigContext);
}

/** Return effective table page size, letting explicit screen overrides win. */
export function useEffectiveTablePageSize(explicitPageSize?: number): number {
  const { defaultTablePageSize } = useTenantExtraConfig();
  return explicitPageSize ?? defaultTablePageSize;
}

/** Return whether BiDi `<bdi>` isolation is enabled for this Organization. */
export function useBdiIsolationEnabled(): boolean {
  return useTenantExtraConfig().bdiIsolationEnabled;
}
