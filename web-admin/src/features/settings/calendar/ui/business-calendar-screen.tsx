'use client';

import { useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CmxSelect, CmxSkeleton } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation/cmx-tabs-panel';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { BRANCHES_PERMISSIONS } from '@/lib/constants/permissions/branches-perm';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { branchCalendarSchema, organizationCalendarSchema } from '@/lib/validations/business-calendar-schemas';
import { BusinessCalendarApiError, saveBranchCalendar, saveOrganizationCalendar } from '../api/business-calendar-api';
import { useBranchCalendar, useCalendarBranches, useOrganizationCalendar, useRefreshBusinessCalendar } from '../hooks/use-business-calendar';
import { CalendarHolidaysTab } from './calendar-holidays-tab';
import { CalendarReadyPreviewCard } from './calendar-ready-preview-card';
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
  const locale = useLocale();
  const query = useOrganizationCalendar();
  const refresh = useRefreshBusinessCalendar();
  const { token: csrfToken } = useCSRFToken();
  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) return <CmxSummaryMessage type="error" title={t('errors.loadFailed')} items={[]} />;
  const save = async (values: CalendarValues) => {
    try {
      await saveOrganizationCalendar(organizationCalendarSchema.parse({ ...values, version: query.data?.version }), csrfToken);
    } catch (error) {
      // Someone else saved first: show their values, so a repeat save starts from them.
      if (error instanceof BusinessCalendarApiError && error.code === 'CALENDAR_CHANGED') await refresh();
      throw error;
    }
    await refresh();
  };
  const template = query.data.template;
  return (
    <div className="space-y-3">
      {query.data.timezone ? <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('timezone', { timezone: query.data.timezone })}</p> : null}
      <CalendarHoursForm
        key={query.dataUpdatedAt}
        idPrefix="org"
        initial={query.data}
        canSave={canSave}
        onSave={save}
        template={template ? { name: locale === 'ar' ? template.name2 || template.name : template.name, values: template } : null}
      />
      <CalendarReadyPreviewCard branchId="" />
    </div>
  );
}

/** One branch's calendar; `?branch=` opens it directly from Branch settings. */
function BranchTab({ canSave, branchOptions, branchesFailed, branchId, onBranchChange }: {
  canSave: boolean;
  branchOptions: { value: string; label: string }[];
  branchesFailed: boolean;
  branchId: string;
  onBranchChange: (id: string) => void;
}) {
  const t = useTranslations('settings.calendar');
  const query = useBranchCalendar(branchId);
  const refresh = useRefreshBusinessCalendar();
  const { token: csrfToken } = useCSRFToken();
  // Switching branch remounts the form, so unsaved edits would be lost: ask first.
  const dirty = useRef(false);
  const markDirty = useCallback((next: boolean) => { dirty.current = next; }, []);
  const changeBranch = async (id: string) => {
    if (dirty.current && !(await cmxMessage.confirm({ title: t('discard.title'), description: t('discard.description') }))) return;
    dirty.current = false;
    onBranchChange(id);
  };
  const save = async (values: CalendarValues) => {
    try {
      await saveBranchCalendar(branchId, branchCalendarSchema.parse({ ...values, version: query.data?.version }), csrfToken);
    } catch (error) {
      if (error instanceof BusinessCalendarApiError && error.code === 'CALENDAR_CHANGED') await refresh();
      throw error;
    }
    await refresh();
  };
  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <CmxSelect label={t('branch.select')} placeholder={t('branch.choose')} options={branchOptions} value={branchId} onChange={(e) => { void changeBranch(e.target.value); }} />
      </div>
      {branchesFailed ? <CmxSummaryMessage type="error" title={t('errors.branchesFailed')} items={[]} /> : null}
      {!branchId ? <CmxEmptyState title={t('branch.emptyTitle')} description={t('branch.emptyDescription')} /> : null}
      {branchId && query.isLoading ? <Loading /> : null}
      {branchId && query.isError ? <CmxSummaryMessage type="error" title={t('errors.loadFailed')} items={[]} /> : null}
      {branchId && query.data ? (
        <CalendarHoursForm key={`${branchId}-${query.dataUpdatedAt}`} idPrefix="branch" initial={query.data} organization={query.data.organization} canSave={canSave} onSave={save} onDirtyChange={markDirty} />
      ) : null}
      {branchId && query.data ? <CalendarReadyPreviewCard branchId={branchId} /> : null}
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
  // The branch list and a branch's calendar are branch reads: without them the tab would only show a load error.
  const canReadBranches = useHasPermissionCode(BRANCHES_PERMISSIONS.READ);
  const branches = useCalendarBranches();

  const setParams = useCallback((patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const tabParam = searchParams.get('tab') ?? '';
  const branchId = searchParams.get('branch') ?? '';
  const wanted = TAB_IDS.includes(tabParam) ? tabParam : branchId ? 'branches' : 'organization';
  const active = wanted === 'branches' && !canReadBranches ? 'organization' : wanted;

  const tabs: CmxTabItem[] = [
    { id: 'organization', label: t('tabs.organization'), content: <OrganizationTab canSave={canEditOrganization} /> },
    ...(canReadBranches ? [{
      id: 'branches',
      label: t('tabs.branches'),
      content: <BranchTab canSave={canEditBranch} branchOptions={branches.options} branchesFailed={branches.isError} branchId={branchId} onBranchChange={(id) => setParams({ tab: 'branches', branch: id })} />,
    }] : []),
    { id: 'holidays', label: t('tabs.holidays'), content: <CalendarHolidaysTab canManage={canEditOrganization} branchOptions={canReadBranches ? branches.options : []} /> },
  ];

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('subtitle')}</p>
      </div>
      <CmxTabsPanel tabs={tabs} value={active} onChange={(tab) => setParams({ tab })} keepMounted />
    </div>
  );
}
