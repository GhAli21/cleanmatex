import 'server-only';

import { getAuthContext } from '@/lib/auth/server-auth';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';
import { civilDateInZone } from '@/lib/utils/operational-time';

/**
 * Organization civil day for an ERP Lite date field.
 * Empty when the organization has no zone, so the form does not suggest the server day.
 */
export async function getErpLiteCivilToday(): Promise<string> {
  try {
    const { tenantId } = await getAuthContext();
    const zone = await resolveOperationalTimeZone(tenantId, 'ledger', null);
    return civilDateInZone(new Date(), zone);
  } catch {
    return '';
  }
}
