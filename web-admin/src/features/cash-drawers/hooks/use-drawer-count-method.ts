'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchDrawerCountPolicy } from '@features/cash-drawers/api/cash-drawer-api'

export type CountMethod = 'TOTAL_ONLY' | 'DENOMINATION'

/**
 * The count methods the drawer's policy allows for a phase, and a resolver that keeps the cashier's
 * choice inside them (derived, not an effect: no state is written during render). While the policy
 * loads, both methods are offered; the server enforces the same rule either way.
 *
 * @param drawerId the drawer being counted
 * @param phase opening float or closing/recount
 * @param enabled fetch only while the dialog is open
 * @returns the allowed methods and `resolve(choice)`
 */
export function useDrawerCountMethod(drawerId: string, phase: 'opening' | 'closing', enabled: boolean) {
  const query = useQuery({
    queryKey: ['cash-drawers', drawerId, 'count-policy'],
    enabled: enabled && Boolean(drawerId),
    queryFn: () => fetchDrawerCountPolicy(drawerId),
    staleTime: 60_000,
  })
  const methods: CountMethod[] = query.data?.[phase] ?? ['TOTAL_ONLY', 'DENOMINATION']
  const resolve = (choice: CountMethod): CountMethod => (methods.includes(choice) ? choice : methods[0])
  return { methods, resolve, isLoading: query.isLoading }
}
