'use client'

/**
 * Dashboard home tile "Setup health": failing-check counts with a link to the
 * screen. Hidden for users without setup_health:view (they could not open it).
 */
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { useSetupHealthSummary } from '../hooks/use-setup-health'

/** Home tile; data scoped to the current tenant. */
export function SetupHealthHomeCard() {
  const t = useTranslations('setupHealth.homeCard')
  const { data } = useSetupHealthSummary()

  if (!data?.canView) return null

  const problems = data.blockers + data.warnings + data.infos
  return (
    <Link href="/dashboard/setup-health" className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <CmxCard className="h-full transition-shadow motion-reduce:transition-none hover:shadow-md">
        <CmxCardHeader className="pb-2">
          <CmxCardTitle>{t('title')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-1">
          <p className={data.blockers > 0 ? 'text-lg font-semibold text-[rgb(var(--cmx-destructive-rgb,220_38_38))]' : 'text-lg font-semibold'}>
            {problems === 0 ? t('allGood') : t('counts', { blockers: data.blockers, warnings: data.warnings, infos: data.infos })}
          </p>
          {data.errors > 0 && <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{t('errors', { count: data.errors })}</p>}
        </CmxCardContent>
      </CmxCard>
    </Link>
  )
}
