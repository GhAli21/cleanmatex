'use client';

import { useTranslations } from 'next-intl';
import { useClock } from './clock-provider';

export interface CmxZoneNoticeProps {
  className?: string;
}

/**
 * G8: shown on an operational screen when the organization has no time zone.
 * Times on that screen render as "—" (fail closed) instead of the viewer's clock.
 */
export function CmxZoneNotice({ className }: CmxZoneNoticeProps) {
  const t = useTranslations('clock.zone');
  const { zone } = useClock();
  if (zone) return null;
  return (
    <div
      role="status"
      className={className ?? 'rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text'}
    >
      {t('notConfigured')}
    </div>
  );
}
