/**
 * Dashboard Layout
 *
 * Authenticated layout for dashboard pages
 * Features:
 * - Responsive sidebar (collapsible on <1024px)
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

/** True when current route is the ready-order print preview (receipt or order-details). */
function useIsPrintRoute(): boolean {
  const pathname = usePathname()
  return Boolean(
    typeof pathname === 'string' &&
      pathname.includes('/ready/') &&
      pathname.includes('/print/')
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()
  const isRTL = useRTL()
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isPrintRoute && (
        <>
          <CmxSidebar />
          <div className={isRTL ? 'lg:pr-64' : 'lg:pl-64'}>
            <CmxTopBar />
            <main className="py-6 px-4 sm:px-6 lg:px-8">{children}</main>
          </div>
        </>
      )}
      {isPrintRoute && (
        <main className="min-h-screen">{children}</main>
      )}
    </div>
  )
}
