'use client';

/**
 * Cash change rounding for the payment modal (A6-1b).
 *
 * Reads the tenant/HQ change-rounding policy once per modal open and derives the change
 * the cashier should actually hand out. Display only: the server applies the same policy
 * when it records the payment and is the source of truth — the typed tender is never
 * rewritten, the difference is shown inline (no-silent-money-mutation).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';
import { computeCashChangeRounding, type CashChangeRounding } from '@/lib/money/cash-rounding';

/** Shape returned by `GET /api/v1/cash-drawers/rounding-policy`. */
export interface CashChangeRoundingPolicyDto {
  currencyCode: string;
  decimalPlaces: number;
  incrementMinor: number | null;
  mode: CurrencyRoundingMode;
}

/**
 * Loads the change-rounding policy for a currency while the modal is open.
 * @param params.enabled load only when a cash tender can produce change
 * @param params.tenantOrgId scopes the query cache per tenant
 * @param params.branchId optional branch for branch-level overrides
 * @param params.currencyCode the checkout currency
 */
export function useCashChangeRoundingPolicy(params: {
  enabled: boolean;
  tenantOrgId: string;
  branchId?: string | null;
  currencyCode: string;
}): CashChangeRoundingPolicyDto | null {
  const { enabled, tenantOrgId, branchId, currencyCode } = params;
  const { data } = useQuery<CashChangeRoundingPolicyDto | null>({
    queryKey: ['cash-change-rounding-policy', tenantOrgId, branchId ?? '', currencyCode],
    queryFn: async () => {
      const search = new URLSearchParams({ currency: currencyCode });
      if (branchId) search.set('branchId', branchId);
      const res = await fetch(`/api/v1/cash-drawers/rounding-policy?${search.toString()}`);
      const json = await res.json().catch(() => ({}));
      // A failed lookup must never block checkout: fall back to exact change.
      if (!res.ok || !json.success) return null;
      return json.data as CashChangeRoundingPolicyDto;
    },
    enabled: enabled && currencyCode.length === 3,
    staleTime: 5 * 60_000,
  });
  return data ?? null;
}

/**
 * Round the exact change owed under the policy. `null` when nothing is rounded.
 * @param policy resolved policy (or `null` while loading / when unavailable)
 * @param exactChange change owed, major units
 * @param tendered cash handed over — the rounded change never exceeds it
 */
export function useRoundedCashChange(
  policy: CashChangeRoundingPolicyDto | null,
  exactChange: number,
  tendered: number,
): CashChangeRounding | null {
  return useMemo(() => {
    if (!policy || policy.incrementMinor == null || exactChange <= 0) return null;
    const rounding = computeCashChangeRounding({
      exactChange,
      maxChange: tendered,
      decimalPlaces: policy.decimalPlaces,
      incrementMinor: policy.incrementMinor,
      mode: policy.mode,
    });
    return rounding.adjustment === 0 ? null : rounding;
  }, [policy, exactChange, tendered]);
}
