/**
 * @jest-environment node
 */
/**
 * S7 (MASTER_PLAN_v2 §7.7, §7.15; T14, T55): export/response time helpers and the clock health report.
 */
jest.mock('server-only', () => ({}));

import {
  exportDateValue,
  exportFileDay,
  exportLocalText,
  exportZoneHeader,
  toApiInstant,
  withApiInstants,
} from '@/lib/clock/api-output';
import { CLOCK_HEALTH_VECTORS, getClockHealth } from '@/lib/clock/clock-health.server';
import { toCsv } from '@/lib/utils/report-csv';

describe('toApiInstant', () => {
  it('normalizes Date and offset text to Z with milliseconds', () => {
    expect(toApiInstant(new Date(Date.UTC(2026, 2, 29, 22, 30)))).toBe('2026-03-29T22:30:00.000Z');
    expect(toApiInstant('2026-03-30T02:30:00+04:00')).toBe('2026-03-29T22:30:00.000Z');
    expect(toApiInstant('2026-03-29T22:30:00Z')).toBe('2026-03-29T22:30:00.000Z');
  });
  it('refuses offset-less, civil, empty and invalid input (never the server zone)', () => {
    expect(toApiInstant('2026-03-29T22:30:00')).toBeNull();
    expect(toApiInstant('2026-03-29')).toBeNull();
    expect(toApiInstant('')).toBeNull();
    expect(toApiInstant(null)).toBeNull();
    expect(toApiInstant(new Date('nope'))).toBeNull();
  });
  it('rewrites only the listed fields', () => {
    const row = withApiInstants({ at: new Date(Date.UTC(2026, 0, 1)), day: '2026-01-01', n: 1 }, ['at']);
    expect(row).toEqual({ at: '2026-01-01T00:00:00.000Z', day: '2026-01-01', n: 1 });
  });
});

describe('export helpers', () => {
  const at = '2026-06-18T10:00:00.000Z';
  it('local text is in the given zone, Latin digits, 24h; empty without a zone', () => {
    expect(exportLocalText(at, 'Asia/Kathmandu')).toContain('15:45');
    expect(exportLocalText(at, 'America/Los_Angeles')).toContain('03:00');
    expect(exportLocalText(at, null)).toBe('');
  });
  it('civil dates pass through; instants become Z', () => {
    expect(exportDateValue('2026-06-18')).toBe('2026-06-18');
    expect(exportDateValue(new Date(at))).toBe(at);
  });
  it('names the zone and never uses the device day for file names', () => {
    expect(exportZoneHeader('Asia/Muscat')).toBe('# Time Zone: Asia/Muscat');
    expect(exportZoneHeader(null)).toBe('# Time Zone: not configured');
    expect(exportFileDay('2026-06-18')).toBe('2026-06-18');
    expect(exportFileDay('')).toBe('export');
    expect(exportFileDay(null, 'data')).toBe('data');
  });
  it('report CSV writes Date cells as Z', () => {
    expect(toCsv(['at'], [[new Date(at)]])).toBe(`at\n${at}`);
  });
});

describe('getClockHealth', () => {
  const vectorsOk = CLOCK_HEALTH_VECTORS.map((v) => new Date(v.expected));
  const dbNow = new Date('2026-11-27T03:00:00.000Z');

  function fakeDb(vectors: Date[], findings: unknown[] = []) {
    const calls: unknown[] = [];
    const db = {
      $queryRaw: jest.fn(async (q: unknown) => {
        calls.push(q);
        return calls.length === 1 ? [{ db_now: dbNow, v0: vectors[0], v1: vectors[1], v2: vectors[2] }] : findings;
      }),
    };
    return db;
  }

  it('ok when vectors agree, skew is small and there are no findings', async () => {
    let t = dbNow.getTime();
    const report = await getClockHealth(fakeDb(vectorsOk) as never, 't1', () => (t += 100));
    expect(report.status).toBe('ok');
    expect(report.db.now).toBe('2026-11-27T03:00:00.000Z');
    expect(report.db.skewMs).toBe(150);
    expect(report.vectors.every((v) => v.ok && v.app === v.expected)).toBe(true);
    expect(report.checkedAt).toMatch(/Z$/);
    expect(report.findings).toEqual([]);
  });

  it('CLOCK_TZDB_SKEW when the DB answers a recent rule differently', async () => {
    const stale = [...vectorsOk];
    stale[0] = new Date('2023-04-02T17:00:00.000Z'); // old Mexico DST rule
    const t = dbNow.getTime();
    const report = await getClockHealth(fakeDb(stale) as never, 't1', () => t);
    expect(report.status).toBe('error');
    expect(report.findings.map((f) => f.checkCode)).toContain('CLOCK_TZDB_SKEW');
  });

  it('CLOCK_DB_SKEW warning beyond the limit, and passes SQL findings through', async () => {
    const t = dbNow.getTime() + 10_000;
    const report = await getClockHealth(
      fakeDb(vectorsOk, [{ check_code: 'CLOCK_ZONE_MISSING', severity: 'warning', branch_id: 'b1', detail: { op: 'ledger' } }]) as never,
      't1',
      () => t,
    );
    expect(report.status).toBe('warning');
    expect(report.findings.map((f) => f.checkCode)).toEqual(['CLOCK_ZONE_MISSING', 'CLOCK_DB_SKEW']);
  });

  it('CLOCK_FAKE_ENV from SQL makes the report an error', async () => {
    const t = dbNow.getTime();
    const report = await getClockHealth(
      fakeDb(vectorsOk, [{ check_code: 'CLOCK_FAKE_ENV', severity: 'error', branch_id: null, detail: { reason: 'env' } }]) as never,
      't1',
      () => t,
    );
    expect(report.status).toBe('error');
  });
});
