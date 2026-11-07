'use client'

/**
 * Dashboard-layout banner for failing setup blockers marked shows_banner
 * (PLAN §3.2, decision H2), e.g. "orders are not taxed". It cannot be
 * dismissed: it disappears only when the blocker is fixed. Shown to every
 * signed-in user (summary API is sign-in only); the link to the full screen
 * appears only for users with setup_health:view.
 */
import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CmxCollapsibleSection } from '@ui/data-display'
import { CmxSummaryMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives'
import { useSetupHealthSummary } from '../hooks/use-setup-health'

/** Keeps a local disclosure preference tab-scoped, so unresolved blockers return in a new session. */
const SETUP_HEALTH_BANNER_COLLAPSED_KEY = 'cmx.setup-health.banner.collapsed'
const setupHealthBannerListeners = new Set<() => void>()

/**
 * Connects React to the tab-scoped disclosure preference without a hydration-time state update.
 *
 * @param listener - React snapshot listener.
 * @returns Unsubscribe callback for the current banner instance.
 */
function subscribeToSetupHealthBanner(listener: () => void) {
  setupHealthBannerListeners.add(listener)
  return () => setupHealthBannerListeners.delete(listener)
}

/**
 * Reads the tab-scoped preference while keeping server rendering expanded until hydration completes.
 *
 * @returns Whether the alert body should start collapsed in this browser session.
 */
function readSetupHealthBannerCollapsed(): boolean {
  return typeof window !== 'undefined'
    && window.sessionStorage.getItem(SETUP_HEALTH_BANNER_COLLAPSED_KEY) === 'true'
}

/**
 * Persists a disclosure-only preference and notifies mounted banners in the same browser tab.
 *
 * @param collapsed - Whether the alert body is currently collapsed.
 */
function setSetupHealthBannerCollapsed(collapsed: boolean): void {
  window.sessionStorage.setItem(SETUP_HEALTH_BANNER_COLLAPSED_KEY, String(collapsed))
  setupHealthBannerListeners.forEach((listener) => listener())
}

/**
 * Renders a non-dismissible setup-blocker alert that can be collapsed for the
 * current browser session without hiding the unresolved issue permanently.
 */
export function SetupBlockerBanner() {
  const t = useTranslations('setupHealth')
  const isAr = useLocale() === 'ar'
  const { data } = useSetupHealthSummary()
  const isCollapsed = useSyncExternalStore(
    subscribeToSetupHealthBanner,
    readSetupHealthBannerCollapsed,
    () => false,
  )

  if (!data || data.bannerItems.length === 0) return null

  return (
    <div className="mb-4" role="alert">
      <CmxCollapsibleSection
        title={t('banner.title')}
        open={!isCollapsed}
        onOpenChange={(open) => setSetupHealthBannerCollapsed(!open)}
      >
        <div className="space-y-2">
          <CmxSummaryMessage
            type="error"
            title={t('banner.title')}
            items={data.bannerItems.map((i) => (isAr ? i.name2 : i.name))}
          />
          {data.canView && (
            <CmxButton asChild size="sm" variant="outline">
              <Link href="/dashboard/setup-health">{t('banner.viewAll')}</Link>
            </CmxButton>
          )}
        </div>
      </CmxCollapsibleSection>
    </div>
  )
}
