/**
 * Server Actions: Cash Drawers
 *
 * getDrawers: list all active drawers for the tenant.
 * openDrawerSession: open a new session on a drawer.
 * closeDrawerSession: close an open session with a physical count.
 * addDrawerMovement: record a cash-in / cash-out / petty-cash movement.
 * getDrawerSessionSummary: return session + movements + payments for a session.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getDrawers,
  openSession,
  closeSession,
  recordMovement,
  getSessionSummary,
} from '@/lib/services/cash-drawer.service';
import type { SessionCloseParams } from '@/lib/services/cash-drawer.service';

/** List all active cash drawers for the current tenant. */
export async function getDrawersAction() {
  try {
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

/** Open a new session for a drawer. */
export async function openDrawerSession(
  drawerId: string,
  params: { openingBalance: number; notes?: string }
) {
  try {
    const auth = await getAuthContext();
    const session = await openSession(auth.tenantId, drawerId, {
      openingBalance: params.openingBalance,
      openedBy: auth.userId,
      notes: params.notes,
    });
    revalidatePath('/dashboard/internal_fin/cash-drawers');
    return { success: true as const, data: session };
  } catch (error) {
    console.error('[openDrawerSession] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to open session',
    };
  }
}

/** Close an open session with physical cash count. */
export async function closeDrawerSession(
  sessionId: string,
  params: { physicalCount: number; notes?: string }
) {
  try {
    const auth = await getAuthContext();
    const closeParams: SessionCloseParams = {
      physicalCount: params.physicalCount,
      closedBy: auth.userId,
      notes: params.notes,
    };
    const result = await closeSession(auth.tenantId, sessionId, closeParams);
    revalidatePath('/dashboard/internal_fin/cash-drawers');
    return { success: true as const, data: result };
  } catch (error) {
    console.error('[closeDrawerSession] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to close session',
    };
  }
}

/** Record a cash movement (CASH_IN / CASH_OUT / PETTY_CASH) on a drawer. */
export async function addDrawerMovement(
  drawerId: string,
  params: {
    movementType: 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH';
    amount: number;
    reason: string;
  }
) {
  try {
    const auth = await getAuthContext();
    const movement = await recordMovement(auth.tenantId, drawerId, {
      ...params,
      performedBy: auth.userId,
    });
    revalidatePath(`/dashboard/internal_fin/cash-drawers`);
    return { success: true as const, data: movement };
  } catch (error) {
    console.error('[addDrawerMovement] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to record movement',
    };
  }
}

/** Get full session summary (session + movements + payments). */
export async function getDrawerSessionSummaryAction(sessionId: string) {
  try {
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
