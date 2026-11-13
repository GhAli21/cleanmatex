/** @jest-environment node */

/**
 * Service Speeds S3: Business Calendar service. Every org_* query carries the
 * tenant (org_tenants_mst by its own id); a branch of another organization is
 * refused; a duplicate date is refused before save and on a race; a branch
 * field set to null clears it (the organization's value applies).
 */
jest.mock('server-only', () => ({}));

const calls: { model: string; op: string; args: Record<string, unknown> }[] = [];
const fixtures: Record<string, unknown> = {};
const model = (name: string) => new Proxy({}, {
  get: (_t, op: string) => jest.fn(async (args: Record<string, unknown>) => {
    calls.push({ model: name, op, args });
    const value = fixtures[`${name}.${op}`];
    if (value instanceof Error) throw value;
    return value ?? (op === 'findMany' ? [] : op.endsWith('Many') ? { count: 1 } : null);
  }),
});

jest.mock('@/lib/db/prisma', () => ({
  prisma: new Proxy({}, { get: (_t, name: string) => model(name) }),
}));

import { Prisma } from '@prisma/client';
import {
  createHoliday,
  deleteHoliday,
  getBranchCalendar,
  getOrganizationCalendar,
  listHolidays,
  previewReadyTimes,
  updateBranchCalendar,
  updateOrganizationCalendar,
} from '@/lib/services/settings/business-calendar.service';

const TENANT = 'tenant-1';
const BRANCH = '22222222-2222-4222-8222-222222222222';
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const open = { open: '08:00', close: '20:00' };
const week = { sun: open, mon: open, tue: open, wed: open, thu: open, fri: null, sat: null };
const tenantRow = { timezone: 'Asia/Muscat', country: 'OM', calendar_template_code: 'OM', business_hours: week, order_cutoff_time: time('11:00'), ready_time: time('18:00') };

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
  fixtures['org_tenants_mst.findFirst'] = tenantRow;
});

const expectTenantFiltered = () => {
  for (const c of calls.filter((x) => x.model.startsWith('org_'))) {
    const where = c.args.where as Record<string, unknown>;
    if (c.model === 'org_tenants_mst') expect(where.id).toBe(TENANT);
    else expect(where?.tenant_org_id ?? (c.args.data as Record<string, unknown>)?.tenant_org_id).toBe(TENANT);
  }
};

describe('business-calendar.service', () => {
  it('saves the organization calendar on its own row with audit fields', async () => {
    const view = await updateOrganizationCalendar(TENANT, 'u1', { businessHours: week, cutoffTime: '11:00', readyTime: '18:00' });
    const update = calls.find((c) => c.op === 'updateMany')!;
    expect(update.args.data).toMatchObject({ order_cutoff_time: time('11:00'), ready_time: time('18:00'), updated_by: 'u1' });
    expect(view).toMatchObject({ cutoffTime: '11:00', readyTime: '18:00', businessHours: { fri: null, sun: open } });
    expectTenantFiltered();
  });

  it('a branch value of null clears it, so the organization value applies', async () => {
    fixtures['org_branches_mst.findFirst'] = { id: BRANCH, name: 'B', name2: null, timezone_code: null, business_hours: null, order_cutoff_time: null, ready_time: null };
    const view = await updateBranchCalendar(TENANT, 'u1', BRANCH, { businessHours: null, cutoffTime: null, readyTime: '17:00' });
    expect(calls.find((c) => c.op === 'updateMany')!.args.data).toMatchObject({ business_hours: Prisma.DbNull, order_cutoff_time: null });
    expect(view.organization.cutoffTime).toBe('11:00');
    expectTenantFiltered();
  });

  it('a branch of another organization is NOT_FOUND', async () => {
    await expect(getBranchCalendar(TENANT, BRANCH)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    fixtures['org_branches_mst.updateMany'] = { count: 0 };
    await expect(updateBranchCalendar(TENANT, 'u1', BRANCH, { businessHours: null, cutoffTime: null, readyTime: null }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists the year\'s own and public holidays for the organization\'s country', async () => {
    fixtures['sys_public_holidays_cf.findMany'] = [{ holiday_date: new Date('2027-11-20T00:00:00Z'), holiday_code: 'NATIONAL_DAY', name: 'National Day', name2: null, is_estimated: true }];
    const out = await listHolidays(TENANT, { year: 2027 });
    expect(out.country).toBe('OM');
    expect(out.publicHolidays[0]).toMatchObject({ holidayDate: '2027-11-20', isEstimated: true });
    const pub = calls.find((c) => c.model === 'sys_public_holidays_cf')!;
    expect(pub.args.where).toMatchObject({ country_code: 'OM' });
    expectTenantFiltered();
  });

  it('refuses a holiday for a branch of another organization, and a taken date', async () => {
    const h = { branchId: BRANCH, holidayDate: '2027-01-02', name: 'Closed', isClosed: true };
    await expect(createHoliday(TENANT, 'u1', h)).rejects.toMatchObject({ code: 'INVALID_REFERENCE', status: 422 });
    fixtures['org_branches_mst.findFirst'] = { id: BRANCH };
    fixtures['org_holidays_cf.findFirst'] = { id: 'other' };
    await expect(createHoliday(TENANT, 'u1', h)).rejects.toMatchObject({ code: 'HOLIDAY_DUPLICATE', status: 409 });
    expect(calls.some((c) => c.op === 'create')).toBe(false);
    expectTenantFiltered();
  });

  it('a race past the check becomes HOLIDAY_DUPLICATE; an open day stores its hours', async () => {
    fixtures['org_holidays_cf.create'] = Object.assign(new Error('unique'), { code: 'P2002' });
    await expect(createHoliday(TENANT, 'u1', { branchId: null, holidayDate: '2027-01-02', name: 'X', isClosed: false, openTime: '10:00', closeTime: '14:00' }))
      .rejects.toMatchObject({ code: 'HOLIDAY_DUPLICATE' });
    expect(calls.find((c) => c.op === 'create')!.args.data).toMatchObject({
      tenant_org_id: TENANT, is_closed: false, open_time: time('10:00'), close_time: time('14:00'), created_by: 'u1',
    });
  });

  it('deleting a holiday of another organization is NOT_FOUND', async () => {
    fixtures['org_holidays_cf.deleteMany'] = { count: 0 };
    await expect(deleteHoliday(TENANT, 'h1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expectTenantFiltered();
  });

  describe('concurrent edits (review E7)', () => {
    it('a save made on an older version is refused and writes nothing', async () => {
      const stored = await getOrganizationCalendar(TENANT);
      fixtures['org_tenants_mst.findFirst'] = { ...tenantRow, ready_time: time('17:00') }; // someone saved meanwhile
      calls.length = 0;
      await expect(updateOrganizationCalendar(TENANT, 'u1', { businessHours: week, cutoffTime: '11:00', readyTime: '18:00', version: stored.version }))
        .rejects.toMatchObject({ code: 'CALENDAR_CHANGED', status: 409 });
      expect(calls.some((c) => c.op === 'updateMany')).toBe(false);
    });

    it('a save on the current version only matches the row it read (timestamp compare-and-swap)', async () => {
      const updatedAt = new Date('2026-11-13T10:00:00Z');
      fixtures['org_tenants_mst.findFirst'] = { ...tenantRow, updated_at: updatedAt };
      const { version } = await getOrganizationCalendar(TENANT);
      await updateOrganizationCalendar(TENANT, 'u1', { businessHours: week, cutoffTime: '11:00', readyTime: '19:00', version });
      expect(calls.find((c) => c.op === 'updateMany')!.args.where).toEqual({ id: TENANT, updated_at: updatedAt });
    });

    it('a write that lost the race (no row matched) is CALENDAR_CHANGED, not NOT_FOUND', async () => {
      const { version } = await getOrganizationCalendar(TENANT);
      fixtures['org_tenants_mst.updateMany'] = { count: 0 };
      await expect(updateOrganizationCalendar(TENANT, 'u1', { businessHours: week, cutoffTime: '11:00', readyTime: '18:00', version }))
        .rejects.toMatchObject({ code: 'CALENDAR_CHANGED' });
    });

    it('a branch save is checked the same way', async () => {
      fixtures['org_branches_mst.findFirst'] = { id: BRANCH, name: 'B', name2: null, timezone_code: null, business_hours: null, order_cutoff_time: null, ready_time: time('17:00'), updated_at: null };
      await expect(updateBranchCalendar(TENANT, 'u1', BRANCH, { businessHours: null, cutoffTime: null, readyTime: null, version: 'stale-version' }))
        .rejects.toMatchObject({ code: 'CALENDAR_CHANGED', status: 409 });
    });
  });

  describe('country template (review E2)', () => {
    it('offers the organization\'s own template, else its country\'s, else GENERIC', async () => {
      const row = (calendar_code: string, country_code: string | null) => ({
        calendar_code, country_code, name: calendar_code, name2: null, business_hours: week, order_cutoff_time: time('11:00'), ready_time: time('18:00'),
      });
      fixtures['sys_calendar_templates_mst.findMany'] = [row('GENERIC', null), row('SA', 'SA'), row('OM', 'OM')];
      expect((await getOrganizationCalendar(TENANT)).template).toMatchObject({ code: 'OM', cutoffTime: '11:00' });
      fixtures['org_tenants_mst.findFirst'] = { ...tenantRow, calendar_template_code: null, country: 'sa' };
      expect((await getOrganizationCalendar(TENANT)).template?.code).toBe('SA');
      fixtures['org_tenants_mst.findFirst'] = { ...tenantRow, calendar_template_code: null, country: 'XX' };
      expect((await getOrganizationCalendar(TENANT)).template?.code).toBe('GENERIC');
    });
  });

  describe('previewReadyTimes (review E1)', () => {
    const speed = (code: string) => ({ code, name: code, name2: null });
    const rule = (service_speed: string, over: Record<string, unknown> = {}) => ({
      service_speed, branch_id: null, effective_from: new Date('2026-01-01T00:00:00Z'),
      turnaround_hh_speed: null, turnaround_unit: null, turnaround_days_speed: null, cutoff_time_speed: null, ...over,
    });
    // Sunday 2026-11-08 09:00 in Muscat (UTC+4), before the 11:00 cut-off.
    const NOW = new Date('2026-11-08T05:00:00Z');

    it('promises each offered speed with the same engine as order entry', async () => {
      fixtures['sys_service_speed_cd.findMany'] = [speed('ECONOMY'), speed('STANDARD'), speed('NEXT_DAY'), speed('EXPRESS')];
      fixtures['org_speed_price_rules_cf.findMany'] = [
        rule('NEXT_DAY', { turnaround_unit: 'WORKING_DAYS', turnaround_days_speed: 1 }),
        rule('EXPRESS', { turnaround_unit: 'HOURS', turnaround_hh_speed: { toString: () => '6.00' } }),
      ];
      const out = await previewReadyTimes(TENANT, null, NOW);
      expect(out).toMatchObject({ configured: true, timezone: 'Asia/Muscat', openNow: true });
      // ECONOMY has no organization-wide rule: not offered, not listed.
      expect(out.rows.map((r) => [r.speed, r.source, r.unit, r.amount, r.readyByAt])).toEqual([
        ['STANDARD', 'EXAMPLE', 'HOURS', 24, '2026-11-10T05:00:00.000Z'], // Sun 11 h + Mon 12 h + Tue 1 h = Tue 09:00
        ['NEXT_DAY', 'SPEED_RULE', 'WORKING_DAYS', 1, '2026-11-09T14:00:00.000Z'], // Mon at the 18:00 ready time
        ['EXPRESS', 'SPEED_RULE', 'HOURS', 6, '2026-11-08T11:00:00.000Z'], // Sun 15:00
      ]);
      expectTenantFiltered();
    });

    it('reads only organization-wide rules in force today, for the organization or this branch', async () => {
      fixtures['org_branches_mst.findFirst'] = { timezone_code: null, country: null, business_hours: null, order_cutoff_time: null, ready_time: null };
      await previewReadyTimes(TENANT, BRANCH, NOW);
      const where = calls.find((c) => c.model === 'org_speed_price_rules_cf')!.args.where as Record<string, unknown>;
      expect(where).toMatchObject({ tenant_org_id: TENANT, is_active: true, rec_status: 1, product_id: null, service_category_code: null });
      expect(JSON.stringify(where)).toContain(BRANCH);
      expectTenantFiltered();
    });

    it('says "not configured" without business hours, and refuses a branch of another organization', async () => {
      fixtures['org_tenants_mst.findFirst'] = { ...tenantRow, business_hours: null };
      expect(await previewReadyTimes(TENANT, null, NOW)).toMatchObject({ configured: false, rows: [] });
      fixtures['org_tenants_mst.findFirst'] = tenantRow;
      await expect(previewReadyTimes(TENANT, BRANCH, NOW)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });
  });
});
