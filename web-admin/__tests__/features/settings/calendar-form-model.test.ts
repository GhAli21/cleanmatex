import { calendarWarnings, copyHoursToOpenDays, draftToWeek, weekToDraft } from '@features/settings/calendar/model/calendar-form-model';
import { branchCalendarSchema, organizationCalendarSchema } from '@/lib/validations/business-calendar-schemas';

const stored = { sun: { open: '08:00', close: '20:00' }, mon: { open: '09:00', close: '17:00' }, fri: null };

describe('Business Calendar form model', () => {
  it('round-trips a stored week; a missing or null day reads as closed', () => {
    const week = draftToWeek(weekToDraft(stored));
    expect(week.sun).toEqual({ open: '08:00', close: '20:00' });
    expect(week.fri).toBeNull();
    expect(week.tue).toBeNull();
  });

  it('copying hours leaves a closed day closed', () => {
    const next = copyHoursToOpenDays(weekToDraft(stored), 'sun');
    expect(next.mon).toMatchObject({ isOpen: true, open: '08:00', close: '20:00' });
    expect(next.fri.isOpen).toBe(false);
  });

  it('an open day with no times is refused at that day, not saved as closed', () => {
    const draft = weekToDraft(stored);
    draft.tue = { isOpen: true, open: '', close: '' };
    const parsed = organizationCalendarSchema.safeParse({ businessHours: draftToWeek(draft), cutoffTime: null, readyTime: null });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((i) => i.path[0] === 'businessHours' && i.path[1] === 'tue')).toBe(true);
  });

  it('a branch that follows the organization sends nulls', () => {
    expect(branchCalendarSchema.safeParse({ businessHours: null, cutoffTime: null, readyTime: null }).success).toBe(true);
  });

  describe('calendarWarnings (review G1)', () => {
    const week = weekToDraft(stored); // earliest open 08:00, latest close 20:00

    it('says nothing for a sensible setup or when no day is open', () => {
      expect(calendarWarnings(week, '11:00', '18:00')).toEqual([]);
      expect(calendarWarnings(weekToDraft(null), '11:00', '18:00')).toEqual([]);
    });
    it('a cut-off at or before the earliest opening pushes every drop-off to the next day', () => {
      expect(calendarWarnings(week, '08:00', '')).toEqual(['CUTOFF_BEFORE_OPENING']);
    });
    it('a cut-off at or after the latest closing never applies', () => {
      expect(calendarWarnings(week, '20:00', '')).toEqual(['CUTOFF_AFTER_CLOSING']);
    });
    it('a ready time outside all opening hours is capped at closing', () => {
      expect(calendarWarnings(week, '', '22:00')).toEqual(['READY_OUTSIDE_HOURS']);
      expect(calendarWarnings(week, '', '07:00')).toEqual(['READY_OUTSIDE_HOURS']);
    });
  });
});
