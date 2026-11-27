'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { dtInstantAtZone, localTimeKind, zoneOffsetLabel, type Disambiguation } from '@cmx/clock';
import { CmxButton } from '@ui/primitives/cmx-button';

export interface CmxDstChoiceProps {
  /** Civil date `YYYY-MM-DD` at the shop. */
  date: string;
  /** Local time `HH:mm` at the shop. */
  time: string;
  /** Shop zone (from the `clock` block). */
  zone: string;
  /** Called with `earlier` or `later`; send it back as `disambiguation`. */
  onChoose: (choice: Extract<Disambiguation, 'earlier' | 'later'>) => void;
  className?: string;
}

/**
 * S6 (T46): when a typed time happens twice (clocks go back), asks which one with its offset.
 * Renders nothing for a normal time. A time in a gap is refused by the server
 * (`LOCAL_TIME_NONEXISTENT`) and shown through `useClockErrorMessage`.
 */
export function CmxDstChoice({ date, time, zone, onChoose, className }: CmxDstChoiceProps) {
  const t = useTranslations('clock.disambiguation');
  const locale = useLocale();
  const options = useMemo(() => {
    try {
      if (localTimeKind(date, time, zone) !== 'overlap') return null;
      return (['earlier', 'later'] as const).map((choice) => ({
        choice,
        offset: zoneOffsetLabel(zone, dtInstantAtZone(zone, date, time, choice), locale),
      }));
    } catch {
      return null;
    }
  }, [date, time, zone, locale]);
  if (!options) return null;
  return (
    <div role="group" aria-label={t('title', { time })} className={className ?? 'flex flex-col gap-2'}>
      <p className="text-sm font-medium">{t('title', { time })}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <CmxButton key={o.choice} type="button" variant="outline" size="sm" onClick={() => onChoose(o.choice)}>
            <bdi>{t(o.choice, { time, offset: o.offset })}</bdi>
          </CmxButton>
        ))}
      </div>
    </div>
  );
}
