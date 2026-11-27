'use client';

import type { ReactNode } from 'react';
import { formatLocalTime } from '@cmx/clock';
import { useClock } from './clock-provider';

export interface CmxLocalTimeProps {
  /** Wall time `HH:mm` or `HH:mm:ss` (opening hours, cut-over); no zone is applied. */
  value: string | null | undefined;
  fallback?: ReactNode;
  className?: string;
}

/** A wall time of day in the tenant hour cycle. */
export function CmxLocalTime({ value, fallback = '—', className }: CmxLocalTimeProps) {
  const clock = useClock();
  let text: string | null = null;
  if (value) {
    try {
      text = formatLocalTime(value, clock.locale, { hourCycle: clock.hourCycle, numberingSystem: clock.numberingSystem });
    } catch {
      text = null;
    }
  }
  if (!text) return <span className={className}>{fallback}</span>;
  return (
    <time dateTime={value ?? undefined} className={className}>
      <bdi className="tabular-nums">{text}</bdi>
    </time>
  );
}
