'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxSelect } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CMX_DEFAULT_PAGE_SIZE, CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import type { HolidayView, PublicHolidayView } from '@/lib/services/settings/business-calendar.service';
import { BusinessCalendarApiError, deleteHolidayApi } from '../api/business-calendar-api';
import { useHolidays, useRefreshBusinessCalendar } from '../hooks/use-business-calendar';
import { CalendarHolidayDialog, type HolidayDraft } from './calendar-holiday-dialog';

/** One table row: the organization's own day, or a public holiday from HQ (read-only). */
type HolidayRow =
  | { key: string; date: string; own: HolidayView; pub?: undefined }
  | { key: string; date: string; pub: PublicHolidayView; own?: undefined };

/** Props of the holidays tab. */
export interface CalendarHolidaysTabProps {
  canManage: boolean;
  branchOptions: { value: string; label: string }[];
}

/**
 * The year's holidays: the organization's own days and its country's public
 * holidays. A public holiday cannot be edited, but "We open this day" adds an own row that overrides it.
 * @param props - permission and branches
 * @returns the tab
 */
export function CalendarHolidaysTab({ canManage, branchOptions }: CalendarHolidaysTabProps) {
  const t = useTranslations('settings.calendar');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { token: csrfToken } = useCSRFToken();
  const refresh = useRefreshBusinessCalendar();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [branchId, setBranchId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [draft, setDraft] = useState<HolidayDraft | null>(null);
  const [deleting, setDeleting] = useState<HolidayView | null>(null);
  const list = useHolidays(year, branchId || undefined);

  const pick = (en: string, ar: string | null | undefined) => (locale === 'ar' ? ar || en : en);
  const branchLabel = (id: string | null) => (id ? branchOptions.find((b) => b.value === id)?.label ?? id : t('holidays.allBranches'));
  // Date-only values: formatted in UTC so the day never shifts with the browser's zone.
  const dateText = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const errorText = (error: unknown) => {
    const code = error instanceof BusinessCalendarApiError ? error.code : 'INTERNAL_ERROR';
    return t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.INTERNAL_ERROR');
  };

  // A public holiday the organization already overrides (own row on the same date) is shown as overridden.
  const overriddenDates = useMemo(() => new Set((list.data?.holidays ?? []).map((h) => h.holidayDate)), [list.data]);

  const rows = useMemo<HolidayRow[]>(() => {
    const own: HolidayRow[] = (list.data?.holidays ?? []).map((h) => ({ key: h.id, date: h.holidayDate, own: h }));
    const pub: HolidayRow[] = (list.data?.publicHolidays ?? []).map((h) => ({ key: `${h.holidayCode}-${h.holidayDate}`, date: h.holidayDate, pub: h }));
    return [...own, ...pub].sort((a, b) => a.date.localeCompare(b.date));
  }, [list.data]);

  const newDraft = (patch: Partial<HolidayDraft> = {}): HolidayDraft => ({
    branchId: branchId || null, holidayDate: '', name: '', name2: '', isClosed: true, openTime: '', closeTime: '', ...patch,
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteHolidayApi(deleting.id, csrfToken);
      cmxMessage.success(t('holidays.deleted'));
      await refresh();
    } catch (error) {
      cmxMessage.error(errorText(error));
    } finally {
      setDeleting(null);
    }
  };

  const columns: CmxDataTableSimpleColumn<HolidayRow>[] = [
    { key: 'date', header: t('holidays.date'), render: (row) => dateText(row.date), sortable: false },
    { key: 'name', header: t('holidays.name'), render: (row) => (row.own ? pick(row.own.name, row.own.name2) : pick(row.pub.name, row.pub.name2)), sortable: false },
    {
      key: 'source',
      header: t('holidays.source'),
      render: (row) => (row.own
        ? <CmxStatusBadge label={t('holidays.sourceOwn')} variant="info" size="sm" />
        : <CmxStatusBadge label={row.pub.isEstimated ? t('holidays.sourcePublicEstimated') : t('holidays.sourcePublic')} variant={row.pub.isEstimated ? 'warning' : 'outline'} size="sm" />),
      sortable: false,
    },
    {
      key: 'hours',
      header: t('holidays.hours'),
      render: (row) => {
        if (row.pub && overriddenDates.has(row.date)) return t('holidays.overridden');
        return row.own && !row.own.isClosed ? <span dir="ltr">{row.own.openTime} – {row.own.closeTime}</span> : t('holidays.closedAllDay');
      },
      sortable: false,
    },
    { key: 'branch', header: t('holidays.appliesTo'), render: (row) => branchLabel(row.own ? row.own.branchId : null), sortable: false },
    {
      key: 'actions',
      header: tCommon('actions'),
      render: (row) => {
        if (!canManage) return null;
        if (row.pub) {
          // Already overridden: a second override would be refused as a duplicate (edit the own row instead).
          if (overriddenDates.has(row.date)) return null;
          return (
            <CmxButton
              type="button" size="sm" variant="outline"
              onClick={() => setDraft(newDraft({ holidayDate: row.pub.holidayDate, name: row.pub.name, name2: row.pub.name2 ?? '', isClosed: false }))}
            >
              {t('holidays.openThisDay')}
            </CmxButton>
          );
        }
        const h = row.own;
        return (
          <div className="flex flex-wrap gap-2">
            <CmxButton
              type="button" size="sm" variant="outline"
              onClick={() => setDraft({ id: h.id, branchId: h.branchId, holidayDate: h.holidayDate, name: h.name, name2: h.name2 ?? '', isClosed: h.isClosed, openTime: h.openTime ?? '', closeTime: h.closeTime ?? '' })}
            >
              {tCommon('edit')}
            </CmxButton>
            <CmxButton type="button" size="sm" variant="outline" onClick={() => setDeleting(h)}>{tCommon('delete')}</CmxButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <CmxCard>
        <CmxCardContent className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div className="grid flex-1 gap-4 sm:max-w-md sm:grid-cols-2">
            <CmxSelect
              label={t('holidays.year')}
              options={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => ({ value: String(y), label: String(y) }))}
              value={String(year)}
              onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
            />
            <CmxSelect
              label={t('holidays.appliesTo')}
              options={[{ value: '', label: tCommon('all') }, ...branchOptions]}
              value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setPage(1); }}
            />
          </div>
          {canManage ? <CmxButton type="button" onClick={() => setDraft(newDraft())}>{t('holidays.add')}</CmxButton> : null}
        </CmxCardContent>
      </CmxCard>

      {list.data && !list.data.country ? <CmxSummaryMessage type="info" title={t('holidays.noCountry')} items={[]} /> : null}
      {list.data?.country && list.data.publicHolidays.length === 0 ? <CmxSummaryMessage type="info" title={t('holidays.noPublicYear', { country: list.data.country, year })} items={[]} /> : null}
      {list.isError ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[errorText(list.error)]} /> : null}

      {/* A year's list is small and already fully loaded, so it pages in the browser. */}
      <CmxDataTable
        columns={columns}
        data={rows.slice((page - 1) * pageSize, page * pageSize)}
        loading={list.isLoading}
        currentPage={page}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        emptyStateTitle={t('holidays.emptyTitle')}
        emptyStateDescription={t('holidays.emptyDescription')}
        stickyEndColumnIds={['actions']}
      />

      {draft ? (
        <CalendarHolidayDialog
          key={draft.id ?? draft.holidayDate}
          draft={draft}
          branchOptions={branchOptions}
          onClose={() => setDraft(null)}
          onSaved={() => { setDraft(null); void refresh(); }}
        />
      ) : null}

      <CmxConfirmDialog
        open={!!deleting}
        title={t('holidays.deleteTitle')}
        description={t('holidays.deleteDescription')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
