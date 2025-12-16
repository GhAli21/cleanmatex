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

import { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { useRTL } from '@/lib/hooks/useRTL'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const isRTL = useRTL() // Use hook instead of function

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area - RTL aware padding */}
      <div className={isRTL ? 'lg:pr-64' : 'lg:pl-64'}>
        {/* Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
