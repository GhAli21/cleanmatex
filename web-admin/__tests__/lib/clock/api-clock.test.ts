/**
 * @jest-environment node
 */
/**
 * S6 (MASTER_PLAN_v2 §5.4, §6.3, §7.6; T46, T57): API time input, clock error responses,
 * the zone echo (D9) and typed local times in a DST gap/overlap.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const mockScreenBlock = jest.fn();
const mockPublicBlock = jest.fn();
jest.mock('@/lib/clock/clock-block.server', () => ({
  getScreenClockBlock: (...a: unknown[]) => mockScreenBlock(...a),
  getPublicClockBlock: (...a: unknown[]) => mockPublicBlock(...a),
}));

import { ClockError } from '@cmx/clock';
import {
  isCivilDateText,
  isInstantText,
  leadingCivilDate,
  zCivilDate,
  zCivilOrInstantDate,
  zInstant,
  zInstantDate,
} from '@/lib/clock/api-input';
import {
  assertZoneEcho,
  clockErrorResponse,
  publicScreenClock,
  resolveZonedInput,
  screenClock,
} from '@/lib/clock/api-clock.server';

describe('api-input', () => {
  it('instants need an offset; civil dates must exist', () => {
    expect(zInstant.safeParse('2026-03-01T10:00:00Z').success).toBe(true);
    expect(zInstant.safeParse('2026-03-01T10:00:00+04:00').success).toBe(true);
    const bare = zInstant.safeParse('2026-03-01T10:00:00');
    expect(bare.success).toBe(false);
    expect(bare.error?.issues[0].message).toBe('INSTANT_OFFSET_REQUIRED');
    expect(zCivilDate.safeParse('2027-02-29').success).toBe(false);
    expect(isCivilDateText('2028-02-29')).toBe(true);
    expect(isInstantText('2026-03-01')).toBe(false);
  });

  it('leadingCivilDate keeps the day of a date or instant and refuses impossible days', () => {
    expect(leadingCivilDate('2026-03-01')).toBe('2026-03-01');
    expect(leadingCivilDate('2026-03-01T23:00:00Z')).toBe('2026-03-01');
    expect(leadingCivilDate('2026-02-30')).toBeNull();
    expect(leadingCivilDate('')).toBeNull();
  });

  it('date fields: civil day = UTC midnight, instant with offset, Date passes, wall time refused', () => {
    expect(zCivilOrInstantDate.parse('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(zCivilOrInstantDate.parse('2026-03-01T10:00:00+04:00').toISOString()).toBe('2026-03-01T06:00:00.000Z');
    const d = new Date(Date.UTC(2026, 2, 1, 6));
    expect(zCivilOrInstantDate.parse(d)).toBe(d);
    expect(zCivilOrInstantDate.safeParse('2026-03-01T10:00').success).toBe(false);
    expect(zInstantDate.safeParse('2026-03-01').success).toBe(false);
    expect(zInstantDate.parse('2026-03-01T06:00:00Z').toISOString()).toBe('2026-03-01T06:00:00.000Z');
  });
});

describe('clockErrorResponse', () => {
  it('maps codes to HTTP status with the i18n key', async () => {
    const mismatch = clockErrorResponse(new ClockError('ZONE_MISMATCH', { clientZone: 'Asia/Dubai' }));
    expect(mismatch?.status).toBe(409);
    expect(await mismatch?.json()).toMatchObject({
      success: false,
      code: 'ZONE_MISMATCH',
      messageKey: 'clock.errors.zoneMismatch',
      details: { clientZone: 'Asia/Dubai' },
    });
    expect(clockErrorResponse(new ClockError('LOCAL_TIME_AMBIGUOUS'))?.status).toBe(422);
    expect(clockErrorResponse(new ClockError('INSTANT_OFFSET_REQUIRED'))?.status).toBe(400);
  });

  it('internal codes carry no details; other errors are not handled', async () => {
    const internal = clockErrorResponse(new ClockError('CLOCK_UNKNOWN_OPERATION', { op: 'x' }));
    expect(internal?.status).toBe(500);
    expect(await internal?.json()).not.toHaveProperty('details');
    expect(clockErrorResponse(new Error('boom'))).toBeNull();
  });
});

describe('zone echo and typed local times (D9, T46)', () => {
  const NY = 'America/New_York';

  it('a different client zone is ZONE_MISMATCH; no server zone is TIMEZONE_NOT_CONFIGURED', () => {
    expect(() => assertZoneEcho('Asia/Dubai', 'Asia/Muscat')).toThrow('ZONE_MISMATCH');
    expect(() => assertZoneEcho(undefined, null)).toThrow('TIMEZONE_NOT_CONFIGURED');
    expect(assertZoneEcho(undefined, 'Asia/Muscat')).toBe('Asia/Muscat');
    expect(assertZoneEcho('Asia/Muscat', 'Asia/Muscat')).toBe('Asia/Muscat');
  });

  it('gap is LOCAL_TIME_NONEXISTENT, overlap is LOCAL_TIME_AMBIGUOUS until earlier/later is chosen', () => {
    expect(() => resolveZonedInput({ date: '2026-03-08', time: '02:30' }, NY)).toThrow('LOCAL_TIME_NONEXISTENT');
    expect(() => resolveZonedInput({ date: '2026-11-01', time: '01:30', zone: NY }, NY)).toThrow('LOCAL_TIME_AMBIGUOUS');
    expect(resolveZonedInput({ date: '2026-11-01', time: '01:30', disambiguation: 'earlier' }, NY).toISOString())
      .toBe('2026-11-01T05:30:00.000Z');
    expect(resolveZonedInput({ date: '2026-11-01', time: '01:30', disambiguation: 'later' }, NY).toISOString())
      .toBe('2026-11-01T06:30:00.000Z');
    expect(() => resolveZonedInput({ date: '2026-11-01', time: '01:30', zone: 'Asia/Muscat' }, NY)).toThrow('ZONE_MISMATCH');
  });
});

describe('screenClock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes operation and branch, defaults to accept_order and organization scope', async () => {
    mockScreenBlock.mockResolvedValueOnce({ zone: 'Asia/Muscat' });
    await expect(screenClock('t1', { operation: 'ready_by', branchId: 'b1' })).resolves.toEqual({ zone: 'Asia/Muscat' });
    expect(mockScreenBlock).toHaveBeenCalledWith({ tenantOrgId: 't1', operation: 'ready_by', branchId: 'b1' });
    mockPublicBlock.mockResolvedValueOnce({ zone: null });
    await publicScreenClock('t1');
    expect(mockPublicBlock).toHaveBeenCalledWith({ tenantOrgId: 't1', operation: 'accept_order', branchId: null });
  });

  it('a failure gives null (the screen shows no clock) instead of failing the response', async () => {
    mockScreenBlock.mockRejectedValueOnce(new Error('db down'));
    await expect(screenClock('t1')).resolves.toBeNull();
  });
});
