'use client';

import { useQuery } from '@tanstack/react-query';
import { getReadyByZone } from '@/app/actions/orders/ready-by-zone';

/**
 * Fulfilment-branch zone for Ready By (`ready_by` operation), resolved on the server.
 * Shares the query key with the Ready By picker, so both read one value.
 * `data` is null when neither the branch nor the organization has an active zone.
 */
export function useReadyByZone(branchId: string | null) {
  return useQuery({
    queryKey: ['ready-by-zone', branchId],
    queryFn: () => getReadyByZone(branchId),
  });
}
