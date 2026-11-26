/** Runs every case of the shared vector file against the public API of @cmx/clock. */
import * as clock from '@cmx/clock';
import vectors from '../vectors/time-vectors.v1.json';

type Case = Record<string, any> & { id: string; kind: string; expect: any };

const errorOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (error) {
    return clock.isClockError(error) ? error.code : `NON_CLOCK_ERROR:${String(error)}`;
  }
};

function check(c: Case, fn: () => unknown): void {
  if (c.expect && typeof c.expect === 'object' && 'error' in c.expect) {
    expect(errorOf(fn)).toBe(c.expect.error);
    return;
  }
  expect(fn()).toEqual(c.expect);
}

const catalog = clock.createZoneCatalog(vectors.catalog as clock.ZoneCatalogRow[]);
const active = new Set<string>(vectors.activeZones);
const iso = (d: Date) => d.toISOString();

export function runCase(c: Case): void {
  switch (c.kind) {
    case 'today':
      check(c, () => clock.dtToday(clock.fixedClock(c.at), c.zone));
      return;
    case 'localParts':
      check(c, () => clock.dtLocalParts(clock.parseInstant(c.at), c.zone));
      return;
    case 'toLocal':
      check(c, () => clock.dtToLocal(clock.parseInstant(c.at), c.zone));
      return;
    case 'atLocal':
      expect(clock.localTimeKind(c.date, c.time, c.zone)).toBe(c.localKind);
      check(c, () => iso(clock.dtAtLocal(c.date, c.time, c.zone, c.disambiguation)));
      return;
    case 'dayBounds':
      check(c, () => {
        const r = clock.dtDayBounds(c.from, c.toExclusive, c.zone);
        return { start: iso(r.start), end: iso(r.end), hours: (r.end.getTime() - r.start.getTime()) / 3_600_000 };
      });
      return;
    case 'periodKey':
      check(c, () => clock.dtPeriodKey(clock.parseInstant(c.at), c.zone, c.grain, c.options));
      return;
    case 'businessDate':
      check(c, () => clock.dtBusinessDate(clock.parseInstant(c.at), c.zone, c.cutover));
      return;
    case 'businessDayBounds':
      check(c, () => {
        const r = clock.dtBusinessDayBounds(c.from, c.toExclusive, c.zone, c.cutover);
        return { start: iso(r.start), end: iso(r.end) };
      });
      return;
    case 'civilAdd':
      check(c, () => clock.dtCivilAdd(c.date, c.n, c.unit));
      return;
    case 'zoneValid':
      check(c, () => ({ valid: clock.isValidZoneId(c.zone), canonical: clock.canonicalZoneId(c.zone) }));
      return;
    case 'catalog':
      check(c, () => ({
        valid: clock.isValidZoneId(c.zone, catalog),
        canonical: clock.canonicalZoneId(c.zone, catalog),
        isCanonical: clock.isCanonicalZoneId(c.zone, catalog),
      }));
      return;
    case 'settings': {
      const fns: Record<string, (i: any) => unknown> = {
        hourCycle: clock.resolveHourCycle,
        weekStart: clock.resolveWeekStart,
        cutover: clock.resolveCutover,
        dateFormat: clock.resolveDateFormat,
      };
      check(c, () => fns[c.setting](c.input));
      return;
    }
    case 'clockBlock':
      check(c, () =>
        clock.buildClockBlock({
          clock: clock.fixedClock(c.at),
          zone: c.zone,
          cutover: c.cutover,
          hourCycle: c.hourCycle,
          weekStart: c.weekStart,
          dateFormat: c.dateFormat,
          tzdbVersion: c.tzdbVersion,
        }),
      );
      return;
    case 'parseInstant':
      check(c, () => iso(clock.parseInstant(c.value)));
      return;
    case 'zoneResolution':
      check(c, () =>
        clock.selectZoneFromCandidates({
          operation: c.operation,
          scopeZone: c.scopeZone,
          organizationZone: c.organizationZone,
          isActiveZone: (z) => active.has(z),
        }),
      );
      return;
    default:
      throw new Error(`unknown vector kind ${c.kind} (${c.id})`);
  }
}

export const allCases = vectors.cases as Case[];
