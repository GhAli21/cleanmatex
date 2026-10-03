import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { isValidTimeZone } from '@/lib/utils/business-date';

/**
 * The signed-in tenant's IANA timezone, used as the display timezone for every formatted date.
 *
 * Returns `undefined` — never a guessed zone — when nobody is signed in or the tenant has no valid
 * timezone, so `next-intl` falls back to the viewer's own timezone instead of silently showing
 * another country's clock. Memoized per request.
 *
 * @returns a valid IANA timezone, or undefined
 * @example
 * const timeZone = await getTenantTimeZone(); // 'Asia/Muscat'
 */
export const getTenantTimeZone = cache(async (): Promise<string | undefined> => {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) return undefined;
    const tenant = await prisma.org_tenants_mst.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return isValidTimeZone(tenant?.timezone) ? tenant.timezone : undefined;
  } catch {
    return undefined;
  }
});
