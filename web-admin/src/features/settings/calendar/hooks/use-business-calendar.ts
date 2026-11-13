'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchSpeedRuleBranches } from '@features/catalog/api/speed-rules-api';
import { fetchBranchCalendar, fetchHolidays, fetchOrganizationCalendar, fetchReadyPreview } from '../api/business-calendar-api';

/** Every Business Calendar query carries the session organization. */
const calendarKey = (tenantId: string | undefined, ...rest: unknown[]) => ['business-calendar', tenantId, ...rest];

/**
 * @param enabled - false skips the read (a caller without `settings:read` would only get a 403)
 * @returns the organization's calendar
 */
export function useOrganizationCalendar(enabled = true) {
  const tenantId = useAuth().currentTenant?.tenant_id;
  return useQuery({
    queryKey: calendarKey(tenantId, 'organization'),
    queryFn: ({ signal }) => fetchOrganizationCalendar(signal),
    enabled: !!tenantId && enabled,
  });
}

/**
 * @param branchId - the selected branch; no read until one is chosen
 * @returns the branch calendar with the organization's values
 */
export function useBranchCalendar(branchId: string) {
  const tenantId = useAuth().currentTenant?.tenant_id;
  return useQuery({
    queryKey: calendarKey(tenantId, 'branch', branchId),
    queryFn: ({ signal }) => fetchBranchCalendar(branchId, signal),
    enabled: !!tenantId && !!branchId,
  });
}

/**
 * Ready times for an order placed now (saved settings); refreshed after every save.
 * @param branchId - a branch, or '' for the organization
 * @returns the preview
 */
export function useReadyPreview(branchId: string) {
  const tenantId = useAuth().currentTenant?.tenant_id;
  return useQuery({
    queryKey: calendarKey(tenantId, 'preview', branchId || null),
    queryFn: ({ signal }) => fetchReadyPreview(branchId || undefined, signal),
    enabled: !!tenantId,
    // "Now" moves: a minute-old answer is stale, and a refresh on mount keeps the card honest.
    staleTime: 60_000,
  });
}

/**
 * @param year - calendar year
 * @param branchId - optional branch filter
 * @returns the year's own and public holidays
 */
export function useHolidays(year: number, branchId?: string) {
  const tenantId = useAuth().currentTenant?.tenant_id;
  return useQuery({
    queryKey: calendarKey(tenantId, 'holidays', year, branchId ?? null),
    queryFn: ({ signal }) => fetchHolidays(year, branchId, signal),
    enabled: !!tenantId,
  });
}

/** @returns the organization's branches as `{ value, label }` */
export function useCalendarBranches() {
  const tenantId = useAuth().currentTenant?.tenant_id;
  const locale = useLocale();
  const query = useQuery({
    queryKey: calendarKey(tenantId, 'branches'),
    queryFn: ({ signal }) => fetchSpeedRuleBranches(signal),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
  const options = useMemo(
    () => (query.data ?? []).map((b) => {
      const en = b.branch_name ?? b.name;
      const ar = b.branch_name2 ?? b.name2;
      return { value: b.id, label: (locale === 'ar' ? ar || en : en || ar) ?? b.id };
    }),
    [query.data, locale],
  );
  return { options, isLoading: query.isLoading, isError: query.isError };
}

/** @returns a function that re-reads everything on this screen after a save */
export function useRefreshBusinessCalendar() {
  const tenantId = useAuth().currentTenant?.tenant_id;
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: calendarKey(tenantId) });
}
