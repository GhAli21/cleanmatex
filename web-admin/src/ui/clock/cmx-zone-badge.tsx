'use client';

import { useTranslations } from 'next-intl';
import { zoneOffsetLabel } from '@cmx/clock';
import { useClock } from './clock-provider';

export interface CmxZoneBadgeProps {
  /** The instant whose offset is shown (DST zones change offset). */
  at: string | Date;
  zone?: string | null;
  className?: string;
}

/** "Times shown in Asia/Muscat (GMT+4)". Renders nothing without a zone. */
export function CmxZoneBadge({ at, zone, className }: CmxZoneBadgeProps) {
  const t = useTranslations('clock.zone');
  const clock = useClock();
  const z = zone !== undefined ? zone : clock.zone;
  if (!z) return null;
  let offset: string;
  try {
    offset = zoneOffsetLabel(z, typeof at === 'string' ? new Date(at) : at, clock.locale);
  } catch {
    return null;
  }
  return (
    <span className={className ?? 'text-xs text-muted-foreground'}>
      {t('timesShownIn', { zone: z, offset })}
    </span>
  );
}
