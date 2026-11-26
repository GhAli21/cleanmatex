'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { resolveOperationalTimeZonesForBranches } from '@/lib/utils/operational-zone.server';
import {
  isOperationalZoneOperation,
  type OperationalZoneOperation,
} from '@/lib/utils/operational-time';

const MAX_BRANCHES = 200;

/**
 * One zone read for a screen that shows several branches.
 * A branch uses its own zone, then the organization zone. A missing zone is null.
 */
export async function getOperationalZones(
  operation: OperationalZoneOperation,
  branchIds: readonly string[],
): Promise<{ organization: string | null; byBranch: Record<string, string | null> }> {
  if (!isOperationalZoneOperation(operation)) {
    return { organization: null, byBranch: {} };
  }
  const { tenantId } = await getAuthContext();
  const ids = [...new Set(branchIds.filter((id) => id.length > 0))].slice(0, MAX_BRANCHES);
  const zones = await resolveOperationalTimeZonesForBranches(prisma, tenantId, operation, ids);
  return {
    organization: zones.organization,
    byBranch: Object.fromEntries(zones.byBranch),
  };
}
