'use client';

import { useOperationalZones } from '@/lib/hooks/use-operational-zones';

/** Organization zone for dashboard "today". Order acceptance has no branch on these widgets. */
export function useDashboardZone() {
  return useOperationalZones('accept_order', []);
}
