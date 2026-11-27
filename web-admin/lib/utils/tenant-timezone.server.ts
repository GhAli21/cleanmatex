import 'server-only';

import { cache } from 'react';
import type { ClockBlock } from '@cmx/clock';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { getScreenClockBlock } from '@/lib/clock/clock-block.server';
import { logger } from '@/lib/utils/logger';

/**
 * The signed-in organization's `clock` block (D21), resolved by the SQL door
 * (`fn_cmx_dt_zone` + `fn_cmx_dt_settings`). The root layout puts it in a `ClockProvider`
 * so every screen has the organization zone; branch screens nest their own provider (G8).
 * Null when nobody is signed in or the read fails. Memoized per request.
 */
export const getTenantClockBlock = cache(async (): Promise<ClockBlock | null> => {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) return null;
    return await getScreenClockBlock({ tenantOrgId: tenantId, operation: 'accept_order', branchId: null });
  } catch (err) {
    logger.error('Tenant clock block unavailable', err instanceof Error ? err : new Error(String(err)), {});
    return null;
  }
});

/**
 * The signed-in organization's IANA zone for `next-intl`, or `undefined` — never a guessed zone.
 * Screens format times with `@ui/clock` (explicit zone, "—" when missing); this only covers
 * older `next-intl` date calls.
 *
 * @returns a valid IANA timezone, or undefined
 * @example
 * const timeZone = await getTenantTimeZone(); // 'Asia/Muscat'
 */
export const getTenantTimeZone = cache(async (): Promise<string | undefined> => {
  const block = await getTenantClockBlock();
  return block?.zone ?? undefined;
});
