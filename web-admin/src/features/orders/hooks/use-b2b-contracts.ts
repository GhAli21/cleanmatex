'use client';

/**
 * Customer B2B contract lookup for account billing.
 *
 * Single source for the contract selector's data — consumed by both the
 * Full-view inspector tab (`B2BContractsSelect`) and the B2B account-billing
 * capability dialog. Both call sites share the same query key, so TanStack
 * Query dedupes the fetch and keeps the two surfaces consistent.
 *
 * Tenant scope: the API route resolves the tenant server-side from the
 * authenticated session; the customer id alone cannot cross tenants.
 */

import { useQuery } from '@tanstack/react-query';

/**
 * One selectable B2B contract (id + human-readable contract number).
 */
export interface B2BContractListItem {
  id: string;
  contractNo: string;
}

/**
 * Loads the B2B contracts linked to a customer.
 *
 * @param customerId - Customer to load contracts for; the query idles when absent.
 * @param enabled - Extra gate (e.g. only fetch for B2B customers). Defaults to true.
 * @returns TanStack Query result whose `data` is the contract list (empty on error —
 *   the selector degrades to the "no contract" option rather than blocking payment).
 *
 * @example
 * const { data: contracts = [], isLoading } = useB2bContracts(customerId, isB2BCustomer);
 */
export function useB2bContracts(customerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['b2b-contracts', 'customer', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-contracts?customer_id=${customerId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as B2BContractListItem[];
    },
    // Prevent the query from firing without a customer to scope it to.
    enabled: !!customerId && enabled,
  });
}
