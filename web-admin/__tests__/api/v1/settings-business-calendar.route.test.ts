/** @jest-environment node */

/**
 * Service Speeds S3: Business Calendar routes. Each one checks its own
 * permission and passes the session tenant; writes check CSRF first; bad hours
 * answer CALENDAR_INVALID_HOURS; refusals keep their code with a message key.
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));

const service = {
  getOrganizationCalendar: jest.fn(),
  updateOrganizationCalendar: jest.fn(),
  getBranchCalendar: jest.fn(),
  updateBranchCalendar: jest.fn(),
  listHolidays: jest.fn(),
  createHoliday: jest.fn(),
  updateHoliday: jest.fn(),
  deleteHoliday: jest.fn(),
  previewReadyTimes: jest.fn(),
};
const checked: string[] = [];
let allowed = true;
let csrfBlocked = false;

jest.mock('@/lib/services/settings/business-calendar.service', () => {
  class BusinessCalendarError extends Error {
    constructor(public code: string, public status: number) { super(code); }
  }
  return {
    BusinessCalendarError,
    // Names listed (jest hoists this factory above `service`), each calling it lazily.
    ...Object.fromEntries(['getOrganizationCalendar', 'updateOrganizationCalendar', 'getBranchCalendar', 'updateBranchCalendar',
      'listHolidays', 'createHoliday', 'updateHoliday', 'deleteHoliday', 'previewReadyTimes']
      .map((k) => [k, (...a: unknown[]) => service[k as keyof typeof service](...a)])),
  };
});
jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: async () => (csrfBlocked ? NextResponse.json({}, { status: 403 }) : null),
}));
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (code: string) => async () => {
    checked.push(code);
    return allowed ? { tenantId: 'tenant-1', userId: 'u1' } : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));

import { BusinessCalendarError } from '@/lib/services/settings/business-calendar.service';
import { GET as calGET, PUT as calPUT } from '@/app/api/v1/settings/calendar/route';
import { GET as previewGET } from '@/app/api/v1/settings/calendar/preview/route';
import { GET as branchGET, PUT as branchPUT } from '@/app/api/v1/settings/branches/[id]/calendar/route';
import { GET as holGET, POST as holPOST } from '@/app/api/v1/settings/holidays/route';
import { DELETE as holDELETE, PATCH as holPATCH } from '@/app/api/v1/settings/holidays/[id]/route';

const ID = '22222222-2222-4222-8222-222222222222';
const open = { open: '08:00', close: '20:00' };
const week = { sun: open, mon: open, tue: open, wed: open, thu: open, fri: null, sat: null };
const calendar = { businessHours: week, cutoffTime: '11:00', readyTime: '18:00' };
const holiday = { branchId: null, holidayDate: '2027-01-02', name: 'Closed', isClosed: true };
const req = (path: string, method = 'GET', body?: unknown) =>
  new NextRequest(new URL(path, 'http://localhost'), { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  Object.values(service).forEach((m) => m.mockReset());
  checked.length = 0;
  allowed = true;
  csrfBlocked = false;
});

describe('Business Calendar routes', () => {
  it('organization calendar: read with settings:read, save with settings:organization and the session tenant', async () => {
    service.getOrganizationCalendar.mockResolvedValue(calendar);
    expect((await calGET(req('/api/v1/settings/calendar'))).status).toBe(200);
    service.updateOrganizationCalendar.mockResolvedValue(calendar);
    expect((await calPUT(req('/api/v1/settings/calendar', 'PUT', calendar))).status).toBe(200);
    expect(checked).toEqual(['settings:read', 'settings:organization']);
    expect(service.updateOrganizationCalendar).toHaveBeenCalledWith('tenant-1', 'u1', calendar);
  });

  it('refuses bad hours (close before open, no open day) as CALENDAR_INVALID_HOURS, saving nothing', async () => {
    for (const businessHours of [{ ...week, sun: { open: '20:00', close: '08:00' } }, { sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null }]) {
      const res = await calPUT(req('/api/v1/settings/calendar', 'PUT', { ...calendar, businessHours }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: { code: 'CALENDAR_INVALID_HOURS', messageKey: 'settings.calendar.errors.CALENDAR_INVALID_HOURS' } });
    }
    expect(service.updateOrganizationCalendar).not.toHaveBeenCalled();
  });

  it('CSRF is checked before the permission', async () => {
    csrfBlocked = true;
    expect((await calPUT(req('/api/v1/settings/calendar', 'PUT', calendar))).status).toBe(403);
    expect(checked).toEqual([]);
  });

  it('branch calendar: branches:read / branches:settings; null fields mean the organization\'s', async () => {
    service.getBranchCalendar.mockResolvedValue({});
    expect((await branchGET(req(`/api/v1/settings/branches/${ID}/calendar`), params)).status).toBe(200);
    service.updateBranchCalendar.mockResolvedValue({});
    const inherit = { businessHours: null, cutoffTime: null, readyTime: '17:00' };
    expect((await branchPUT(req(`/api/v1/settings/branches/${ID}/calendar`, 'PUT', inherit), params)).status).toBe(200);
    expect(checked).toEqual(['branches:read', 'branches:settings']);
    expect(service.updateBranchCalendar).toHaveBeenCalledWith('tenant-1', 'u1', ID, inherit);
  });

  it('a branch of another organization is NOT_FOUND', async () => {
    service.getBranchCalendar.mockRejectedValue(new BusinessCalendarError('NOT_FOUND', 404));
    expect((await branchGET(req(`/api/v1/settings/branches/${ID}/calendar`), params)).status).toBe(404);
  });

  it('holidays: list needs a year; a closed day takes no hours; a duplicate date is 409', async () => {
    expect((await holGET(req('/api/v1/settings/holidays'))).status).toBe(400);
    service.listHolidays.mockResolvedValue({ holidays: [], publicHolidays: [], country: 'OM' });
    expect((await holGET(req('/api/v1/settings/holidays?year=2027'))).status).toBe(200);
    expect(service.listHolidays).toHaveBeenCalledWith('tenant-1', { year: 2027 });

    expect((await holPOST(req('/api/v1/settings/holidays', 'POST', { ...holiday, openTime: '10:00' }))).status).toBe(400);
    expect((await holPOST(req('/api/v1/settings/holidays', 'POST', { ...holiday, isClosed: false, openTime: '14:00', closeTime: '10:00' }))).status).toBe(400);
    service.createHoliday.mockRejectedValue(new BusinessCalendarError('HOLIDAY_DUPLICATE', 409));
    const dup = await holPOST(req('/api/v1/settings/holidays', 'POST', holiday));
    expect(dup.status).toBe(409);
    await expect(dup.json()).resolves.toMatchObject({ error: { code: 'HOLIDAY_DUPLICATE' } });
  });

  it('holiday edit and delete need settings:organization', async () => {
    service.updateHoliday.mockResolvedValue({ id: ID });
    expect((await holPATCH(req(`/api/v1/settings/holidays/${ID}`, 'PATCH', { ...holiday, isClosed: false, openTime: '10:00', closeTime: '14:00' }), params)).status).toBe(200);
    service.deleteHoliday.mockResolvedValue(undefined);
    expect((await holDELETE(req(`/api/v1/settings/holidays/${ID}`, 'DELETE'), params)).status).toBe(200);
    expect(checked).toEqual(['settings:organization', 'settings:organization']);
    expect(service.deleteHoliday).toHaveBeenCalledWith('tenant-1', ID);
  });

  it('a denied permission stops before the service', async () => {
    allowed = false;
    expect((await holDELETE(req(`/api/v1/settings/holidays/${ID}`, 'DELETE'), params)).status).toBe(403);
    expect(service.deleteHoliday).not.toHaveBeenCalled();
  });

  it('ready-time preview: settings:read for the organization, branches:read too for a branch, the session tenant, bad id 400', async () => {
    service.previewReadyTimes.mockResolvedValue({ configured: true, rows: [] });
    expect((await previewGET(req('/api/v1/settings/calendar/preview'))).status).toBe(200);
    expect(checked).toEqual(['settings:read']);
    expect(service.previewReadyTimes).toHaveBeenCalledWith('tenant-1', null);

    checked.length = 0;
    expect((await previewGET(req(`/api/v1/settings/calendar/preview?branchId=${ID}`))).status).toBe(200);
    expect(checked).toEqual(['settings:read', 'branches:read']);
    expect(service.previewReadyTimes).toHaveBeenLastCalledWith('tenant-1', ID);

    expect((await previewGET(req('/api/v1/settings/calendar/preview?branchId=nope'))).status).toBe(400);
  });

  it('a stale save answers 409 CALENDAR_CHANGED with its message key', async () => {
    service.updateOrganizationCalendar.mockRejectedValue(new BusinessCalendarError('CALENDAR_CHANGED', 409));
    const res = await calPUT(req('/api/v1/settings/calendar', 'PUT', { ...calendar, version: 'old' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: { code: 'CALENDAR_CHANGED', messageKey: 'settings.calendar.errors.CALENDAR_CHANGED' } });
  });
});
