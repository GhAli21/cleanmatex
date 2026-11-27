'use client';

import type { ReactNode } from 'react';
import { parseInstant, zoneLabel, type ClockStyle } from '@cmx/clock';
import { formatInstantText, useClock } from './clock-provider';

export interface CmxInstantProps {
  /** An instant with an offset (`…Z` / `…+00:00`) or a Date. */
  value: string | Date | null | undefined;
  /** Overrides the provider zone for this value (e.g. the fulfilment-branch zone). */
  zone?: string | null;
  style?: ClockStyle;
  /** Shown when there is no value, no zone, or the value is not an instant. Default `—`. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * An instant painted in an explicit zone, as `<time dateTime="…Z">`. The title names the IANA
 * zone and its offset at that instant. Never uses the device zone.
 */
export function CmxInstant({ value, zone, style = 'datetime', fallback = '—', className }: CmxInstantProps) {
  const clock = useClock();
  const z = zone !== undefined ? zone : clock.zone;
  const text = formatInstantText(value, z, clock, style);
  if (!text || !z || !value) return <span className={className}>{fallback}</span>;
  const at = typeof value === 'string' ? parseInstant(value) : value;
  let title: string | undefined;
  try {
    title = zoneLabel(z, at, clock.locale);
  } catch {
    title = z;
  }
  return (
    <time dateTime={at.toISOString()} title={title} className={className}>
      <bdi className="tabular-nums">{text}</bdi>
    </time>
  );
}
