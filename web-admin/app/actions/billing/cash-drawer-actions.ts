/* eslint-disable jsdoc/require-param */
/**
 * Server Actions: Cash Drawers
 *
 * getDrawers: list all active drawers for the tenant.
 * postDrawerCashInOut: post a "Cash in / Cash out" movement (CLF W11) as a
 *   finance voucher, replacing the deleted addDrawerMovement/recordMovement.
 * getDrawerSessionSummary: return session + movements + payments for a session.
 *
 * CLF-8 slice A (2026-10-02): `openDrawerSession`/`closeDrawerSession` retired
 * — the drawer overview screen now opens/closes through the CLF two-step
 * lifecycle routes directly (`CashDrawerOpenSessionDialog` /
 * `CashDrawerCloseWizard`, calling `/api/v1/cash-drawers/.../open-session-v2`
 * and `.../close/count` + `.../close/finalize`), as does Payment Modal V4 for
 * its open-session step. CLF R3 deleted the legacy single-step
 * `openSession`/`closeSession`/`approveSessionVariance`.
 *
 * CLF W15: every action checks the same permission its /api/v1/cash-drawers
 * route counterpart enforces (server actions are callable directly, so a UI
 * gate alone is not enough).
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getDrawers, getSessionSummary } from '@/lib/services/cash-drawer.service';
import {
  postDrawerCashMovement,
  type PostDrawerCashMovementInput,
} from '@/lib/services/cash-drawer-movement-posting.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';

/**
 * Fresh literal on every call (not a shared const): with `strict: false` the
 * inferred union only normalises `error?` onto the success variant for object
 * literals, which the calling screens rely on to read `result.error`.
 */
const INSUFFICIENT_PERMISSIONS = 'Insufficient permissions';

/** List all active cash drawers for the current tenant. */
export async function getDrawersAction() {
  try {
    if (!(await hasPermissionServer(FINANCE_PERMISSIONS.CASH_DRAWER_VIEW))) {
      return { success: false as const, error: INSUFFICIENT_PERMISSIONS };
    }
    const auth = await getAuthContext();
    const drawers = await getDrawers(auth.tenantId);
    return { success: true as const, data: drawers };
  } catch (error) {
    console.error('[getDrawersAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load drawers',
    };
  }
}

/**
 * Post a drawer "Cash in / Cash out" movement (CLF W11, §4B.2a-A) as a
 * finance voucher — replaces the deleted addDrawerMovement/recordMovement.
 * Ledger refusals surface as `error: <CASH_LEDGER_ERRORS code>` so the dialog
 * can translate via `cashControl.ledgerErrors` (same pattern as
 * sellGiftCardWithTenderAction).
 */
export async function postDrawerCashInOut(
  drawerId: string,
  params: Omit<PostDrawerCashMovementInput, 'drawerId'>
) {
  try {
    if (!(await hasPermissionServer(FINANCE_PERMISSIONS.CASH_DRAWER_RECORD_MOVEMENT))) {
      return { success: false as const, error: INSUFFICIENT_PERMISSIONS };
    }
    const auth = await getAuthContext();
    const result = await postDrawerCashMovement(auth.tenantId, auth.userId, {
      ...params,
      drawerId,
    });
    revalidatePath(`/dashboard/internal_fin/cash-drawers`);
    return { success: true as const, data: result };
  } catch (error) {
    console.error('[postDrawerCashInOut] Error:', error);
    if (error instanceof CashDrawerLedgerError) {
      return { success: false as const, error: error.code };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to post cash movement',
    };
  }
}

/** Get full session summary (session + movements + payments). */
export async function getDrawerSessionSummaryAction(sessionId: string) {
  try {
    if (!(await hasPermissionServer(FINANCE_PERMISSIONS.CASH_DRAWER_VIEW))) {
      return { success: false as const, error: INSUFFICIENT_PERMISSIONS };
    }
    const auth = await getAuthContext();
    const summary = await getSessionSummary(auth.tenantId, sessionId);
    return { success: true as const, data: summary };
  } catch (error) {
    console.error('[getDrawerSessionSummaryAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load session summary',
    };
  }
}
