'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';

/** Fulfilment-branch zone for a Ready By choice. Empty when no active catalog zone exists. */
export async function getReadyByZone(branchId: string | null): Promise<string | null> {
  const { tenantId } = await getAuthContext();
  return resolveOperationalTimeZone(tenantId, 'ready_by', branchId);
}
