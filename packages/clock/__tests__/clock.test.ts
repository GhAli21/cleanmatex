import { actionClock, dtClock, dtNow, fixedClock, offsetClock, systemClock } from '@cmx/clock';

describe('injectable clock', () => {
  it('fixedClock answers one instant', () => {
    const c = fixedClock('2026-11-26T21:00:00.000Z');
    expect(dtNow(c).toISOString()).toBe('2026-11-26T21:00:00.000Z');
    expect(dtClock(c).toISOString()).toBe('2026-11-26T21:00:00.000Z');
  });
  it('fixedClock refuses a wall time without an offset', () => {
    expect(() => fixedClock('2026-11-26T21:00:00')).toThrow(RangeError);
  });
  it('offsetClock shifts another clock', () => {
    const c = offsetClock(fixedClock('2026-11-26T21:00:00.000Z'), 90_000);
    expect(dtNow(c).toISOString()).toBe('2026-11-26T21:01:30.000Z');
  });
  it('actionClock keeps the first value (transaction time mirror)', () => {
    let t = Date.parse('2026-11-26T21:00:00.000Z');
    const moving = { now: () => new Date((t += 1000)) as any };
    const a = actionClock(moving);
    const first = dtNow(a).getTime();
    expect(dtNow(a).getTime()).toBe(first);
    expect(dtClock(moving).getTime()).toBeGreaterThan(first);
  });
  it('returned instants are copies', () => {
    const c = fixedClock('2026-11-26T21:00:00.000Z');
    const a = dtNow(c);
    a.setTime(0);
    expect(dtNow(c).toISOString()).toBe('2026-11-26T21:00:00.000Z');
  });
  it('systemClock reads the machine once per call', () => {
    expect(Math.abs(dtNow(systemClock).getTime() - Date.now())).toBeLessThan(1000);
  });
});
