'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer';
import { CmxButton } from '@ui/primitives';
import { linkedDrawerCloseHref } from '@features/pos-sessions/model/pos-session-drawer-link';
import type { PosSessionWithContext } from '@/lib/types/pos-session';

type DrawerCloseSession = Pick<
  PosSessionWithContext,
  'cash_drawer_id' | 'cash_drawer_session_id' | 'cash_drawer_session_status'
>;

/**
 * Footer action that opens the linked drawer session's close wizard.
 * Shown only while that drawer session still has to be closed.
 */
export function PosSessionDrawerCloseLink({
  session,
  canGo,
  whenBlocked = false,
}: {
  session: DrawerCloseSession | null | undefined;
  canGo: boolean;
  /** Close was refused because the drawer is still open, even if the list status is stale. */
  whenBlocked?: boolean;
}) {
  const t = useTranslations('posSessions');
  const href = canGo ? linkedDrawerCloseHref(session, { whenBlocked }) : null;
  if (!href) return null;

  const label =
    session?.cash_drawer_session_status === CASH_DRAWER_SESSION_STATUSES.CLOSING
      ? t('hub.finishClose')
      : t('goToDrawerClose');

  return (
    <CmxButton asChild variant="outline" className="me-auto">
      <Link href={href}>{label}</Link>
    </CmxButton>
  );
}
