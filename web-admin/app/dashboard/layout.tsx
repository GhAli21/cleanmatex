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

import { ReactNode, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { useRTL } from '@/lib/hooks/useRTL'
 
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
  const isRTL = useRTL()
  const isPrintRoute = useIsPrintRoute()

  return (
    <div className="min-h-screen bg-gray-50">
      {!isPrintRoute && (
        <>
          <Sidebar />
          <div className={isRTL ? 'lg:pr-64' : 'lg:pl-64'}>
            <TopBar />
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
