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
  listHolidays,
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
});
