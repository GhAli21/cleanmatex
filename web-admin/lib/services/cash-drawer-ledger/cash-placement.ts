import 'server-only';
import type { Prisma } from '@prisma/client';

import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import { CashDrawerLedgerError } from './cash-drawer-errors';

/**
 * Explicit cash placement a caller may impose on a cash line that the gate would
 * otherwise place automatically (VERIFY of a pending leg, reversal mirrors).
 * Used when the intended drawer can no longer take the cash (deactivated,
 * wrong branch …). Every field is optional; the gate's own integrity rules
 * (active, same branch, type, currency) still decide whether the drawer is
 * acceptable — an override never bypasses them.
 */
export interface CashPlacementOverride {
  /** Put the cash in this drawer instead of the line's own drawer. */
  cashDrawerId?: string | null;
  /**
   * Pin the placement to this session. With a drawer it must belong to it; alone
   * it implies its drawer. The cash must land in exactly this session or the
   * operation is refused (so what the user saw is what is recorded).
   */
  cashDrawerSessionId?: string | null;
  /** The user who physically handled the cash when that is not the acting user. */
  receivedByUserId?: string | null;
}

/** An override after validation against the tenant's data. */
export interface ResolvedCashPlacement {
  drawerId: string | null;
  sessionId: string | null;
  /** Value for `cash_recognized_by` (null = the acting user). */
  recognizedBy: string | null;
}

/** True when the override carries any field. */
export function hasCashPlacement(override: CashPlacementOverride | null | undefined): boolean {
  return Boolean(override?.cashDrawerId || override?.cashDrawerSessionId || override?.receivedByUserId);
}

/**
 * Validates an override against the tenant's data and normalises it.
 * @param tx open Prisma transaction
 * @param tenantOrgId tenant scope
 * @param override the caller-supplied placement
 * @returns the resolved placement, or null when the override is empty
 * @throws CashDrawerLedgerError CASH_DRAWER_SESSION_NOT_OPEN (unknown session),
 *   DRAWER_SESSION_WRONG_DRAWER (session of another drawer), CASH_RECEIVER_INVALID
 * @example const p = await resolveCashPlacementTx(tx, tenantId, { cashDrawerId });
 */
export async function resolveCashPlacementTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  override: CashPlacementOverride | null | undefined,
): Promise<ResolvedCashPlacement | null> {
  if (!hasCashPlacement(override)) return null;

  let drawerId = override?.cashDrawerId ?? null;
  const sessionId = override?.cashDrawerSessionId ?? null;

  if (sessionId) {
    const session = await tx.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantOrgId },
      select: { cash_drawer_id: true },
    });
    if (!session) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN, 'placement: session not found', {
        sessionId,
      });
    }
    if (drawerId && drawerId !== session.cash_drawer_id) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'placement: session belongs to another drawer', {
        sessionId,
        drawerId,
      });
    }
    drawerId = session.cash_drawer_id;
  }

  let recognizedBy: string | null = null;
  if (override?.receivedByUserId) {
    const user = await tx.org_users_mst.findFirst({
      where: { tenant_org_id: tenantOrgId, user_id: override.receivedByUserId, is_active: true },
      select: { user_id: true },
    });
    if (!user) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_RECEIVER_INVALID, 'placement: receiving user not found', {
        userId: override.receivedByUserId,
      });
    }
    recognizedBy = user.user_id;
  }

  return { drawerId, sessionId, recognizedBy };
}

/**
 * Enforces a pinned session: the cash must have landed in exactly that session.
 * @param resolved the validated override
 * @param landedSessionId the session the gate actually chose (null = next window)
 * @param details ids for the log
 * @throws CashDrawerLedgerError CASH_DRAWER_SESSION_NOT_OPEN when it landed elsewhere
 */
export function assertPinnedSession(
  resolved: ResolvedCashPlacement | null,
  landedSessionId: string | null,
  details: Record<string, unknown> = {},
): void {
  if (resolved?.sessionId && resolved.sessionId !== landedSessionId) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN, 'placement: pinned session is not the open session', {
      ...details,
      pinnedSessionId: resolved.sessionId,
      landedSessionId,
    });
  }
}
