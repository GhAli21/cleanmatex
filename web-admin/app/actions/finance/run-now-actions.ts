/**
 * Server Actions: "run now" for the calling Organization (Background Jobs step 6g).
 *
 * expireDueGiftCardsAction    — gift cards past their expiry date        (gift_cards:expire)
 * expireDueCreditNotesAction  — credit notes past their expiry date      (stored_value:expire_credit_notes)
 * expireDueLoyaltyPointsAction — loyalty points past the program period  (loyalty:expire_points)
 * retryErpSystemErrorsAction  — open SYSTEM_ERROR posting exceptions     (erp_lite_exceptions:retry)
 *
 * Each runs only for the Organization of the signed-in user; the nightly jobs cover every
 * Organization. Logic lives in lib/services/finance-run-now.service.ts.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { logger } from '@/lib/utils/logger';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';
import {
  expireDueCreditNotesNow,
  expireDueGiftCardsNow,
  expireDueLoyaltyPointsNow,
  retryErpSystemErrorsNow,
  type RunNowOutcome,
} from '@/lib/services/finance-run-now.service';

/** Flat result (see ActionResult note): `data` is set when `success`. `error` is a code, not text. */
export interface RunNowActionResult {
  success: boolean;
  data?: RunNowOutcome;
  error?: 'FORBIDDEN' | 'FAILED';
}

async function runForCurrentTenant(
  permission: string,
  run: (tenantOrgId: string) => Promise<RunNowOutcome>,
  paths: string[],
): Promise<RunNowActionResult> {
  if (!(await hasPermissionServer(permission))) return { success: false, error: 'FORBIDDEN' };
  // Organization resolved server-side from the authenticated session, never from the client.
  const { tenantId } = await getAuthContext();
  try {
    const data = await run(tenantId);
    // Lists on these screens show status and balances that just changed.
    for (const p of paths) revalidatePath(p);
    return { success: true, data };
  } catch (err) {
    logger.error('Run now failed', err instanceof Error ? err : undefined, { tenantId, permission });
    return { success: false, error: 'FAILED' };
  }
}

/** Expires this Organization's due gift cards now. */
export async function expireDueGiftCardsAction(): Promise<RunNowActionResult> {
  return runForCurrentTenant('gift_cards:expire', expireDueGiftCardsNow, ['/dashboard/marketing/gift-cards']);
}

/** Expires this Organization's due credit notes now. */
export async function expireDueCreditNotesAction(): Promise<RunNowActionResult> {
  return runForCurrentTenant(FINANCE_PERMISSIONS.STORED_VALUE_EXPIRE_CREDIT_NOTES, expireDueCreditNotesNow, ['/dashboard/customers/stored-value']);
}

/** Expires this Organization's due loyalty points now. */
export async function expireDueLoyaltyPointsAction(): Promise<RunNowActionResult> {
  return runForCurrentTenant(FINANCE_PERMISSIONS.LOYALTY_EXPIRE_POINTS, expireDueLoyaltyPointsNow, ['/dashboard/marketing/loyalty']);
}

/** Retries this Organization's open SYSTEM_ERROR posting exceptions now. */
export async function retryErpSystemErrorsAction(): Promise<RunNowActionResult> {
  return runForCurrentTenant('erp_lite_exceptions:retry', retryErpSystemErrorsNow, [
    '/dashboard/erp-lite/exceptions',
    '/dashboard/erp-lite/readiness',
  ]);
}
