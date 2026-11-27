/**
 * @jest-environment node
 */
/**
 * S3: the screen `clock` block is built from fn_cmx_dt_zone + fn_cmx_dt_settings (0842/0843).
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }));

import { fixedClock } from '@cmx/clock';
import { getScreenClockBlockOn } from '@/lib/clock/clock-block.server';

function db(rows: unknown[]) {
  return { $queryRaw: jest.fn(async () => rows) } as unknown as Parameters<typeof getScreenClockBlockOn>[0];
}

const row = { zone: 'Asia/Muscat', hour_cycle: 'H12', week_start: 6, cutover: '03:00', date_format: 'DD/MM/YYYY' };

describe('getScreenClockBlockOn', () => {
  it('maps the SQL settings to the block (hour cycle, ISO week start, business date after cut-over)', async () => {
    const block = await getScreenClockBlockOn(db([row]), {
      tenantOrgId: '00000000-0000-0000-0000-00000000000a',
      operation: 'ready_by',
      branchId: null,
      // 22:30Z on 26 Nov = 02:30 on 27 Nov in Muscat, before the 03:00 cut-over → business date 26 Nov.
      clock: fixedClock('2026-11-26T22:30:00Z'),
    });
    expect(block).toMatchObject({
      zone: 'Asia/Muscat',
      hourCycle: 'h12',
      weekStart: 6,
      dateFormat: 'DD/MM/YYYY',
      businessDate: '2026-11-26',
      serverNow: '2026-11-26T22:30:00.000Z',
    });
  });

  it('Sunday (0) becomes ISO 7; a missing zone gives zone and businessDate null', async () => {
    const block = await getScreenClockBlockOn(db([{ ...row, zone: null, week_start: 0, hour_cycle: 'H23' }]), {
      tenantOrgId: '00000000-0000-0000-0000-00000000000a',
      operation: 'accept_order',
      branchId: '00000000-0000-0000-0000-0000000000b1',
      clock: fixedClock('2026-11-26T22:30:00Z'),
    });
    expect(block).toMatchObject({ zone: null, businessDate: null, weekStart: 7, hourCycle: 'h23' });
  });

  it('returns null when the organization does not exist', async () => {
    await expect(
      getScreenClockBlockOn(db([]), { tenantOrgId: '00000000-0000-0000-0000-00000000000a', operation: 'ready_by', branchId: null }),
    ).resolves.toBeNull();
  });

  it('rejects an unknown date format and an unknown operation', async () => {
    await expect(
      getScreenClockBlockOn(db([{ ...row, date_format: 'YY.MM.DD' }]), {
        tenantOrgId: '00000000-0000-0000-0000-00000000000a',
        operation: 'ready_by',
        branchId: null,
      }),
    ).rejects.toMatchObject({ code: 'CLOCK_SETTING_INVALID' });
    await expect(
      getScreenClockBlockOn(db([row]), {
        tenantOrgId: '00000000-0000-0000-0000-00000000000a',
        operation: 'payroll' as never,
        branchId: null,
      }),
    ).rejects.toMatchObject({ code: 'CLOCK_SETTING_INVALID' });
  });
});
