'use client';

import type { ReactNode } from 'react';
import { formatCivilDate } from '@cmx/clock';
import { useClock } from './clock-provider';

export interface CmxCivilDateProps {
  /** `YYYY-MM-DD`; never shifted by a zone. */
  value: string | null | undefined;
  style?: 'date' | 'dateLong';
  fallback?: ReactNode;
  className?: string;
}

/** A civil date (business date, due date) in the tenant date format when one is set (D34). */
export function CmxCivilDate({ value, style = 'date', fallback = '—', className }: CmxCivilDateProps) {
  const clock = useClock();
  let text: string | null = null;
  if (value) {
    try {
      text = formatCivilDate(value, clock.locale, { dateFormat: clock.dateFormat, style, numberingSystem: clock.numberingSystem });
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
