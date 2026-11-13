'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxSkeleton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';
import { useReadyPreview } from '../hooks/use-business-calendar';

/** Props of the preview card. */
export interface CalendarReadyPreviewCardProps {
  /** A branch id, or '' for the organization. */
  branchId: string;
}

/**
 * "If an order is placed now": the promised ready time per speed from the SAVED calendar and speed rules,
 * computed by the server with the same engine as order entry. Read-only; refreshed after every save.
 * @param props - the branch (or organization) to preview
 * @returns the card
 */
export function CalendarReadyPreviewCard({ branchId }: CalendarReadyPreviewCardProps) {
  const t = useTranslations('settings.calendar');
  const locale = useLocale();
  const query = useReadyPreview(branchId);
  const data = query.data;

  // Times are shown in the branch's own time zone, with the date: a promise days away is ambiguous as a bare weekday.
  const when = (iso: string) => new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    ...(data?.timezone ? { timeZone: data.timezone } : {}),
  }).format(new Date(iso));

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('preview.title')}</CmxCardTitle>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('preview.subtitle')}</p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-3">
        {query.isLoading ? <CmxSkeleton className="h-24 w-full" /> : null}
        {query.isError ? <CmxSummaryMessage type="error" title={t('preview.loadFailed')} items={[]} /> : null}
        {data && !data.configured ? <CmxSummaryMessage type="info" title={t('preview.notConfigured')} items={[]} /> : null}
        {data?.configured ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CmxStatusBadge label={data.openNow ? t('preview.openNow') : t('preview.closedNow')} variant={data.openNow ? 'success' : 'outline'} size="sm" />
              {data.countingStartsAt ? <span>{t('preview.countingStarts', { when: when(data.countingStartsAt) })}</span> : null}
            </div>
            <ul className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              {data.rows.map((row) => (
                <li key={row.speed} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">
                    {locale === 'ar' ? row.name2 || row.name : row.name}
                    <span className="ms-2 font-normal text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {row.unit === 'WORKING_DAYS' ? t('preview.days', { count: row.amount }) : t('preview.hours', { count: row.amount })}
                      {row.source === 'EXAMPLE' ? ` · ${t('preview.example')}` : ''}
                      {row.source === 'DEFAULT' ? ` · ${t('preview.noHours')}` : ''}
                    </span>
                  </span>
                  <span dir="auto">{t('preview.ready', { when: when(row.readyByAt) })}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </CmxCardContent>
    </CmxCard>
  );
}
