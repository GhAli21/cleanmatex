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
import { useRTL } from '@/lib/hooks/useRTL'
import { useAuth } from '@/lib/auth/auth-context'
import { SidebarProvider, useSidebar } from '@/lib/context/sidebar-context'

/** True when current route is the ready-order print preview (receipt or order-details). */
function useIsPrintRoute(): boolean {
  const pathname = usePathname()
  return Boolean(
    typeof pathname === 'string' &&
      pathname.includes('/ready/') &&
      pathname.includes('/print/')
  )
}

function DashboardContent({
  children,
  isPrintRoute,
}: {
  children: ReactNode
  isPrintRoute: boolean
}) {
  const isRTL = useRTL()
  const { isCollapsed, prefersReducedMotion } = useSidebar()

  if (isPrintRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  const paddingClass = isCollapsed
    ? isRTL
      ? 'lg:pr-16'
      : 'lg:pl-16'
    : isRTL
      ? 'lg:pr-64'
      : 'lg:pl-64'

  const transitionClass = prefersReducedMotion ? '' : 'transition-[padding] duration-300 ease-in-out'

  return (
    <>
      <CmxSidebar />
      <div className={`${paddingClass} ${transitionClass}`}>
        <CmxTopBar />
        <main className="py-6 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()
  const isPrintRoute = useIsPrintRoute()

  // Defence in depth: redirect unauthenticated users to login (middleware also protects)
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login'
      router.replace(redirectUrl)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--win2k-desktop)' }}>
        <div className="win2k-panel p-6 text-center" style={{ minWidth: 280 }}>
          <div className="win2k-titlebar mb-4">
            <span>CleanMateX</span>
          </div>
          <div className="win2k-inset p-4 mb-4">
            <p className="win2k-text">Redirecting to login...</p>
          </div>
          <button className="win2k-btn">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--win2k-desktop)' }}>
      <SidebarProvider>
        {!isPrintRoute ? (
          <DashboardContent isPrintRoute={false}>{children}</DashboardContent>
        ) : (
          <main className="min-h-screen">{children}</main>
        )}
      </SidebarProvider>
    </div>
  )
}
