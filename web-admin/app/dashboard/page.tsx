import type { Metadata } from 'next'
import DashboardHomePage from '@features/dashboard/ui/dashboard-home-page'

/**
 * Distinguishes the operational home screen in browser history and task switching.
 */
export const metadata: Metadata = {
  title: 'Dashboard',
}

/**
 * Keeps route composition server-rendered so route metadata is available before client hydration.
 */
export default function DashboardPage() {
  return <DashboardHomePage />
}
