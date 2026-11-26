import {
  ClockError,
  dtAtLocal,
  dtToday,
  fixedClock,
  isClockError,
  CLOCK_ERROR_HTTP_STATUS,
} from './clock';

describe('@cmx/clock in cmx-api (Time & Timezone S1)', () => {
  it('loads the CommonJS build and computes the branch civil date', () => {
    expect(dtToday(fixedClock('2026-11-26T21:00:00.000Z'), 'Asia/Muscat')).toBe('2026-11-27');
  });

  it('fails closed on a missing zone with a typed error and an HTTP status', () => {
    let caught: unknown;
    try {
      dtToday(fixedClock('2026-11-26T21:00:00.000Z'), null);
    } catch (error) {
      caught = error;
    }
    expect(isClockError(caught)).toBe(true);
    expect((caught as ClockError).code).toBe('TIMEZONE_NOT_CONFIGURED');
    expect(CLOCK_ERROR_HTTP_STATUS.TIMEZONE_NOT_CONFIGURED).toBe(422);
  });

  it('rejects a local time that does not exist', () => {
    expect(() => dtAtLocal('2026-03-08', '02:30', 'America/New_York')).toThrow(ClockError);
  });
});
