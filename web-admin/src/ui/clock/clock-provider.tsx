'use client';

/**
 * Clock context for a screen (MASTER_PLAN_v2 §7.7, S3). The zone always comes from the server
 * (a `clock` block or a resolved operations zone); a screen never takes the browser zone.
 * With no zone (`null`) the display components show their empty state instead of a time.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import {
  dtTodayOrNull,
  formatCivilDate,
  formatInstant,
  parseInstant,
  systemClock,
  type ClockBlock,
  type ClockStyle,
  type DateFormat,
  type HourCycle,
  type IsoWeekday,
  type NumberingSystem,
  type PublicClockBlock,
} from '@cmx/clock';

export interface ClockContextValue {
  /** IANA zone of the screen scope, or null when the organization/branch has none. */
  zone: string | null;
  locale: string;
  hourCycle?: HourCycle;
  weekStart?: IsoWeekday;
  dateFormat?: DateFormat;
  /** Business date of the scope (`YYYY-MM-DD`) when the server sent one. */
  businessDate?: string | null;
  /** D12: Latin digits unless a screen asks for Arabic-Indic digits. */
  numberingSystem: NumberingSystem;
  /** `serverNow` of the block the screen was built from (RFC 3339, `Z`). */
  serverNow?: string;
}

const ClockContext = createContext<Omit<ClockContextValue, 'locale'> | null>(null);

export interface ClockProviderProps {
  /** A screen `clock` block (D21) or its public subset. */
  block?: ClockBlock | PublicClockBlock | null;
  /** An explicit zone; wins over `block.zone`. Pass `null` for "no zone". */
  zone?: string | null;
  hourCycle?: HourCycle;
  numberingSystem?: NumberingSystem;
  children: ReactNode;
}

/** Puts the screen zone and display preferences in context for the Cmx clock components. */
export function ClockProvider({ block, zone, hourCycle, numberingSystem, children }: ClockProviderProps) {
  // A nested provider (a branch screen inside the organization layout) keeps the outer
  // display preferences unless it brings its own block.
  const parent = useContext(ClockContext);
  const value = useMemo(() => {
    const full = block && 'weekStart' in block ? block : null;
    const zoneValue = zone !== undefined ? zone : block ? (block.zone ?? null) : (parent?.zone ?? null);
    const sameZone = zoneValue === (parent?.zone ?? null);
    return {
      zone: zoneValue,
      hourCycle: hourCycle ?? block?.hourCycle ?? parent?.hourCycle,
      weekStart: full?.weekStart ?? parent?.weekStart,
      dateFormat: block?.dateFormat ?? parent?.dateFormat,
      businessDate: full ? (full.businessDate ?? null) : sameZone ? (parent?.businessDate ?? null) : null,
      numberingSystem: numberingSystem ?? parent?.numberingSystem ?? ('latn' as NumberingSystem),
      serverNow: block?.serverNow ?? parent?.serverNow,
    };
  }, [block, zone, hourCycle, numberingSystem, parent]);
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

/** The screen clock. Outside a provider the zone is null (fail closed), never the device zone. */
export function useClock(): ClockContextValue {
  const locale = useLocale();
  const ctx = useContext(ClockContext);
  return useMemo(
    () => ({ zone: null, numberingSystem: 'latn' as NumberingSystem, ...(ctx ?? {}), locale }),
    [ctx, locale],
  );
}

/** Text form of an instant (`Z` or offset string, or a Date). Null when there is no zone or no valid instant. */
export function formatInstantText(
  value: string | Date | null | undefined,
  zone: string | null | undefined,
  clock: Pick<ClockContextValue, 'locale' | 'hourCycle' | 'numberingSystem'>,
  style: ClockStyle = 'datetime',
): string | null {
  if (!value || !zone) return null;
  try {
    const at = typeof value === 'string' ? parseInstant(value) : value;
    return formatInstant(at, zone, clock.locale, { style, hourCycle: clock.hourCycle, numberingSystem: clock.numberingSystem });
  } catch {
    return null;
  }
}

/** A formatter bound to the screen clock, for props that need a string (copy cells, titles). */
export function useInstantFormatter(): (value: string | Date | null | undefined, style?: ClockStyle) => string | null {
  const clock = useClock();
  return useCallback((value, style = 'datetime') => formatInstantText(value, clock.zone, clock, style), [clock]);
}

/**
 * Civil today (`YYYY-MM-DD`) in the screen zone, for date-input defaults and "as of" fields.
 * Empty string while there is no zone, so a form never starts on the device day.
 */
export function useClockCivilToday(): string {
  const { zone } = useClock();
  return useMemo(() => (zone ? (dtTodayOrNull(systemClock, zone) ?? '') : ''), [zone]);
}

/**
 * Text for a stored value that is either a civil date (`YYYY-MM-DD`, shown as is, no zone)
 * or an instant (shown in the zone). Null when it cannot be shown without guessing.
 */
export function formatDateValueText(
  value: string | Date | null | undefined,
  zone: string | null | undefined,
  clock: Pick<ClockContextValue, 'locale' | 'hourCycle' | 'numberingSystem' | 'dateFormat'>,
  style: ClockStyle = 'datetime',
): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      return formatCivilDate(value, clock.locale, { style: 'date', dateFormat: clock.dateFormat, numberingSystem: clock.numberingSystem });
    } catch {
      return null;
    }
  }
  return formatInstantText(value, zone, clock, style);
}

/** {@link formatDateValueText} bound to the screen clock (print roots, table cells). */
export function useDateValueFormatter(): (value: string | Date | null | undefined, style?: ClockStyle) => string | null {
  const clock = useClock();
  return useCallback((value, style = 'datetime') => formatDateValueText(value, clock.zone, clock, style), [clock]);
}
