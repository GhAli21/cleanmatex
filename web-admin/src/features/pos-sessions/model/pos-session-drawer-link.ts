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

type LinkedDrawerSession = Pick<
  PosSessionWithContext,
  'cash_drawer_id' | 'cash_drawer_session_id' | 'cash_drawer_session_status'
>;

/** OPEN and CLOSING both block a POS close until the drawer session is finished. */
export function linkedDrawerSessionIsLive(status: string | null | undefined): boolean {
  return status === CASH_DRAWER_SESSION_STATUSES.OPEN || status === CASH_DRAWER_SESSION_STATUSES.CLOSING;
}

/**
 * Drawer overview that opens the close wizard for this POS session's drawer.
 * Null when there is no linked drawer, or the drawer session is already finished,
 * unless `whenBlocked` records that close was just refused because the drawer is still live.
 */
export function linkedDrawerCloseHref(
  session: LinkedDrawerSession | null | undefined,
  options?: { whenBlocked?: boolean }
): string | null {
  if (!session?.cash_drawer_id || !session.cash_drawer_session_id) return null;
  if (!linkedDrawerSessionIsLive(session.cash_drawer_session_status) && !options?.whenBlocked) return null;
  const params = new URLSearchParams({ closeSession: session.cash_drawer_session_id });
  return `/dashboard/internal_fin/cash-drawers/${session.cash_drawer_id}?${params.toString()}`;
}
