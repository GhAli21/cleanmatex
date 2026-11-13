import { WEEKDAYS, type BusinessHours, type Weekday } from '@/lib/commercial/calendar';

/** One day in the hours form; times are kept while a day is switched off, so switching it back loses nothing. */
export interface DayDraft {
  isOpen: boolean;
  open: string;
  close: string;
}

/** A week in the hours form. */
export type WeekDraft = Record<Weekday, DayDraft>;

/**
 * Stored hours → form state.
 * @param hours - stored week; null reads as every day closed
 * @returns one entry per weekday
 */
export function weekToDraft(hours: BusinessHours | null): WeekDraft {
  const draft = {} as WeekDraft;
  for (const day of WEEKDAYS) {
    const stored = hours?.[day];
    draft[day] = { isOpen: !!stored, open: stored?.open ?? '', close: stored?.close ?? '' };
  }
  return draft;
}

/**
 * Form state → the week the API validates. An open day with an empty time is
 * sent as typed, so the schema refuses it at that day.
 * @param draft - form state
 * @returns the week, closed days null
 */
export function draftToWeek(draft: WeekDraft): BusinessHours {
  const week: BusinessHours = {};
  for (const day of WEEKDAYS) {
    week[day] = draft[day].isOpen ? { open: draft[day].open, close: draft[day].close } : null;
  }
  return week;
}

/**
 * "Copy to open days": a closed day stays closed.
 * @param draft - form state
 * @param source - the day to copy
 * @returns the new form state
 */
export function copyHoursToOpenDays(draft: WeekDraft, source: Weekday): WeekDraft {
  const { open, close } = draft[source];
  const next = { ...draft };
  for (const day of WEEKDAYS) {
    if (next[day].isOpen) next[day] = { ...next[day], open, close };
  }
  return next;
}

/** A setup that saves but promises odd times; shown as a warning, never blocks the save. */
export type CalendarWarning = 'CUTOFF_BEFORE_OPENING' | 'CUTOFF_AFTER_CLOSING' | 'READY_OUTSIDE_HOURS';

/**
 * Cross-field hints on the effective calendar (review G1). Times compare as `HH:MM` text.
 * - cut-off at or before the earliest opening: every drop-off counts from the next day;
 * - cut-off at or after the latest closing: the cut-off never applies;
 * - ready time outside every day's hours: the promise is capped at closing / starts at opening.
 * @param week - the effective week (organization's when a branch follows it)
 * @param cutoff - `HH:MM` or empty
 * @param ready - `HH:MM` or empty
 * @returns the warnings, empty when nothing looks odd or no day is open
 */
export function calendarWarnings(week: WeekDraft, cutoff: string, ready: string): CalendarWarning[] {
  const open = WEEKDAYS.map((d) => week[d]).filter((d) => d.isOpen && d.open && d.close);
  if (open.length === 0) return [];
  const earliestOpen = open.reduce((a, d) => (d.open < a ? d.open : a), open[0].open);
  const latestClose = open.reduce((a, d) => (d.close > a ? d.close : a), open[0].close);
  const warnings: CalendarWarning[] = [];
  if (cutoff && cutoff <= earliestOpen) warnings.push('CUTOFF_BEFORE_OPENING');
  if (cutoff && cutoff >= latestClose) warnings.push('CUTOFF_AFTER_CLOSING');
  if (ready && (ready < earliestOpen || ready > latestClose)) warnings.push('READY_OUTSIDE_HOURS');
  return warnings;
}
