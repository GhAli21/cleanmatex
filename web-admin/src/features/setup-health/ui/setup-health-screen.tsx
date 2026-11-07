'use client'

/**
 * Setup Health screen (read-only, PLAN §3.2 / decision H3): every visible check
 * grouped by domain, with why it matters and a Fix button that opens the
 * tenant screen when the user may fix it, otherwise a "contact support" note.
 */
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { CmxButton, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { CmxEmptyState } from '@ui/data-display'
import { CmxSummaryMessage } from '@ui/feedback'
import type { SetupHealthDomain, SetupHealthItem } from '@/lib/types/setup-health'
import { useSetupHealth } from '../hooks/use-setup-health'
import { SetupHealthSeverityBadge, SetupHealthStatusBadge } from './setup-health-badges'

/** Full Setup Health screen; data scoped to the current tenant by the API. */
export function SetupHealthScreen() {
  const t = useTranslations('setupHealth')
  const tCommon = useTranslations('common')
  const isAr = useLocale() === 'ar'
  const { data, isLoading, isError, refetch, isFetching } = useSetupHealth()

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{t('subtitle')}</p>
      </div>
      <CmxButton variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
        {tCommon('refresh')}
      </CmxButton>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        {[0, 1, 2].map((i) => (
          <CmxSkeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        {header}
        <CmxSummaryMessage type="error" title={t('loadError')} items={[]} />
        <CmxButton variant="outline" onClick={() => refetch()}>
          {tCommon('retry')}
        </CmxButton>
      </div>
    )
  }

  const groups = groupByDomain(data.items, data.domains)
  const hasProblems = data.items.some((i) => i.status === 'FAIL' || i.status === 'ERROR')

  return (
    <div className="space-y-6">
      {header}
      {!hasProblems && <CmxEmptyState title={t('allGood')} />}
      {groups.map(({ domain, items }) => (
        <CmxCard key={domain.domainCode}>
          <CmxCardHeader>
            <CmxCardTitle>{isAr ? domain.name2 : domain.name}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="divide-y">
            {items.map((item) => (
              <SetupHealthRow key={item.checkCode} item={item} isAr={isAr} />
            ))}
          </CmxCardContent>
        </CmxCard>
      ))}
    </div>
  )
}

function SetupHealthRow({ item, isAr }: { item: SetupHealthItem; isAr: boolean }) {
  const t = useTranslations('setupHealth')
  const failing = item.status === 'FAIL'

  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{isAr ? item.name2 : item.name}</span>
          <SetupHealthStatusBadge status={item.status} />
          {failing && <SetupHealthSeverityBadge severity={item.severity} />}
          {failing && item.issueCount > 0 && (
            <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{t('issueCount', { count: item.issueCount })}</span>
          )}
        </div>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{isAr ? item.description2 : item.description}</p>
      </div>
      {failing && (
        <div className="shrink-0">
          {item.fixRoute ? (
            <CmxButton asChild size="sm">
              <Link href={item.fixRoute}>{t('fix')}</Link>
            </CmxButton>
          ) : (
            <p className="max-w-xs text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{t('contactSupport')}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Groups items under their domain in domain order; domains without visible items are left out. */
function groupByDomain(items: SetupHealthItem[], domains: SetupHealthDomain[]) {
  return domains
    .map((domain) => ({
      domain,
      items: items
        .filter((i) => i.domainCode === domain.domainCode)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .filter((g) => g.items.length > 0)
}
