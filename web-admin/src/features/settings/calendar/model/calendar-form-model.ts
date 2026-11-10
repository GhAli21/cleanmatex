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
