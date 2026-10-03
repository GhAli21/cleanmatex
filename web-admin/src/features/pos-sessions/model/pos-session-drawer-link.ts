import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer';
import type { PosSessionWithContext } from '@/lib/types/pos-session';

/**
 * True whenever the POS session either has no cash drawer session linked
 * yet, or the drawer session it last linked to is no longer OPEN (closed or
 * force-closed independently, e.g. by a supervisor from the drawer screen).
 *
 * Shared by both the order-entry Session Hub and the POS Sessions admin
 * screen so "needs a drawer" is defined once and stays in sync everywhere
 * the cash-drawer link is surfaced.
 */
export function needsDrawerSelection(
  session: Pick<PosSessionWithContext, 'cash_drawer_session_id' | 'cash_drawer_session_status'>
): boolean {
  if (!session.cash_drawer_session_id) return true;
  return session.cash_drawer_session_status !== CASH_DRAWER_SESSION_STATUSES.OPEN;
}
