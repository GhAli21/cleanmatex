import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type {
  BranchCalendarView,
  HolidayView,
  OrganizationCalendarView,
  PublicHolidayView,
  ReadyPreview,
} from '@/lib/services/settings/business-calendar.service';
import type { BranchCalendarInput, HolidayInput, OrganizationCalendarInput } from '@/lib/validations/business-calendar-schemas';

/** A refused calendar request; `code` selects the message (`settings.calendar.errors.<code>`). */
export class BusinessCalendarApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/** What `GET /settings/holidays` returns for one year. */
export interface HolidayListData {
  holidays: HolidayView[];
  publicHolidays: PublicHolidayView[];
  country: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  const body = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code?: string } } | null;
  // Permission guards answer in their own envelope: map the status so the user sees the real reason.
  const byStatus = response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR';
  if (!response.ok || !body?.success) throw new BusinessCalendarApiError(typeof body?.error?.code === 'string' ? body.error.code : byStatus);
  return body.data as T;
}

const send = <T>(url: string, method: string, csrfToken: string | null, payload?: unknown) =>
  request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

/** @param signal - cancels a superseded request */
export const fetchOrganizationCalendar = (signal?: AbortSignal) =>
  request<OrganizationCalendarView>('/api/v1/settings/calendar', { signal });

/**
 * Saves the organization's calendar.
 * @param input - hours, cut-off and ready time
 * @param csrfToken - CSRF token
 */
export const saveOrganizationCalendar = (input: OrganizationCalendarInput, csrfToken: string | null) =>
  send<OrganizationCalendarView>('/api/v1/settings/calendar', 'PUT', csrfToken, input);

/**
 * @param branchId - the branch
 * @param signal - cancels a superseded request
 */
export const fetchBranchCalendar = (branchId: string, signal?: AbortSignal) =>
  request<BranchCalendarView>(`/api/v1/settings/branches/${branchId}/calendar`, { signal });

/**
 * Saves a branch calendar; a null field follows the organization.
 * @param branchId - the branch
 * @param input - hours, cut-off and ready time
 * @param csrfToken - CSRF token
 */
export const saveBranchCalendar = (branchId: string, input: BranchCalendarInput, csrfToken: string | null) =>
  send<BranchCalendarView>(`/api/v1/settings/branches/${branchId}/calendar`, 'PUT', csrfToken, input);

/**
 * "An order placed now": ready time per speed from the saved calendar.
 * @param branchId - a branch, or undefined for the organization
 * @param signal - cancels a superseded request
 */
export const fetchReadyPreview = (branchId: string | undefined, signal?: AbortSignal) =>
  request<ReadyPreview>(`/api/v1/settings/calendar/preview${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`, { signal });

/**
 * One year's holidays.
 * @param year - calendar year
 * @param branchId - limits the list to this branch and organization-wide rows
 * @param signal - cancels a superseded request
 */
export const fetchHolidays = (year: number, branchId: string | undefined, signal?: AbortSignal) => {
  const query = new URLSearchParams({ year: String(year) });
  if (branchId) query.set('branchId', branchId);
  return request<HolidayListData>(`/api/v1/settings/holidays?${query.toString()}`, { signal });
};

/**
 * Adds a holiday.
 * @param input - the holiday
 * @param csrfToken - CSRF token
 */
export const createHolidayApi = (input: HolidayInput, csrfToken: string | null) =>
  send<HolidayView>('/api/v1/settings/holidays', 'POST', csrfToken, input);

/**
 * Replaces a holiday.
 * @param id - holiday id
 * @param input - the holiday as it should be
 * @param csrfToken - CSRF token
 */
export const updateHolidayApi = (id: string, input: HolidayInput, csrfToken: string | null) =>
  send<HolidayView>(`/api/v1/settings/holidays/${id}`, 'PATCH', csrfToken, input);

/**
 * Deletes a holiday.
 * @param id - holiday id
 * @param csrfToken - CSRF token
 */
export const deleteHolidayApi = (id: string, csrfToken: string | null) =>
  send<unknown>(`/api/v1/settings/holidays/${id}`, 'DELETE', csrfToken);
