'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxSelect, CmxSkeleton } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation/cmx-tabs-panel';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { BRANCHES_PERMISSIONS } from '@/lib/constants/permissions/branches-perm';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { branchCalendarSchema, organizationCalendarSchema } from '@/lib/validations/business-calendar-schemas';
import { saveBranchCalendar, saveOrganizationCalendar } from '../api/business-calendar-api';
import { useBranchCalendar, useCalendarBranches, useOrganizationCalendar, useRefreshBusinessCalendar } from '../hooks/use-business-calendar';
import { CalendarHolidaysTab } from './calendar-holidays-tab';
import { CalendarHoursForm, type CalendarValues } from './calendar-hours-form';

const TAB_IDS = ['organization', 'branches', 'holidays'];

const Loading = () => (
  <div className="space-y-3">
    <CmxSkeleton className="h-10 w-full" />
    <CmxSkeleton className="h-64 w-full" />
  </div>
);

/** The organization's own calendar. */
function OrganizationTab({ canSave }: { canSave: boolean }) {
  const t = useTranslations('settings.calendar');
  const query = useOrganizationCalendar();
  const refresh = useRefreshBusinessCalendar();
  const { token: csrfToken } = useCSRFToken();
  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) return <CmxSummaryMessage type="error" title={t('errors.loadFailed')} items={[]} />;
  const save = async (values: CalendarValues) => {
    await saveOrganizationCalendar(organizationCalendarSchema.parse(values), csrfToken);
    await refresh();
  };
  return (
    <div className="space-y-3">
      {query.data.timezone ? <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('timezone', { timezone: query.data.timezone })}</p> : null}
      <CalendarHoursForm key={query.dataUpdatedAt} idPrefix="org" initial={query.data} canSave={canSave} onSave={save} />
    </div>
  );
}

/** One branch's calendar; `?branch=` opens it directly from Branch settings. */
function BranchTab({ canSave, branchOptions, branchId, onBranchChange }: {
  canSave: boolean;
  branchOptions: { value: string; label: string }[];
  branchId: string;
  onBranchChange: (id: string) => void;
}) {
  const t = useTranslations('settings.calendar');
  const query = useBranchCalendar(branchId);
  const refresh = useRefreshBusinessCalendar();
  const { token: csrfToken } = useCSRFToken();
  const save = async (values: CalendarValues) => {
    await saveBranchCalendar(branchId, branchCalendarSchema.parse(values), csrfToken);
    await refresh();
  };
  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <CmxSelect label={t('branch.select')} placeholder={t('branch.choose')} options={branchOptions} value={branchId} onChange={(e) => onBranchChange(e.target.value)} />
      </div>
      {!branchId ? <CmxEmptyState title={t('branch.emptyTitle')} description={t('branch.emptyDescription')} /> : null}
      {branchId && query.isLoading ? <Loading /> : null}
      {branchId && query.isError ? <CmxSummaryMessage type="error" title={t('errors.loadFailed')} items={[]} /> : null}
      {branchId && query.data ? (
        <CalendarHoursForm key={`${branchId}-${query.dataUpdatedAt}`} idPrefix="branch" initial={query.data} organization={query.data.organization} canSave={canSave} onSave={save} />
      ) : null}
    </div>
  );
}

/**
 * Business Calendar (`/dashboard/settings/calendar`): opening hours, cut-off and
 * ready time for the organization and each branch, and holidays. The tab and
 * branch live in the URL, so Branch settings can link straight to a branch.
 * Saving is enforced again by the API.
 * @returns the screen
 */
export function BusinessCalendarScreen() {
  const t = useTranslations('settings.calendar');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEditOrganization = useHasPermissionCode(SETTINGS_PERMISSIONS.ORGANIZATION);
  const canEditBranch = useHasPermissionCode(BRANCHES_PERMISSIONS.SETTINGS);
  const branches = useCalendarBranches();

  const setParams = useCallback((patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const tabParam = searchParams.get('tab') ?? '';
  const branchId = searchParams.get('branch') ?? '';
  const active = TAB_IDS.includes(tabParam) ? tabParam : branchId ? 'branches' : 'organization';

  const tabs: CmxTabItem[] = [
    { id: 'organization', label: t('tabs.organization'), content: <OrganizationTab canSave={canEditOrganization} /> },
    {
      id: 'branches',
      label: t('tabs.branches'),
      content: <BranchTab canSave={canEditBranch} branchOptions={branches.options} branchId={branchId} onBranchChange={(id) => setParams({ tab: 'branches', branch: id })} />,
    },
    { id: 'holidays', label: t('tabs.holidays'), content: <CalendarHolidaysTab canManage={canEditOrganization} branchOptions={branches.options} /> },
  ];

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('subtitle')}</p>
      </div>
      <CmxTabsPanel tabs={tabs} value={active} onChange={(tab) => setParams({ tab })} />
    </div>
  );
}
