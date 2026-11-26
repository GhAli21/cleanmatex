'use client';

import { useQuery } from '@tanstack/react-query';

import { getOperationalZones } from '@/app/actions/ops/operational-zones';
import type { OperationalZoneOperation } from '@/lib/utils/operational-time';

/**
 * Loads the operations zone for each branch in one request.
 * While the request is pending, every lookup is null so the screen does not use the machine zone.
 */
export function useOperationalZones(
  operation: OperationalZoneOperation,
  branchIds: ReadonlyArray<string | null | undefined>,
) {
  const key = [...new Set(branchIds.filter((id): id is string => Boolean(id)))].sort().join(',');
  const query = useQuery({
    queryKey: ['operational-zones', operation, key],
    queryFn: () => getOperationalZones(operation, key.length > 0 ? key.split(',') : []),
    staleTime: 5 * 60_000,
  });

  const zoneFor = (branchId: string | null | undefined): string | null => {
    if (!query.data) return null;
    if (!branchId) return query.data.organization;
    if (Object.prototype.hasOwnProperty.call(query.data.byBranch, branchId)) {
      return query.data.byBranch[branchId];
    }
    return query.data.organization;
  };

  return {
    organization: query.data?.organization ?? null,
    zoneFor,
    isPending: query.isPending,
  };
}
