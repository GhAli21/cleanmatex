/**
 * Dashboard Layout
 *
 * Authenticated layout for dashboard pages
 * Features:
 * - Responsive sidebar (collapsible on <1024px, toggleable on desktop)
 * - Top bar with user menu and notifications
 * - Main content area
 * - Multi-tenant context
 * - RTL support for Arabic
 */

'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CmxSidebar, CmxTopBar } from '@ui/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { SidebarProvider, useSidebar } from '@/lib/context/sidebar-context'
import { DashboardBrowserTitle } from '@features/dashboard/ui/dashboard-browser-title'
import { SessionLifecycleProvider } from '@features/auth-session/ui/session-lifecycle-provider'
import { SetupBlockerBanner } from '@features/setup-health/ui/setup-blocker-banner'
import { useTranslations, useLocale } from 'next-intl'
import { getPageAccessContractByPath } from '@features/access/page-access-registry'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { CmxPermissionsInspectorTrigger } from '@features/access/ui/permissions-inspector'
import { NotificationBell } from '@features/notifications/ui/notification-bell'
import { SessionActivityTrigger } from '@features/session-activity'
import { GlobalScanTrigger } from '@features/scan'

/** True when current route is the ready-order print preview (receipt or order-details). */
function useIsPrintRoute(): boolean {
  const pathname = usePathname()
  return Boolean(
    typeof pathname === 'string' &&
      pathname.includes('/ready/') &&
      pathname.includes('/print/')
  )
}

/** Resolves the localized top bar title for the active dashboard route. */
function resolveLocalizedNavTitle(
  navigation: ReturnType<typeof useNavigation>['navigation'],
  pathname: string | null,
  locale: string
): string | null {
  if (!pathname) return null
  const normalized = pathname.replace(/\/+$/, '') || '/dashboard'
  let bestLen = -1
  let bestLabel: string | null = null
  const visit = (path?: string, label?: string, label2?: string) => {
    if (!path || !label) return
    const p = path.replace(/\/+$/, '')
    const matches =
      normalized === p ||
      (p !== '/dashboard' && normalized.startsWith(`${p}/`))
    if (matches && p.length > bestLen) {
      bestLen = p.length
      bestLabel = locale === 'ar' ? label2 || label : label
    }
  }
  for (const section of navigation) {
    visit(section.path, section.label, section.label2)
    for (const child of section.children ?? []) {
      visit(child.path, child.label, child.label2)
    }
  }
  return bestLabel
}

/** Top bar with the localized route title and the feature actions. */
function DashboardTopBar() {
  const pathname = usePathname()
  const locale = useLocale()
  const { navigation } = useNavigation()
  const tNav = useTranslations('navigation')
  const t = useTranslations('layout.topBar')
  const localizedTitle = resolveLocalizedNavTitle(navigation, pathname, locale)
  return (
    <CmxTopBar
      title={localizedTitle ?? getPageAccessContractByPath(pathname)?.label ?? tNav('dashboard')}
      actions={
        <>
          <GlobalScanTrigger />
          <CmxPermissionsInspectorTrigger title={t('permissionsDialog.title')} />
          <SessionActivityTrigger />
          <NotificationBell />
        </>
      }
    />
  )
}

function DashboardContent({
  children,
  isPrintRoute,
}: {
  children: ReactNode
  isPrintRoute: boolean
}) {
  const { isCollapsed, prefersReducedMotion } = useSidebar()

  if (isPrintRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  const paddingClass = isCollapsed
    ? 'lg:ps-16'
    : 'lg:ps-64'

  const transitionClass = prefersReducedMotion ? '' : 'transition-[padding] duration-300 ease-in-out'

  return (
    <>
      <CmxSidebar />
      <div className={`${paddingClass} ${transitionClass}`}>
        <DashboardTopBar />
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <SetupBlockerBanner />
          {children}
        </main>
      </div>
    </>
  )
}

/**
 *
 * @param root0
 * @param root0.children
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const tCommon = useTranslations('common')
  const { isAuthenticated, isLoading, currentTenant, signOut } = useAuth()
  const isPrintRoute = useIsPrintRoute()

  // Defence in depth: redirect unauthenticated users to login (middleware also protects)
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login'
      router.replace(redirectUrl)
      return
    }
    // Force logout if the user's account has been deactivated mid-session
    if (currentTenant && !currentTenant.is_active) {
      signOut('security')
    }
  }, [isAuthenticated, isLoading, currentTenant, pathname, router, signOut])

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Server-authoritative session lifecycle: idle warning, heartbeat, cross-tab sign-out. */}
      <SessionLifecycleProvider>
        <SidebarProvider>
          <DashboardBrowserTitle />
          {!isPrintRoute ? (
            <DashboardContent isPrintRoute={false}>{children}</DashboardContent>
          ) : (
            <main className="min-h-screen">{children}</main>
          )}
        </SidebarProvider>
      </SessionLifecycleProvider>
    </div>
  )
}
