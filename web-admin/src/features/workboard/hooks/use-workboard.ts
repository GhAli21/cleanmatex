import { useQuery } from '@tanstack/react-query'

import { fetchWorkboard } from '@features/workboard/api/workboard-api'
import type { WorkboardQueryInput } from '@features/workboard/model/workboard-types'

/** Caches the server-owned Workboard projection by its complete filter state. */
export function useWorkboard(input: WorkboardQueryInput) {
  return useQuery({ queryKey: ['workboard', input], queryFn: () => fetchWorkboard(input), staleTime: 15_000 })
}
