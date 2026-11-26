/**
 * S1 (Time & Timezone MASTER_PLAN_v2 §8): @cmx/clock is wired into web-admin, the shared vectors
 * pass here too, every user-facing clock error has an EN and AR message, and the operation list
 * includes `notify`; the SQL door accepts it from migration 0842 (S2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as clock from '@/lib/utils/clock';
import { OPERATIONAL_ZONE_OPERATIONS, isOperationalZoneOperation } from '@/lib/utils/operational-time';

const vectors = JSON.parse(
  readFileSync(require.resolve('@cmx/clock/vectors/time-vectors.v1.json'), 'utf8'),
) as { cases: Array<Record<string, any>> };
const catalog = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'messages', locale, 'clock.json'), 'utf8'));

describe('@cmx/clock in web-admin', () => {
  it('re-exports one operation list that includes notify (D27)', () => {
    expect(OPERATIONAL_ZONE_OPERATIONS).toBe(clock.OPERATIONAL_ZONE_OPERATIONS);
    expect(isOperationalZoneOperation('notify')).toBe(true);
    expect(clock.isSqlDoorOperation('notify')).toBe(true);
  });

  it('has an EN and AR text for every user-facing clock error', () => {
    for (const locale of ['en', 'ar']) {
      const messages = catalog(locale);
      for (const key of Object.values(clock.CLOCK_ERROR_MESSAGE_KEYS)) {
        if (!key) continue;
        const leaf = key.replace(/^clock\./, '').split('.').reduce((o: any, k) => o?.[k], messages);
        expect(typeof leaf).toBe('string');
      }
    }
  });

  it('agrees with the shared vectors for today, local time and business date', () => {
    const subset = vectors.cases.filter((c) => ['today', 'atLocal', 'businessDate', 'dayBounds'].includes(c.kind));
    expect(subset.length).toBeGreaterThan(40);
    for (const c of subset) {
      const run = () => {
        switch (c.kind) {
          case 'today':
            return clock.dtToday(clock.fixedClock(c.at), c.zone);
          case 'atLocal':
            return clock.dtAtLocal(c.date, c.time, c.zone, c.disambiguation).toISOString();
          case 'businessDate':
            return clock.dtBusinessDate(clock.parseInstant(c.at), c.zone, c.cutover);
          default: {
            const r = clock.dtDayBounds(c.from, c.toExclusive, c.zone);
            return { start: r.start.toISOString(), end: r.end.toISOString(), hours: (r.end.getTime() - r.start.getTime()) / 3_600_000 };
          }
        }
      };
      if (c.expect && typeof c.expect === 'object' && 'error' in c.expect) {
        let code: string | null = null;
        try {
          run();
        } catch (error) {
          code = clock.isClockError(error) ? error.code : String(error);
        }
        expect(code).toBe(c.expect.error);
      } else {
        expect(run()).toEqual(c.expect);
      }
    }
  });
});
