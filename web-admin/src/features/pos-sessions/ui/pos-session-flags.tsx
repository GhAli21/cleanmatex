'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@ui/primitives/badge';
import { CmxSummaryMessage } from '@ui/feedback';
import {
  getPosSessionFlags,
  type PosSessionFlagFacts,
} from '@features/pos-sessions/model/pos-session-flags';

/**
 * Small badges next to a session's status: stale, rolled over, auto-closed. Renders nothing for a
 * healthy session, so it can be dropped beside any status badge.
 */
export function PosSessionFlagBadges({ session }: { session: PosSessionFlagFacts }) {
  const t = useTranslations('posSessions');
  const flags = getPosSessionFlags(session);
  if (!flags.stale && !flags.rolledOver && !flags.autoClosed) return null;
  return (
    <span className="ms-1 inline-flex flex-wrap gap-1 align-middle">
      {flags.stale ? <Badge variant="warning">{t('flags.stale')}</Badge> : null}
      {flags.rolledOver && flags.isLive ? <Badge variant="warning">{t('flags.rolledOver')}</Badge> : null}
      {flags.autoClosed ? <Badge variant="outline">{t('flags.autoClosed')}</Badge> : null}
    </span>
  );
}

/**
 * Explains, above the lifecycle buttons, why a live session needs attention and what to do:
 * a rolled-over session must be closed (it cannot be resumed), a stale one should be closed or
 * handed over. Nothing for a healthy session.
 */
export function PosSessionAttentionNotice({
  session,
  className,
}: {
  session: PosSessionFlagFacts;
  className?: string;
}) {
  const t = useTranslations('posSessions');
  const flags = getPosSessionFlags(session);
  if (!flags.isLive) return null;
  if (flags.rolledOver) {
    return (
      <CmxSummaryMessage
        type="warning"
        title={t('flags.rolledOverTitle')}
        items={[t('flags.rolledOverBody')]}
        className={className}
      />
    );
  }
  if (flags.stale) {
    return (
      <CmxSummaryMessage
        type="warning"
        title={t('flags.staleTitle')}
        items={[t('flags.staleBody')]}
        className={className}
      />
    );
  }
  return null;
}
