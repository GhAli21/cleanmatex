'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ClipboardCheck, Clock, MonitorSmartphone } from 'lucide-react'

import { CmxButton, CmxSkeleton } from '@ui/primitives'
import { CmxSummaryMessage } from '@ui/feedback'
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation/cmx-tabs-panel'

import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { usePosSettingsForm } from '@features/pos-settings/hooks/use-pos-settings-form'
import {
  POS_SETTINGS_TAB,
  countDirtyFieldsByTab,
  resolvePosSettingsTab,
  type PosSettingsTab,
} from '@features/pos-settings/model/pos-settings-tabs'
import { PosSettingsLifecycleTab } from './pos-settings-lifecycle-tab'
import { PosSettingsRequirementTab } from './pos-settings-requirement-tab'

/** Amber dot on a tab that holds unsaved edits, so changes made on another tab are never forgotten. */
function UnsavedDot({ label }: { label: string }) {
  return (
    <span
      className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-[rgb(var(--cmx-warning-rgb,245_158_11))]"
      role="img"
      aria-label={label}
    />
  )
}

/**
 * Tenant POS-session settings: one page, one form, one Save across the tabs. The tab lives in `?tab=` so a
 * deep link opens the right tab. Reads need `cash_control:view`; saving needs `cash_control:manage`
 * (enforced again by the settings API). Route: /dashboard/settings/pos-settings.
 *
 * Drawer and cash-handling policy stays on the Cash Control Settings page. v1 manages TENANT-level
 * defaults only — the resolver already supports BRANCH/USER/DRAWER overrides (§3.1.3).
 */
export function PosSettingsScreen() {
  const t = useTranslations('posSettings')
  const tCash = useTranslations('cashControl')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const canManage = useHasPermissionCode('cash_control:manage')
  const { form, isLoading, isError, save } = usePosSettingsForm()

  const activeTab = resolvePosSettingsTab(searchParams.get('tab'))
  const selectTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-4 p-6">
        <CmxSkeleton className="h-8 w-64" />
        <CmxSkeleton className="h-10 w-full" />
        <CmxSkeleton className="h-40 w-full" />
        <CmxSkeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-4xl p-6">
        <CmxSummaryMessage type="error" title={tCash('messages.loadFailed')} items={[]} />
      </div>
    )
  }

  const dirtyByTab = countDirtyFieldsByTab(form.formState.dirtyFields)
  const dirtyTotal = Object.values(dirtyByTab).reduce((sum, n) => sum + n, 0)

  const tabIcon = (tab: PosSettingsTab, icon: React.ReactNode) => (
    <span className="relative inline-flex">
      {icon}
      {dirtyByTab[tab] > 0 ? <UnsavedDot label={t('unsavedChanges', { count: dirtyByTab[tab] })} /> : null}
    </span>
  )

  // Wrapped per tab (not around the tab list) so a view-only user can still switch tabs.
  const panel = (content: React.ReactNode) => (
    <fieldset disabled={!canManage} className="m-0 min-w-0 border-0 p-0">
      {content}
    </fieldset>
  )

  const tabs: CmxTabItem[] = [
    {
      id: POS_SETTINGS_TAB.REQUIREMENT,
      label: t('tabs.requirement'),
      icon: tabIcon(POS_SETTINGS_TAB.REQUIREMENT, <ClipboardCheck className="h-4 w-4" aria-hidden />),
      content: panel(<PosSettingsRequirementTab form={form} />),
    },
    {
      id: POS_SETTINGS_TAB.LIFECYCLE,
      label: t('tabs.lifecycle'),
      icon: tabIcon(POS_SETTINGS_TAB.LIFECYCLE, <Clock className="h-4 w-4" aria-hidden />),
      content: panel(<PosSettingsLifecycleTab form={form} />),
    },
  ]

  return (
    <form onSubmit={save} className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[rgb(var(--cmx-primary-bg-rgb,239_246_255))] p-2">
          <MonitorSmartphone className="h-6 w-6 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {!canManage && (
        <CmxSummaryMessage
          type="info"
          title={tCash('viewOnlyTitle')}
          items={[tCash('viewOnlyDescription')]}
        />
      )}

      <CmxTabsPanel tabs={tabs} value={activeTab} onChange={selectTab} />

      {canManage && (
        <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-6 py-3">
          {dirtyTotal > 0 && (
            <span className="me-auto text-sm text-muted-foreground" aria-live="polite">
              {t('unsavedChanges', { count: dirtyTotal })}
            </span>
          )}
          <CmxButton
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting || dirtyTotal === 0}
            onClick={() => form.reset()}
          >
            {t('discard')}
          </CmxButton>
          <CmxButton type="submit" disabled={form.formState.isSubmitting || dirtyTotal === 0}>
            {form.formState.isSubmitting ? tCommon('saving') : tCommon('save')}
          </CmxButton>
        </div>
      )}
    </form>
  )
}
